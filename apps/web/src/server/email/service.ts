import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { db } from "@/server/db";
import { EMAIL_CATEGORIES, isEmailEvent, type EmailEvent, type EmailPayloads } from "./events";
import { getEmailProvider } from "./provider";
import { renderEmail } from "./render";

const emailSchema = z.string().trim().email().max(320);
const MAX_ATTEMPTS = 5;

export type EnqueueEmailInput<K extends EmailEvent> = {
  event: K;
  to: string;
  payload: EmailPayloads[K];
  workspaceId?: string;
  userId?: string;
  idempotencyKey?: string;
  scheduledAt?: Date;
};

export type EnqueueEmailResult = {
  status: "queued" | "suppressed" | "skipped";
  id: string | null;
};

export type ProcessEmailQueueResult = {
  processed: number;
  sent: number;
  retried: number;
  failed: number;
};

function normalizeEmail(value: string): string {
  return emailSchema.parse(value).toLowerCase();
}

export async function enqueueEmail<K extends EmailEvent>(
  input: EnqueueEmailInput<K>,
): Promise<EnqueueEmailResult> {
  const toEmail = normalizeEmail(input.to);
  const category = EMAIL_CATEGORIES[input.event];

  if (category !== "transactional") {
    // Resolve the owner by email when the caller did not supply a user id. An
    // arbitrary address in a tenant-editable field must still get a preference
    // check rather than bypassing it entirely.
    const userId =
      input.userId ??
      (await db.user.findUnique({ where: { email: toEmail }, select: { id: true } }))?.id ??
      null;
    const preference = userId ? await db.emailPreference.findUnique({ where: { userId } }) : null;

    const allowed =
      category === "product" ? (preference?.product ?? true) : (preference?.marketing ?? false);

    if (!allowed) {
      logger.info({ event: input.event, userId }, "email skipped by preference");
      return { status: "skipped", id: null };
    }
  }

  const suppression = await db.emailSuppression.findUnique({ where: { email: toEmail } });
  if (suppression) {
    logger.info({ event: input.event }, "email skipped by suppression list");
    return { status: "suppressed", id: null };
  }

  const rendered = renderEmail(input.event, input.payload);
  const idempotencyKey =
    input.idempotencyKey ??
    createHash("sha256")
      .update(`${input.event}\n${toEmail}\n${JSON.stringify(input.payload)}`)
      .digest("hex");

  const message = await db.emailMessage.upsert({
    where: { idempotencyKey },
    update: {},
    create: {
      workspaceId: input.workspaceId ?? null,
      userId: input.userId ?? null,
      toEmail,
      template: input.event,
      subject: rendered.subject,
      payload: input.payload,
      idempotencyKey,
      scheduledAt: input.scheduledAt ?? new Date(),
    },
  });

  return { status: "queued", id: message.id };
}

type DeliveryOutcome = "sent" | "retried" | "failed" | "skipped";

async function deliverQueuedEmail(id: string): Promise<DeliveryOutcome> {
  const claim = await db.emailMessage.updateMany({
    where: { id, status: "QUEUED" },
    data: { status: "SENDING", attempts: { increment: 1 } },
  });

  if (claim.count === 0) {
    return "skipped";
  }

  const message = await db.emailMessage.findUnique({ where: { id } });
  if (!message) {
    return "skipped";
  }

  try {
    const template = message.template;
    if (!isEmailEvent(template)) {
      throw new Error("Unknown email template");
    }

    const rendered = renderEmail(template, message.payload as EmailPayloads[typeof template]);
    const provider = getEmailProvider();
    const sent = await provider.send({
      ...rendered,
      to: message.toEmail,
      from: env.EMAIL_FROM,
      workspaceId: message.workspaceId,
    });

    await db.emailMessage.update({
      where: { id: message.id },
      data: {
        status: "SENT",
        sentAt: new Date(),
        provider: provider.name,
        providerMessageId: sent.id,
        lastError: null,
      },
    });

    logger.info({ emailId: message.id, template, provider: provider.name }, "email sent");
    return "sent";
  } catch (error) {
    const finalAttempt = message.attempts >= MAX_ATTEMPTS;
    const delayMs = Math.min(2 ** message.attempts * 60_000, 60 * 60_000);

    await db.emailMessage.update({
      where: { id: message.id },
      data: {
        status: finalAttempt ? "FAILED" : "QUEUED",
        lastError: error instanceof AppError ? error.code.toLowerCase() : "provider_error",
        scheduledAt: new Date(Date.now() + delayMs),
      },
    });

    logger.error(
      {
        emailId: message.id,
        template: message.template,
        attempts: message.attempts,
        finalAttempt,
        errorName: error instanceof Error ? error.name : "UnknownError",
      },
      "email send failed",
    );

    return finalAttempt ? "failed" : "retried";
  }
}

export async function processEmailQueue(limit = 25): Promise<ProcessEmailQueueResult> {
  const safeLimit = Math.min(Math.max(1, limit), 100);
  const candidates = await db.emailMessage.findMany({
    where: {
      status: "QUEUED",
      scheduledAt: { lte: new Date() },
    },
    orderBy: { scheduledAt: "asc" },
    take: safeLimit,
  });

  const result: ProcessEmailQueueResult = {
    processed: 0,
    sent: 0,
    retried: 0,
    failed: 0,
  };

  for (const candidate of candidates) {
    const outcome = await deliverQueuedEmail(candidate.id);
    if (outcome === "skipped") {
      continue;
    }

    result.processed += 1;
    if (outcome === "sent") {
      result.sent += 1;
    } else if (outcome === "retried") {
      result.retried += 1;
    } else {
      result.failed += 1;
    }
  }

  return result;
}

/** Drains one specific outbox row, used by the admin "send test" action. */
export async function processEmailById(id: string): Promise<ProcessEmailQueueResult> {
  const outcome = await deliverQueuedEmail(id);

  return {
    processed: outcome === "skipped" ? 0 : 1,
    sent: outcome === "sent" ? 1 : 0,
    retried: outcome === "retried" ? 1 : 0,
    failed: outcome === "failed" ? 1 : 0,
  };
}
