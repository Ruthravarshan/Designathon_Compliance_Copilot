import "server-only";
import { Prisma } from "@prisma/client";
import { env } from "@/lib/env";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { assessPolicy, type PolicyAssessment } from "@/lib/policy/check";
import { db } from "@/server/db";
import { recordAudit } from "@/server/audit";
import { enqueueEmail } from "@/server/email/service";
import type { Actor } from "@/server/auth/actor";

export interface PolicyRow {
  id: string;
  code: string;
  title: string;
  version: string;
  section: string;
  ownerName: string;
  ownerEmail: string;
  reviewedAt: Date | null;
  assessment: PolicyAssessment;
  lastCheck: {
    result: string;
    score: number;
    createdAt: Date;
    actorName: string | null;
  } | null;
}

export interface PolicyCheckSummary {
  id: string;
  policyId: string;
  policyCode: string;
  result: string;
  score: number;
  openFindings: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  overdue: number;
  summary: string;
  notified: number;
  checkedAt: string;
}

function emptyAssessment(): PolicyAssessment {
  return assessPolicy([], new Date());
}

async function workspaceFindings(workspaceId: string, policyId?: string) {
  return db.finding.findMany({
    where: { workspaceId, ...(policyId ? { policyId } : { policyId: { not: null } }) },
    select: {
      policyId: true,
      severity: true,
      reviewStatus: true,
      dueDate: true,
    },
  });
}

export async function listPolicies(actor: Actor): Promise<PolicyRow[]> {
  const [policies, findings, checks] = await Promise.all([
    db.internalPolicy.findMany({
      where: { workspaceId: actor.workspaceId },
      orderBy: [{ section: "asc" }, { code: "asc" }],
    }),
    workspaceFindings(actor.workspaceId),
    db.policyCheck.findMany({
      where: { workspaceId: actor.workspaceId },
      orderBy: { createdAt: "desc" },
      select: {
        policyId: true,
        result: true,
        score: true,
        createdAt: true,
        actorName: true,
      },
    }),
  ]);

  const byPolicy = new Map<string, typeof findings>();
  for (const finding of findings) {
    if (!finding.policyId) {
      continue;
    }
    const bucket = byPolicy.get(finding.policyId) ?? [];
    bucket.push(finding);
    byPolicy.set(finding.policyId, bucket);
  }

  const lastCheck = new Map<string, (typeof checks)[number]>();
  for (const check of checks) {
    if (!lastCheck.has(check.policyId)) {
      lastCheck.set(check.policyId, check);
    }
  }

  return policies.map((policy) => {
    const rows = byPolicy.get(policy.id);
    const assessment = rows ? assessPolicy(rows, new Date()) : emptyAssessment();
    const check = lastCheck.get(policy.id) ?? null;
    return {
      id: policy.id,
      code: policy.code,
      title: policy.title,
      version: policy.version,
      section: policy.section,
      ownerName: policy.ownerName,
      ownerEmail: policy.ownerEmail,
      reviewedAt: policy.reviewedAt,
      assessment,
      lastCheck: check
        ? {
            result: check.result,
            score: check.score,
            createdAt: check.createdAt,
            actorName: check.actorName,
          }
        : null,
    };
  });
}

