import "server-only";
import type { GmailAccount } from "@prisma/client";
import { z } from "zod";
import { env } from "@/lib/env";
import { buildMimeMessage, encodeBase64Url } from "@/lib/gmail/mime";
import {
  GMAIL_SCOPES,
  GMAIL_SEND_ENDPOINT,
  GOOGLE_REVOKE_ENDPOINT,
  GOOGLE_TOKEN_ENDPOINT,
  GOOGLE_USERINFO_ENDPOINT,
  buildGoogleAuthUrl,
  needsRefresh,
  parseTokenResponse,
  tokenExpiry,
  type ParsedTokenResponse,
} from "@/lib/gmail/oauth";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { decryptToken, encryptToken, parseEncryptionKey } from "@/lib/token-crypto";
import { db } from "@/server/db";
import type { EmailProvider, OutboundEmail } from "./provider";

const CALLBACK_PATH = "/api/integrations/gmail/callback";
const TOKEN_TIMEOUT_MS = 10_000;
const SEND_TIMEOUT_MS = 15_000;

export const GMAIL_STATE_COOKIE = "gmail_oauth_state";
export const GMAIL_OAUTH_PATH = "/api/integrations/gmail";
export const GMAIL_STATE_TTL_SECONDS = 10 * 60;

export type GmailConnectionStatus = "CONNECTED" | "REVOKED" | "ERROR";

export interface GmailStatusSummary {
  provider: "gmail";
  configured: boolean;
  connected: boolean;
  status: GmailConnectionStatus | null;
  email: string | null;
  scope: string | null;
  expiresAt: string | null;
  lastRefreshedAt: string | null;
  lastErrorCode: string | null;
}

interface GmailConfig {
  clientId: string;
  clientSecret: string;
  key: Buffer;
}

interface TokenHttpResult {
  ok: boolean;
  status: number;
  json: unknown;
}

export function isGmailConfigured(): boolean {
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.TOKEN_ENCRYPTION_KEY);
}

function gmailConfig(): GmailConfig {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.TOKEN_ENCRYPTION_KEY) {
    throw new AppError(
      ERROR_CODES.INTERNAL,
      "Gmail sending is not configured. Add GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and TOKEN_ENCRYPTION_KEY.",
      { status: 503 },
    );
  }

  try {
    return {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      key: parseEncryptionKey(env.TOKEN_ENCRYPTION_KEY),
    };
  } catch {
    throw new AppError(
      ERROR_CODES.INTERNAL,
      "TOKEN_ENCRYPTION_KEY is invalid. It must decode to 32 bytes.",
      { status: 503 },
    );
  }
}

export function resolveRedirectUri(origin: string): string {
  return env.GOOGLE_REDIRECT_URI ?? new URL(CALLBACK_PATH, origin).toString();
}

export function createGmailConnectUrl(input: {
  origin: string;
  state: string;
  loginHint?: string;
}): { url: string; redirectUri: string } {
  const { clientId } = gmailConfig();
  const redirectUri = resolveRedirectUri(input.origin);
  return {
    redirectUri,
    url: buildGoogleAuthUrl({
      clientId,
      redirectUri,
      state: input.state,
      ...(input.loginHint ? { loginHint: input.loginHint } : {}),
    }),
  };
}

async function postForm(url: string, body: URLSearchParams): Promise<TokenHttpResult> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
    signal: AbortSignal.timeout(TOKEN_TIMEOUT_MS),
  });

  let json: unknown = null;
  try {
    json = await response.json();
  } catch {
    json = null;
  }

  return { ok: response.ok, status: response.status, json };
}

const googleErrorSchema = z.object({ error: z.string().max(100) });

function googleErrorCode(json: unknown): string | null {
  const parsed = googleErrorSchema.safeParse(json);
  if (!parsed.success) {
    return null;
  }
  return parsed.data.error === "invalid_grant" ? "invalid_grant" : "oauth_error";
}

