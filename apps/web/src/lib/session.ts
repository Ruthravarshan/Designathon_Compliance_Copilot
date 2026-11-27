import { createHmac, timingSafeEqual } from "node:crypto";

export interface SessionPayload {
  userId: string;
  workspaceId: string;
  exp: number;
  /** Must match the user's current sessionVersion; bumped on sign-out/privilege change. */
  version: number;
}

export const SESSION_TTL_SECONDS = 60 * 60 * 8;

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function encodePayload(payload: SessionPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodePayload(value: string): SessionPayload | null {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (typeof parsed !== "object" || parsed === null) {
      return null;
    }

    const candidate = parsed as Partial<SessionPayload>;
    if (
      typeof candidate.userId !== "string" ||
      candidate.userId.length === 0 ||
      typeof candidate.workspaceId !== "string" ||
      candidate.workspaceId.length === 0 ||
      typeof candidate.exp !== "number" ||
      !Number.isFinite(candidate.exp) ||
      typeof candidate.version !== "number" ||
      !Number.isInteger(candidate.version) ||
      candidate.version < 0
    ) {
      return null;
    }

    return {
      userId: candidate.userId,
      workspaceId: candidate.workspaceId,
      exp: candidate.exp,
      version: candidate.version,
    };
  } catch {
    return null;
  }
}

export function signSession(
  input: { userId: string; workspaceId: string; version?: number },
  secret: string,
  now = Date.now(),
): string {
  const payload = encodePayload({
    userId: input.userId,
    workspaceId: input.workspaceId,
    exp: Math.floor(now / 1000) + SESSION_TTL_SECONDS,
    version: input.version ?? 0,
  });

  return `${payload}.${sign(payload, secret)}`;
}

export function verifySession(
  token: string | undefined,
  secret: string,
  now = Date.now(),
): SessionPayload | null {
  if (!token) {
    return null;
  }

  const parts = token.split(".");
  if (parts.length !== 2) {
    return null;
  }

  const [payload, signature] = parts;
  if (!payload || !signature) {
    return null;
  }

  const expected = sign(payload, secret);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (
    actualBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    return null;
  }

  const decoded = decodePayload(payload);
  if (!decoded) {
    return null;
  }

  if (decoded.exp * 1000 <= now) {
    return null;
  }

  return decoded;
}
