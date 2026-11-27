import "server-only";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import {
  SESSION_TTL_SECONDS,
  signSession,
  verifySession,
  type SessionPayload,
} from "@/lib/session";
import { authSecret } from "./secret";

export const SESSION_COOKIE = "hexa_session";

export async function createSession(userId: string, workspaceId: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, signSession({ userId, workspaceId }, authSecret()), {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function clearSession(): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export async function readSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  return verifySession(store.get(SESSION_COOKIE)?.value, authSecret());
}
