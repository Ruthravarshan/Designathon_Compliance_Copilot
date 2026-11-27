import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/server/db";

type AuditClient = Pick<typeof db, "auditLog"> | Prisma.TransactionClient;

export interface AuditInput {
  workspaceId?: string | null;
  actorId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
  ip?: string | null;
  userAgent?: string | null;
}

export async function recordAudit(input: AuditInput, client: AuditClient = db): Promise<void> {
  await client.auditLog.create({
    data: {
      workspaceId: input.workspaceId ?? null,
      actorId: input.actorId ?? null,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId ?? null,
      ...(input.metadata ? { metadata: input.metadata as unknown as Prisma.InputJsonValue } : {}),
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
    },
  });
}

export function requestMeta(request: Request): { ip: string | null; userAgent: string | null } {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded
    ? (forwarded.split(",")[0]?.trim() ?? null)
    : request.headers.get("x-real-ip");
  return {
    ip: ip || null,
    userAgent: request.headers.get("user-agent"),
  };
}
