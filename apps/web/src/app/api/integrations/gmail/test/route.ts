import { z } from "zod";
import { env } from "@/lib/env";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { fail, ok } from "@/lib/http";
import { apiHeaders, readJson, requestIdFor } from "@/server/api";
import { recordAudit, requestMeta } from "@/server/audit";
import { requireActor } from "@/server/auth/actor";
import { db } from "@/server/db";
import { getGmailStatus, isGmailConfigured } from "@/server/email/gmail";
import { enqueueEmail, processEmailById } from "@/server/email/service";
import { assertSameOrigin, authLimiter, enforceLimit } from "@/server/rate-limits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  to: z.string().trim().email().max(320).optional(),
});

export async function POST(request: Request) {
  const requestId = requestIdFor();

  try {
    assertSameOrigin(request);
    const actor = await requireActor("email:send");
    await enforceLimit(authLimiter, actor.userId);
    const body = await readJson(request, bodySchema);

    if (!isGmailConfigured()) {
      throw new AppError(
        ERROR_CODES.INTERNAL,
        "Gmail sending is not configured on this deployment.",
        { status: 503 },
      );
    }

    const connection = await getGmailStatus(actor.workspaceId);
    if (!connection.connected || !connection.email) {
      throw new AppError(
        ERROR_CODES.CONFLICT,
        "Connect a Gmail mailbox before sending a test email.",
      );
    }

    // A connected mailbox must not become an open relay for arbitrary recipients.
    if (body.to && body.to.toLowerCase() !== actor.email.toLowerCase()) {
      throw new AppError(
        ERROR_CODES.FORBIDDEN,
        "Test emails can only be sent to your own address.",
      );
    }
    const to = body.to ?? actor.email;
    const queued = await enqueueEmail({
      event: "email.test",
      to,
      workspaceId: actor.workspaceId,
      userId: actor.userId,
      idempotencyKey: `email-test:${actor.workspaceId}:${crypto.randomUUID()}`,
      payload: {
        name: actor.name,
        mailboxEmail: connection.email,
        workspaceName: actor.workspaceName,
        appUrl: env.APP_URL,
      },
    });

    if (!queued.id) {
      throw new AppError(ERROR_CODES.CONFLICT, "The test email was skipped by email preferences.");
    }

    const drain = await processEmailById(queued.id);
    const message = await db.emailMessage.findUnique({
      where: { id: queued.id },
      select: { status: true },
    });

    if (message?.status !== "SENT") {
      throw new AppError(
        ERROR_CODES.INTERNAL,
        "The test email was not delivered. Check the mailbox connection and try again.",
        { status: 502, details: { queueStatus: message?.status ?? "UNKNOWN" } },
      );
    }

    const meta = requestMeta(request);
    await recordAudit({
      workspaceId: actor.workspaceId,
      actorId: actor.userId,
      action: "email.test_sent",
      entity: "EmailMessage",
      entityId: queued.id,
      metadata: { provider: "gmail" },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return ok({ status: "SENT", messageId: queued.id, drain }, { headers: apiHeaders(requestId) });
  } catch (error) {
    return fail(error, requestId);
  }
}
