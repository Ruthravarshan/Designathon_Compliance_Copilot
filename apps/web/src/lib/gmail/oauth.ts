import { z } from "zod";

export const GMAIL_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/gmail.send",
] as const;

export const GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
export const GOOGLE_REVOKE_ENDPOINT = "https://oauth2.googleapis.com/revoke";
export const GOOGLE_USERINFO_ENDPOINT = "https://openidconnect.googleapis.com/v1/userinfo";
export const GMAIL_SEND_ENDPOINT = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";

const ACCESS_TOKEN_SKEW_MS = 60_000;

export interface AuthUrlInput {
  clientId: string;
  redirectUri: string;
  state: string;
  loginHint?: string;
}

export function buildGoogleAuthUrl(input: AuthUrlInput): string {
  const url = new URL(GOOGLE_AUTH_ENDPOINT);
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GMAIL_SCOPES.join(" "));
  url.searchParams.set("state", input.state);
  // offline + consent guarantees a refresh token on every connect.
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  if (input.loginHint) {
    url.searchParams.set("login_hint", input.loginHint);
  }
  return url.toString();
}

const tokenResponseSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().int().positive(),
  refresh_token: z.string().min(1).optional(),
  scope: z.string().optional(),
  token_type: z.string().optional(),
  id_token: z.string().optional(),
});

export interface ParsedTokenResponse {
  accessToken: string;
  refreshToken?: string;
  expiresInSeconds: number;
  scope?: string;
  tokenType: string;
}

export function parseTokenResponse(json: unknown): ParsedTokenResponse {
  const parsed = tokenResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error("Google returned an unexpected token response.");
  }

  return {
    accessToken: parsed.data.access_token,
    ...(parsed.data.refresh_token ? { refreshToken: parsed.data.refresh_token } : {}),
    expiresInSeconds: parsed.data.expires_in,
    ...(parsed.data.scope ? { scope: parsed.data.scope } : {}),
    tokenType: parsed.data.token_type ?? "Bearer",
  };
}

export function tokenExpiry(expiresInSeconds: number, now = Date.now()): Date {
  return new Date(now + expiresInSeconds * 1000);
}

export function needsRefresh(expiresAt: Date, now = Date.now()): boolean {
  return expiresAt.getTime() - ACCESS_TOKEN_SKEW_MS <= now;
}