async function exchangeCode(code: string, redirectUri: string): Promise<ParsedTokenResponse> {
  const { clientId, clientSecret } = gmailConfig();
  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });

  let result: TokenHttpResult;
  try {
    result = await postForm(GOOGLE_TOKEN_ENDPOINT, body);
  } catch {
    throw new AppError(ERROR_CODES.INTERNAL, "Could not reach Google to finish sign-in.", {
      status: 502,
    });
  }

  if (!result.ok) {
    if (googleErrorCode(result.json) === "invalid_grant") {
      throw new AppError(
        ERROR_CODES.BAD_REQUEST,
        "Google rejected the authorization code. Connect the mailbox again.",
      );
    }
    throw new AppError(ERROR_CODES.INTERNAL, "Google sign-in could not be completed.", {
      status: 502,
    });
  }

  try {
    return parseTokenResponse(result.json);
  } catch {
    throw new AppError(ERROR_CODES.INTERNAL, "Google returned an unexpected token response.", {
      status: 502,
    });
  }
}

const userInfoSchema = z.object({
  email: z.string().email().max(320),
  email_verified: z.boolean().optional(),
  verified_email: z.boolean().optional(),
});

async function fetchVerifiedEmail(accessToken: string): Promise<string> {
  let response: Response;
  try {
    response = await fetch(GOOGLE_USERINFO_ENDPOINT, {
      headers: { authorization: `Bearer ${accessToken}` },
      cache: "no-store",
      signal: AbortSignal.timeout(TOKEN_TIMEOUT_MS),
    });
  } catch {
    throw new AppError(ERROR_CODES.INTERNAL, "Could not read the Google account profile.", {
      status: 502,
    });
  }

  if (!response.ok) {
    throw new AppError(ERROR_CODES.INTERNAL, "Could not read the Google account profile.", {
      status: 502,
    });
  }

  const parsed = userInfoSchema.safeParse(await response.json().catch(() => null));
  if (!parsed.success) {
    throw new AppError(ERROR_CODES.INTERNAL, "Google returned an unexpected profile.", {
      status: 502,
    });
  }

  const verified = parsed.data.email_verified ?? parsed.data.verified_email ?? false;
  if (!verified) {
    throw new AppError(ERROR_CODES.BAD_REQUEST, "The Google account email is not verified.");
  }

  return parsed.data.email.toLowerCase();
}

function summaryFor(
  account: GmailAccount | null,
  overrides: Partial<GmailStatusSummary> = {},
): GmailStatusSummary {
  return {
    provider: "gmail",
    configured: isGmailConfigured(),
    connected: account?.status === "CONNECTED",
    status: account ? (account.status as GmailConnectionStatus) : null,
    email: account?.email ?? null,
    scope: account?.scope ?? null,
    expiresAt: account?.expiresAt.toISOString() ?? null,
    lastRefreshedAt: account?.lastRefreshedAt?.toISOString() ?? null,
    lastErrorCode: account?.lastErrorCode ?? null,
    ...overrides,
  };
}

export async function getGmailAccount(workspaceId: string): Promise<GmailAccount | null> {
  return db.gmailAccount.findUnique({ where: { workspaceId } });
}

export async function connectGmailAccount(input: {
  workspaceId: string;
  userId: string;
  code: string;
  redirectUri: string;
}): Promise<GmailStatusSummary> {
  const tokens = await exchangeCode(input.code, input.redirectUri);
  const email = await fetchVerifiedEmail(tokens.accessToken);

  const existing = await getGmailAccount(input.workspaceId);
  const refreshToken =
    tokens.refreshToken ??
    (existing ? decryptToken(existing.refreshTokenEnc, gmailConfig().key) : null);

  if (!refreshToken) {
    throw new AppError(
      ERROR_CODES.BAD_REQUEST,
      "Google did not return a refresh token. Remove the app from the Google account and connect again.",
    );
  }

  const key = gmailConfig().key;
  const expiresAt = tokenExpiry(tokens.expiresInSeconds);
  const scope = tokens.scope ?? GMAIL_SCOPES.join(" ");
  const now = new Date();

  const account = await db.gmailAccount.upsert({
    where: { workspaceId: input.workspaceId },
    update: {
      email,
      accessTokenEnc: encryptToken(tokens.accessToken, key),
      refreshTokenEnc: encryptToken(refreshToken, key),
      tokenType: tokens.tokenType,
      scope,
      expiresAt,
      status: "CONNECTED",
      lastErrorCode: null,
      connectedById: input.userId,
      connectedAt: now,
      lastRefreshedAt: now,
      revokedAt: null,
    },
    create: {
      workspaceId: input.workspaceId,
      email,
      accessTokenEnc: encryptToken(tokens.accessToken, key),
      refreshTokenEnc: encryptToken(refreshToken, key),
      tokenType: tokens.tokenType,
      scope,
      expiresAt,
      status: "CONNECTED",
      connectedById: input.userId,
      connectedAt: now,
      lastRefreshedAt: now,
    },
  });

  return summaryFor(account);
}

