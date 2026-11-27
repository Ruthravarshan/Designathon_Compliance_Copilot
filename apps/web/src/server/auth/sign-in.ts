import "server-only";
import { env } from "@/lib/env";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { db } from "@/server/db";
import { recordAudit, requestMeta } from "@/server/audit";
import { DEMO_PERSONAS, personaByKey } from "@/server/compliance/corpus";
import type { Actor } from "./actor";
import { createSession } from "./session";

export { DEMO_PERSONAS };

export async function signInWithPersona(personaKey: string, request: Request): Promise<Actor> {
  if (!env.DEMO_MODE_ENABLED) {
    throw new AppError(ERROR_CODES.FORBIDDEN, "Demo sign-in is disabled in this environment.");
  }
  // Defence in depth: never mint a privileged persona session in production
  // without the explicit opt-in, even if the env module is changed later.
  if (env.NODE_ENV === "production" && env.ALLOW_DEMO_MODE_IN_PRODUCTION !== "true") {
    throw new AppError(ERROR_CODES.FORBIDDEN, "Demo sign-in is disabled in production.");
  }

  const persona = personaByKey(personaKey);
  if (!persona) {
    throw new AppError(ERROR_CODES.BAD_REQUEST, "Choose a seeded demo persona.");
  }

  const user = await db.user.findUnique({
    where: { email: persona.email },
    include: { memberships: { include: { workspace: true } } },
  });

  const membership = user?.memberships.find((row) => row.workspace.slug === persona.workspaceSlug);

  if (!user || !membership) {
    throw new AppError(ERROR_CODES.CONFLICT, "The demo workspace is not seeded.");
  }

  await createSession(user.id, membership.workspaceId, user.sessionVersion);

  const meta = requestMeta(request);
  await recordAudit({
    workspaceId: membership.workspaceId,
    actorId: user.id,
    action: "auth.signed_in",
    entity: "User",
    entityId: user.id,
    metadata: { persona: persona.key },
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  return {
    userId: user.id,
    name: user.name ?? user.email,
    email: user.email,
    workspaceId: membership.workspaceId,
    workspaceName: membership.workspace.name,
    workspaceSlug: membership.workspace.slug,
    membershipId: membership.id,
    role: membership.role,
  };
}
