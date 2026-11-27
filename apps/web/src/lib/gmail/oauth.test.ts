import { describe, expect, it } from "vitest";
import {
  GMAIL_SCOPES,
  buildGoogleAuthUrl,
  needsRefresh,
  parseTokenResponse,
  tokenExpiry,
} from "./oauth";

describe("buildGoogleAuthUrl", () => {
  it("requests offline access with the Gmail send scope", () => {
    const url = new URL(
      buildGoogleAuthUrl({
        clientId: "client-123",
        redirectUri: "https://app.example.com/api/integrations/gmail/callback",
        state: "signed-state",
        loginHint: "policypulse.hexa@gmail.com",
      }),
    );

    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(url.searchParams.get("client_id")).toBe("client-123");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("prompt")).toBe("consent");
    expect(url.searchParams.get("state")).toBe("signed-state");
    expect(url.searchParams.get("login_hint")).toBe("policypulse.hexa@gmail.com");
    expect(url.searchParams.get("scope")).toBe(GMAIL_SCOPES.join(" "));
  });

  it("omits login_hint when not provided", () => {
    const url = new URL(
      buildGoogleAuthUrl({
        clientId: "client-123",
        redirectUri: "http://localhost:3000/api/integrations/gmail/callback",
        state: "s",
      }),
    );
    expect(url.searchParams.has("login_hint")).toBe(false);
  });
});

describe("parseTokenResponse", () => {
  it("parses a valid token response", () => {
    const parsed = parseTokenResponse({
      access_token: "access",
      refresh_token: "refresh",
      expires_in: 3600,
      scope: "a b",
      token_type: "Bearer",
    });

    expect(parsed.accessToken).toBe("access");
    expect(parsed.refreshToken).toBe("refresh");
    expect(parsed.expiresInSeconds).toBe(3600);
    expect(parsed.tokenType).toBe("Bearer");
  });

  it("defaults the token type and omits a missing refresh token", () => {
    const parsed = parseTokenResponse({ access_token: "access", expires_in: 60 });
    expect(parsed.tokenType).toBe("Bearer");
    expect(parsed.refreshToken).toBeUndefined();
  });

  it("rejects malformed responses", () => {
    expect(() => parseTokenResponse(null)).toThrow();
    expect(() => parseTokenResponse({ access_token: "" })).toThrow();
    expect(() => parseTokenResponse({ access_token: "x", expires_in: -5 })).toThrow();
  });
});

describe("token expiry", () => {
  it("computes expiry and refresh windows", () => {
    const now = new Date("2026-11-27T10:00:00.000Z").getTime();
    const expiresAt = tokenExpiry(3600, now);

    expect(expiresAt.toISOString()).toBe("2026-11-27T11:00:00.000Z");
    expect(needsRefresh(expiresAt, now)).toBe(false);
    expect(needsRefresh(expiresAt, now + 3590 * 1000)).toBe(true);
    expect(needsRefresh(expiresAt, now + 3600 * 1000)).toBe(true);
  });
});