async function refreshAccount(
  account: GmailAccount,
): Promise<{ accessToken: string; account: GmailAccount }> {
  const { clientId, clientSecret, key } = gmailConfig();
  const refreshToken = decryptToken(account.refreshTokenEnc, key);

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  let result: TokenHttpResult;
  try {
    result = await postForm(GOOGLE_TOKEN_ENDPOINT, body);
  } catch {
    throw new AppError(ERROR_CODES.INTERNAL, "Could not reach Google to refresh Gmail access.", {
      status: 502,
    });
  }

  if (!result.ok) {
    if (googleErrorCode(result.json) === "invalid_grant") {
      await db.gmailAccount.update({
        where: { id: account.id },
        data: { status: "REVOKED", lastErrorCode: "invalid_grant", revokedAt: new Date() },
      });
      throw new AppError(
        ERROR_CODES.CONFLICT,
        "Google revoked this mailbox connection. Reconnect the account.",
      );
    }

    await db.gmailAccount.update({
      where: { id: account.id },
      data: { status: "ERROR", lastErrorCode: "refresh_failed" },
    });
    throw new AppError(ERROR_CODES.INTERNAL, "Gmail token refresh failed. Reconnect the account.", {
      status: 502,
    });
  }

  let tokens: ParsedTokenResponse;
  try {
    tokens = parseTokenResponse(result.json);
  } catch {
    throw new AppError(ERROR_CODES.INTERNAL, "Google returned an unexpected token response.", {
      status: 502,
    });
  }

  const updated = await db.gmailAccount.update({
    where: { id: account.id },
    data: {
      accessTokenEnc: encryptToken(tokens.accessToken, key),
      expiresAt: tokenExpiry(tokens.expiresInSeconds),
      lastRefreshedAt: new Date(),
      status: "CONNECTED",
      lastErrorCode: null,
      ...(tokens.scope ? { scope: tokens.scope } : {}),
    },
  });

  return { accessToken: tokens.accessToken, account: updated };
}

async function getValidAccessToken(
  account: GmailAccount,
): Promise<{ accessToken: string; account: GmailAccount }> {
  if (account.status !== "CONNECTED") {
    throw new AppError(
      ERROR_CODES.CONFLICT,
      "The Gmail connection is not active. Reconnect the mailbox in Settings.",
    );
  }

  if (needsRefresh(account.expiresAt)) {
    return refreshAccount(account);
  }

  return {
    accessToken: decryptToken(account.accessTokenEnc, gmailConfig().key),
    account,
  };
}

async function findSenderAccount(workspaceId: string | null | undefined): Promise<GmailAccount> {
  // Never fall back to an arbitrary connected mailbox: that would send one
  // tenant's mail through another tenant's connected account.
  if (!workspaceId) {
    throw new AppError(ERROR_CODES.BAD_REQUEST, "A workspace is required to send email.");
  }

  const account = await db.gmailAccount.findUnique({ where: { workspaceId } });
  if (!account) {
    throw new AppError(
      ERROR_CODES.CONFLICT,
      "Gmail is not connected. Open Settings -> Email and connect a mailbox.",
    );
  }
  return account;
}

const sendResponseSchema = z.object({ id: z.string().min(1) });

