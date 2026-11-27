import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { signSession, verifySession } from "./session";

const secret = "test-session-secret-at-least-32-characters";
const now = Date.parse("2026-11-10T09:00:00.000Z");
const input = { userId: "user_1", workspaceId: "ws_1" };

describe("session tokens", () => {
  it("round-trips a signed session", () => {
    const token = signSession(input, secret, now);
    const payload = verifySession(token, secret, now + 1000);

    expect(payload?.userId).toBe("user_1");
    expect(payload?.workspaceId).toBe("ws_1");
    expect(payload?.exp).toBe(Math.floor(now / 1000) + 8 * 60 * 60);
  });

  it("rejects a tampered payload", () => {
    const token = signSession(input, secret, now);
    const [payload, signature] = token.split(".");
    const forged = `${Buffer.from(
      JSON.stringify({ userId: "user_2", workspaceId: "ws_1", exp: 9999999999 }),
    ).toString("base64url")}.${signature}`;

    expect(payload).toBeDefined();
    expect(verifySession(forged, secret, now)).toBeNull();
  });

  it("rejects a token signed with another secret", () => {
    const token = signSession(input, `${secret}-other`, now);
    expect(verifySession(token, secret, now)).toBeNull();
  });

  it("rejects an expired token", () => {
    const token = signSession(input, secret, now);
    expect(verifySession(token, secret, now + 9 * 60 * 60 * 1000)).toBeNull();
  });

  it("rejects missing and malformed tokens", () => {
    expect(verifySession(undefined, secret, now)).toBeNull();
    expect(verifySession("", secret, now)).toBeNull();
    expect(verifySession("one-part", secret, now)).toBeNull();
    expect(verifySession("a.b.c", secret, now)).toBeNull();
    expect(verifySession(".signature", secret, now)).toBeNull();
    expect(verifySession("payload.", secret, now)).toBeNull();
  });

  it("rejects a token whose signature has the wrong length", () => {
    const token = signSession(input, secret, now);
    const [payload] = token.split(".");
    expect(verifySession(`${payload}.short`, secret, now)).toBeNull();
  });

  it("rejects a correctly signed but invalid payload", () => {
    const payload = Buffer.from(JSON.stringify({ userId: "user_1" }), "utf8").toString("base64url");
    const token = `${payload}.${createHmac("sha256", secret).update(payload).digest("base64url")}`;

    expect(verifySession(token, secret, now)).toBeNull();
  });

  it("rejects a signed non-object payload", () => {
    const payload = Buffer.from(JSON.stringify("just-a-string"), "utf8").toString("base64url");
    const token = `${payload}.${createHmac("sha256", secret).update(payload).digest("base64url")}`;

    expect(verifySession(token, secret, now)).toBeNull();
  });

  it("rejects a signed payload that is not JSON", () => {
    const payload = Buffer.from("not-json", "utf8").toString("base64url");
    const token = `${payload}.${createHmac("sha256", secret).update(payload).digest("base64url")}`;

    expect(verifySession(token, secret, now)).toBeNull();
  });
});
