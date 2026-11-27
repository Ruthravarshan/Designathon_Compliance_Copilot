import "server-only";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { AppError, ERROR_CODES } from "@/lib/errors";
import {
  SESSION_TTL_SECONDS,
  signSession,
  verifySession,
  type SessionPayload,
} from "@/lib/session";

export const SESSION_COOKIE = "hexa_session";
const DEV_SECRET = "hexa-demo-only-session-secret-change-this-value";

function secret(): string {
  if (env.AUTH_SECRET) {
    return env.AUTH_SECRET;
  }

  if (env.DEMO_MODE_ENABLED && env.NODE_ENV !== "production") {
    return DEV_SECRET;
  }

  throw new AppError(ERROR_CODES.INTERNAL, "Authentication is not configured.", { expose: false });
}

export async function createSession(userId: string, workspaceId: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, signSession({ userId, workspaceId }, secret()), {
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
  return verifySession(store.get(SESSION_COOKIE)?.value, secret());
}