async function postSend(accessToken: string, raw: string): Promise<Response> {
  return fetch(GMAIL_SEND_ENDPOINT, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ raw }),
    cache: "no-store",
    signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
  });
}

export async function sendViaGmail(input: {
  to: string;
  subject: string;
  html: string;
  text: string;
  workspaceId?: string | null;
}): Promise<{ id: string }> {
  const account = await findSenderAccount(input.workspaceId);
  if (!account) {
    throw new AppError(
      ERROR_CODES.CONFLICT,
      "Gmail is not connected. Open Settings -> Email and connect a mailbox.",
    );
  }
  if (account.status !== "CONNECTED") {
    throw new AppError(
      ERROR_CODES.CONFLICT,
      "The Gmail connection is not active. Reconnect the mailbox in Settings.",
    );
  }

  const valid = await getValidAccessToken(account);
  const raw = encodeBase64Url(
    buildMimeMessage({
      from: { name: env.GMAIL_FROM_NAME, email: account.email },
      to: input.to,
      replyTo: account.email,
      subject: input.subject,
      html: input.html,
      text: input.text,
    }),
  );

  let response: Response;
  try {
    response = await postSend(valid.accessToken, raw);
  } catch {
    throw new AppError(ERROR_CODES.INTERNAL, "Could not reach the Gmail API.", { status: 502 });
  }

  if (response.status === 401) {
    const refreshed = await refreshAccount(valid.account);
    try {
      response = await postSend(refreshed.accessToken, raw);
    } catch {
      throw new AppError(ERROR_CODES.INTERNAL, "Could not reach the Gmail API.", { status: 502 });
    }
  }

  if (!response.ok) {
    logger.error({ provider: "gmail", status: response.status }, "gmail send rejected");
    const message =
      response.status === 429
        ? "Gmail rate-limited the message. It will retry."
        : "Gmail rejected the message.";
    throw new AppError(
      response.status === 429 ? ERROR_CODES.RATE_LIMITED : ERROR_CODES.INTERNAL,
      message,
      { status: 502 },
    );
  }

  const parsed = sendResponseSchema.safeParse(await response.json().catch(() => null));
  if (!parsed.success) {
    throw new AppError(ERROR_CODES.INTERNAL, "Gmail returned an unexpected response.", {
      status: 502,
    });
  }

  return { id: parsed.data.id };
}

export function createGmailProvider(): EmailProvider {
  return {
    name: "gmail",
    async send(message: OutboundEmail) {
      return sendViaGmail({
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
        workspaceId: message.workspaceId ?? null,
      });
    },
  };
}

export async function disconnectGmail(workspaceId: string): Promise<boolean> {
  const account = await getGmailAccount(workspaceId);
  if (!account) {
    return false;
  }

  try {
    const refreshToken = decryptToken(account.refreshTokenEnc, gmailConfig().key);
    await fetch(`${GOOGLE_REVOKE_ENDPOINT}?token=${encodeURIComponent(refreshToken)}`, {
      method: "POST",
      cache: "no-store",
      signal: AbortSignal.timeout(TOKEN_TIMEOUT_MS),
    });
  } catch {
    logger.warn({ provider: "gmail" }, "gmail token revoke was not confirmed; deleting the row");
  }

  await db.gmailAccount.delete({ where: { id: account.id } });
  return true;
}

/**
 * Stored status by default. With checkLive, a real Google call proves the token
 * still works before the UI shows a connected badge.
 */
export async function getGmailStatus(
  workspaceId: string,
  options: { checkLive?: boolean } = {},
): Promise<GmailStatusSummary> {
  const account = await getGmailAccount(workspaceId);

  if (options.checkLive && account && account.status === "CONNECTED") {
    if (!isGmailConfigured()) {
      return summaryFor(account, { lastErrorCode: "not_configured" });
    }

    try {
      const valid = await getValidAccessToken(account);
      await fetchVerifiedEmail(valid.accessToken);
    } catch {
      const latest = await getGmailAccount(workspaceId);
      return summaryFor(latest, { lastErrorCode: latest?.lastErrorCode ?? "live_check_failed" });
    }
  }

  return summaryFor(account);
}
