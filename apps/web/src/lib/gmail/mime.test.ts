import { describe, expect, it } from "vitest";
import {
  InvalidMimeInputError,
  buildMimeMessage,
  encodeBase64Url,
  sanitizeEmailAddress,
  sanitizeHeader,
  wrapBase64,
} from "./mime";

const base = {
  from: { name: "PolicyPulse", email: "policypulse.hexa@gmail.com" },
  to: "owner@example.com",
  subject: "PolicyPulse Gmail test",
  html: "<p>Hello</p>",
  text: "Hello",
  date: new Date("2026-11-27T10:00:00.000Z"),
  boundary: "=_PolicyPulse_test",
  messageId: "<fixed@example.com>",
};

describe("mime helpers", () => {
  it("strips CRLF from header values", () => {
    expect(sanitizeHeader("Hello\r\nBcc: attacker@example.com")).toBe(
      "Hello Bcc: attacker@example.com",
    );
  });

  it("rejects invalid recipient addresses", () => {
    expect(() => sanitizeEmailAddress("not-an-email")).toThrow(InvalidMimeInputError);
    expect(() => sanitizeEmailAddress("a@b.com\r\nBcc: x@y.com")).toThrow(InvalidMimeInputError);
  });

  it("wraps base64 at the requested length", () => {
    expect(wrapBase64("abcdefgh", 3)).toBe("abc\r\ndef\r\ngh");
  });

  it("encodes base64url without padding", () => {
    const encoded = encodeBase64Url("hello");
    expect(encoded).toBe("aGVsbG8");
    expect(encoded).not.toContain("=");
  });
});

describe("buildMimeMessage", () => {
  it("builds a multipart message with headers and both bodies", () => {
    const raw = buildMimeMessage(base);

    expect(raw).toContain('From: "PolicyPulse" <policypulse.hexa@gmail.com>');
    expect(raw).toContain("To: owner@example.com");
    expect(raw).toContain("Subject: PolicyPulse Gmail test");
    expect(raw).toContain("Message-ID: <fixed@example.com>");
    expect(raw).toContain('Content-Type: multipart/alternative; boundary="=_PolicyPulse_test"');
    expect(raw).toContain("Content-Type: text/plain");
    expect(raw).toContain("Content-Type: text/html");
    expect(raw.endsWith("--=_PolicyPulse_test--\r\n")).toBe(true);
  });

  it("cannot be tricked into adding a header", () => {
    const raw = buildMimeMessage({
      ...base,
      subject: "Hello\r\nBcc: attacker@example.com",
      to: "owner@example.com",
    });

    expect(raw).not.toMatch(/\r\nBcc:/i);
    expect(raw.split("\r\n").some((line) => line.toLowerCase().startsWith("bcc:"))).toBe(false);
  });

  it("encodes non-ASCII subjects", () => {
    const raw = buildMimeMessage({ ...base, subject: "Résumé prêt" });
    expect(raw).toContain("Subject: =?UTF-8?B?");
  });

  it("encodes non-ASCII display names", () => {
    const raw = buildMimeMessage({
      ...base,
      from: { name: "Équipe", email: "a@example.com" },
    });
    expect(raw).toContain("=?UTF-8?B?");
  });

  it("adds reply-to when provided", () => {
    const raw = buildMimeMessage({ ...base, replyTo: "reply@example.com" });
    expect(raw).toContain("Reply-To: reply@example.com");
  });

  it("rejects an unsafe boundary", () => {
    expect(() => buildMimeMessage({ ...base, boundary: 'bad"boundary' })).toThrow(
      InvalidMimeInputError,
    );
  });

  it("generates a boundary and message id when omitted", () => {
    const raw = buildMimeMessage({
      from: base.from,
      to: base.to,
      subject: base.subject,
      html: base.html,
      text: base.text,
    });
    expect(raw).toMatch(/boundary="=_PolicyPulse_/);
    expect(raw).toMatch(/Message-ID: <[0-9a-f-]+@gmail\.com>/);
  });

  it("omits the display name when empty", () => {
    const raw = buildMimeMessage({ ...base, from: { email: "a@example.com" } });
    expect(raw).toContain("From: a@example.com");
  });
});
