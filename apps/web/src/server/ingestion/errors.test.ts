import { describe, expect, it } from "vitest";
import { toPublicError } from "@/lib/errors";
import { IngestionError, isRetryableCode, safeErrorCode } from "./errors";

describe("ingestion errors", () => {
  it("keeps safe codes in the public envelope", () => {
    const error = new IngestionError("STORAGE_UNAVAILABLE", "The storage provider is unavailable.");
    const publicError = toPublicError(error, "req-1");
    expect(publicError.status).toBe(503);
    expect(publicError.body.error).toMatchObject({
      code: "STORAGE_UNAVAILABLE",
      message: "The storage provider is unavailable.",
      requestId: "req-1",
    });
  });

  it("classifies unknown failures without leaking details", () => {
    expect(safeErrorCode(new Error("provider body with secret"))).toBe("INTERNAL");
    expect(safeErrorCode(new IngestionError("HOST_NOT_ALLOWED", "Blocked host"))).toBe(
      "HOST_NOT_ALLOWED",
    );
  });

  it("marks only transient codes retryable", () => {
    expect(isRetryableCode("FETCH_TIMEOUT")).toBe(true);
    expect(isRetryableCode("STORAGE_UNAVAILABLE")).toBe(true);
    expect(isRetryableCode("HOST_NOT_ALLOWED")).toBe(false);
    expect(isRetryableCode("INVALID_PDF")).toBe(false);
  });

  it("honours an explicit status override", () => {
    expect(new IngestionError("DUPLICATE_DOCUMENT", "Duplicate", { status: 200 }).status).toBe(200);
  });
});
