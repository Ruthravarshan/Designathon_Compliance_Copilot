import { describe, expect, it } from "vitest";
import { OAUTH_STATE_TTL_SECONDS, signOAuthState, verifyOAuthState } from "./oauth-state";

const secret = "test-oauth-state-secret-value-1234567890";
const base = {
  nonce: "0123456789abcdef0123456789abcdef",
  userId: "user_1",
  workspaceId: "ws_1",
  redirectUri: "https://app.example.com/api/integrations/gmail/callback",
};

describe("oauth state", () => {
  it("round-trips a signed state", () => {
    const token = signOAuthState(base, secret);
    const verified = verifyOAuthState(token, secret);

    expect(verified?.nonce).toBe(base.nonce);
    expect(verified?.workspaceId).toBe(base.workspaceId);
    expect(verified?.redirectUri).toBe(base.redirectUri);
  });

  it("rejects an expired state", () => {
    const token = signOAuthState(base, secret, 0);
    const expired = verifyOAuthState(token, secret, (OAUTH_STATE_TTL_SECONDS + 1) * 1000);
    expect(expired).toBeNull();
  });

  it("rejects a tampered payload", () => {
    const token = signOAuthState(base, secret);
    const [payload, signature] = token.split(".");
    const forgedPayload = Buffer.from(
      JSON.stringify({ ...base, workspaceId: "ws_2", exp: 9999999999 }),
      "utf8",
    ).toString("base64url");

    expect(verifyOAuthState(`${forgedPayload}.${signature}`, secret)).toBeNull();
    expect(verifyOAuthState(`${payload}.${signature}`, "other-secret")).toBeNull();
  });

  it("rejects non-http redirect uris and missing values", () => {
    const token = signOAuthState({ ...base, redirectUri: "javascript:alert(1)" }, secret);
    expect(verifyOAuthState(token, secret)).toBeNull();
    expect(verifyOAuthState(undefined, secret)).toBeNull();
    expect(verifyOAuthState("one-part", secret)).toBeNull();
    expect(verifyOAuthState(".", secret)).toBeNull();
  });
});
