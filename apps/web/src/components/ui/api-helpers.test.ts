import { describe, expect, it } from "vitest";
import {
  formatBytes,
  parseApiResponse,
  REJECTION_NOTE_MAX,
  REJECTION_NOTE_MIN,
  validateRejectionNote,
} from "./api-helpers";

describe("validateRejectionNote", () => {
  it("rejects empty or too-short trimmed notes", () => {
    expect(validateRejectionNote("")).toEqual({
      valid: false,
      trimmedLength: 0,
      error: `The note must be at least ${REJECTION_NOTE_MIN} characters.`,
    });
    expect(validateRejectionNote("   short   ")).toEqual({
      valid: false,
      trimmedLength: 5,
      error: `The note must be at least ${REJECTION_NOTE_MIN} characters.`,
    });
  });

  it("accepts boundary lengths 10 and 2000", () => {
    expect(validateRejectionNote("1234567890")).toEqual({
      valid: true,
      trimmedLength: 10,
      error: null,
    });
    expect(validateRejectionNote("a".repeat(REJECTION_NOTE_MAX))).toEqual({
      valid: true,
      trimmedLength: REJECTION_NOTE_MAX,
      error: null,
    });
  });

  it("rejects notes over 2000 characters", () => {
    expect(validateRejectionNote("a".repeat(REJECTION_NOTE_MAX + 1))).toEqual({
      valid: false,
      trimmedLength: REJECTION_NOTE_MAX + 1,
      error: `The note cannot exceed ${REJECTION_NOTE_MAX} characters.`,
    });
  });
});

describe("parseApiResponse", () => {
  it("parses { data } on 2xx", async () => {
    const response = new Response(JSON.stringify({ data: { id: "c1" } }), {
      status: 200,
      headers: { "x-request-id": "req-123" },
    });
    const parsed = await parseApiResponse<{ id: string }>(response);
    expect(parsed).toEqual({ ok: true, data: { id: "c1" }, requestId: "req-123" });
  });

  it("parses { error } envelope on failure", async () => {
    const response = new Response(
      JSON.stringify({
        error: { code: "FORBIDDEN", message: "No access", requestId: "req-999" },
      }),
      { status: 403 },
    );
    const parsed = await parseApiResponse(response);
    expect(parsed).toEqual({
      ok: false,
      status: 403,
      error: { code: "FORBIDDEN", message: "No access", requestId: "req-999", details: undefined },
    });
  });

  it("falls back cleanly on invalid JSON body", async () => {
    const response = new Response("gateway error", {
      status: 502,
      headers: { "x-request-id": "req-502" },
    });
    const parsed = await parseApiResponse(response);
    expect(parsed).toEqual({
      ok: false,
      status: 502,
      error: {
        code: "REQUEST_FAILED",
        message: "That didn't save. Try again.",
        requestId: "req-502",
      },
    });
  });
});

describe("formatBytes", () => {
  it("formats byte sizes cleanly", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2.0 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.00 MB");
    expect(formatBytes(-1)).toBe("0 B");
  });
});
