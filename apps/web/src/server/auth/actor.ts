import "server-only";
import { cache } from "react";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { db } from "@/server/db";
import { assertCan, can, type Permission, type Role } from "./rbac";
import { readSession } from "./session";

export interface Actor {
  userId: string;
  name: string;
  email: string;
  workspaceId: string;
  workspaceName: string;
  workspaceSlug: string;
  membershipId: string;
  role: Role;
}

export const getActor = cache(async (): Promise<Actor | null> => {
  const session = await readSession();
  if (!session) {
    return null;
  }

  const membership = await db.membership.findFirst({
    where: { userId: session.userId, workspaceId: session.workspaceId },
    include: { user: true, workspace: true },
  });

  if (!membership) {
    return null;
  }

  return {
    userId: membership.userId,
    name: membership.user.name ?? membership.user.email,
    email: membership.user.email,
    workspaceId: membership.workspaceId,
    workspaceName: membership.workspace.name,
    workspaceSlug: membership.workspace.slug,
    membershipId: membership.id,
    role: membership.role,
  };
});

export async function requireActor(permission?: Permission): Promise<Actor> {
  const actor = await getActor();

  if (!actor) {
    throw new AppError(ERROR_CODES.UNAUTHORIZED, "Sign in to continue.");
  }

  if (permission) {
    assertCan(actor.role, permission);
  }

  return actor;
}

export function actorCan(actor: Actor, permission: Permission): boolean {
  return can(actor.role, permission);
}
