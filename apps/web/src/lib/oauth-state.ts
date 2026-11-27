import { createHmac, timingSafeEqual } from "node:crypto";

export interface OAuthStatePayload {
  nonce: string;
  userId: string;
  workspaceId: string;
  redirectUri: string;
  exp: number;
}

export const OAUTH_STATE_TTL_SECONDS = 10 * 60;

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function decodePayload(value: string): OAuthStatePayload | null {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (typeof parsed !== "object" || parsed === null) {
      return null;
    }

    const candidate = parsed as Partial<OAuthStatePayload>;
    if (
      typeof candidate.nonce !== "string" ||
      candidate.nonce.length < 16 ||
      typeof candidate.userId !== "string" ||
      candidate.userId.length === 0 ||
      typeof candidate.workspaceId !== "string" ||
      candidate.workspaceId.length === 0 ||
      typeof candidate.redirectUri !== "string" ||
      !isHttpUrl(candidate.redirectUri) ||
      typeof candidate.exp !== "number" ||
      !Number.isFinite(candidate.exp)
    ) {
      return null;
    }

    return {
      nonce: candidate.nonce,
      userId: candidate.userId,
      workspaceId: candidate.workspaceId,
      redirectUri: candidate.redirectUri,
      exp: candidate.exp,
    };
  } catch {
    return null;
  }
}

export function signOAuthState(
  input: Omit<OAuthStatePayload, "exp">,
  secret: string,
  now = Date.now(),
): string {
  const payload = Buffer.from(
    JSON.stringify({ ...input, exp: Math.floor(now / 1000) + OAUTH_STATE_TTL_SECONDS }),
    "utf8",
  ).toString("base64url");

  return `${payload}.${sign(payload, secret)}`;
}

export function verifyOAuthState(
  token: string | undefined,
  secret: string,
  now = Date.now(),
): OAuthStatePayload | null {
  if (!token) {
    return null;
  }

  const parts = token.split(".");
  if (parts.length !== 2) {
    return null;
  }

  const payload = parts[0] ?? "";
  const signature = parts[1] ?? "";
  if (!payload || !signature) {
    return null;
  }

  const expected = Buffer.from(sign(payload, secret));
  const actual = Buffer.from(signature);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return null;
  }

  const decoded = decodePayload(payload);
  if (!decoded || decoded.exp * 1000 <= now) {
    return null;
  }

  return decoded;
}