export async function getPolicyDetail(actor: Actor, policyId: string) {
  const policy = await db.internalPolicy.findFirst({
    where: { id: policyId, workspaceId: actor.workspaceId },
  });
  if (!policy) {
    throw new AppError(ERROR_CODES.NOT_FOUND, "Policy not found.");
  }

  const [findings, checks] = await Promise.all([
    db.finding.findMany({
      where: { workspaceId: actor.workspaceId, policyId: policy.id },
      include: {
        document: { select: { id: true, reference: true, title: true } },
        obligation: { select: { reference: true } },
      },
      orderBy: [{ dueDate: "asc" }, { severity: "asc" }],
      take: 50,
    }),
    db.policyCheck.findMany({
      where: { workspaceId: actor.workspaceId, policyId: policy.id },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
  ]);

  const assessment = findings.length === 0 ? emptyAssessment() : assessPolicy(findings, new Date());
  return { policy, findings, checks, assessment };
}

async function notifyPolicyCheck(input: {
  actor: Actor;
  policyId: string;
  policyCode: string;
  policyTitle: string;
  ownerEmail: string;
  checkId: string;
  result: string;
  summary: string;
  openFindings: number;
  critical: number;
  high: number;
  overdue: number;
}): Promise<number> {
  if (input.result === "COMPLIANT") {
    return 0;
  }

  const owner = await db.membership.findFirst({
    where: { workspaceId: input.actor.workspaceId, role: "OWNER" },
    include: { user: true },
    orderBy: { createdAt: "asc" },
  });

  const recipients = new Set<string>();
  if (input.ownerEmail.trim() !== "") {
    recipients.add(input.ownerEmail.trim().toLowerCase());
  }
  if (owner?.user.email) {
    recipients.add(owner.user.email.toLowerCase());
  }

  const users = await db.user.findMany({
    where: { email: { in: [...recipients] } },
    select: { id: true, email: true },
  });
  const userIdByEmail = new Map(users.map((user) => [user.email.toLowerCase(), user.id]));
  let sent = 0;

  for (const email of recipients) {
    try {
      const userId = userIdByEmail.get(email);
      const result = await enqueueEmail({
        event: "policy.check.alert",
        to: email,
        ...(userId ? { userId } : {}),
        workspaceId: input.actor.workspaceId,
        idempotencyKey: `policy-check-${input.checkId}-${email}`,
        payload: {
          name: input.policyTitle,
          workspaceName: input.actor.workspaceName,
          policyTitle: input.policyTitle,
          policyCode: input.policyCode,
          result: input.result.replace("_", " "),
          summary: input.summary,
          openFindings: input.openFindings,
          critical: input.critical,
          high: input.high,
          overdue: input.overdue,
          policyUrl: `${env.APP_URL}/app/policies/${input.policyId}`,
          preferencesUrl: `${env.APP_URL}/app/settings/email`,
        },
      });
      if (result.status === "queued") {
        sent += 1;
      }
    } catch {
      logger.warn(
        { workspaceId: input.actor.workspaceId, policyId: input.policyId },
        "policy check email failed",
      );
    }
  }

  return sent;
}

export async function checkPolicyCompliance(
  actor: Actor,
  policyId: string,
): Promise<PolicyCheckSummary> {
  const policy = await db.internalPolicy.findFirst({
    where: { id: policyId, workspaceId: actor.workspaceId },
  });
  if (!policy) {
    throw new AppError(ERROR_CODES.NOT_FOUND, "Policy not found.");
  }

  const findings = await db.finding.findMany({
    where: { workspaceId: actor.workspaceId, policyId: policy.id },
    select: {
      id: true,
      severity: true,
      reviewStatus: true,
      dueDate: true,
      status: true,
    },
  });

  const now = new Date();
  const assessment = assessPolicy(findings, now);

  const check = await db.policyCheck.create({
    data: {
      workspaceId: actor.workspaceId,
      policyId: policy.id,
      result: assessment.result,
      score: assessment.score,
      openFindings: assessment.open,
      critical: assessment.critical,
      high: assessment.high,
      medium: assessment.medium,
      low: assessment.low,
      overdue: assessment.overdue,
      summary: assessment.summary,
      details: {
        findings: findings.slice(0, 40),
      } as unknown as Prisma.InputJsonValue,
      actorId: actor.userId,
      actorName: actor.name,
      trigger: "MANUAL",
    },
  });

  await recordAudit({
    workspaceId: actor.workspaceId,
    actorId: actor.userId,
    action: "policy.compliance_check",
    entity: "InternalPolicy",
    entityId: policy.id,
    metadata: {
      checkId: check.id,
      result: assessment.result,
      score: assessment.score,
      open: assessment.open,
      critical: assessment.critical,
      high: assessment.high,
      overdue: assessment.overdue,
    },
  });

  const notified = await notifyPolicyCheck({
    actor,
    policyId: policy.id,
    policyCode: policy.code,
    policyTitle: policy.title,
    ownerEmail: policy.ownerEmail,
    checkId: check.id,
    result: assessment.result,
    summary: assessment.summary,
    openFindings: assessment.open,
    critical: assessment.critical,
    high: assessment.high,
    overdue: assessment.overdue,
  });

  return {
    id: check.id,
    policyId: policy.id,
    policyCode: policy.code,
    result: assessment.result,
    score: assessment.score,
    openFindings: assessment.open,
    critical: assessment.critical,
    high: assessment.high,
    medium: assessment.medium,
    low: assessment.low,
    overdue: assessment.overdue,
    summary: assessment.summary,
    notified,
    checkedAt: check.createdAt.toISOString(),
  };
}
