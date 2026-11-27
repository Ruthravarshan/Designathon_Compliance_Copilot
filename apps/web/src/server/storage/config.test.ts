import { describe, expect, it } from "vitest";
import { IngestionError } from "@/server/ingestion/errors";
import { assertConnectionWorkspace, checksumOf, readConnectionConfig, safeObjectPath, sanitizePathSegment } from "./config";
import type { StorageConnection } from "./types";

const connection: StorageConnection = {
  id: "conn-1",
  workspaceId: "ws-1",
  provider: "SHAREPOINT",
  config: {},
  isDefault: true,
};

describe("storage path and config guards", () => {
  it("sanitizes issuer/reference segments and strips traversal", () => {
    expect(sanitizePathSegment("Reserve Bank of India")).toBe("reserve-bank-of-india");
    expect(sanitizePathSegment("../etc/passwd")).toBe("etc-passwd");
    expect(sanitizePathSegment("...")).toBe("unclassified");
    expect(sanitizePathSegment("x".repeat(200))).toHaveLength(80);
  });

  it("builds a bounded path without dot segments", () => {
    expect(safeObjectPath(["ws-1", "..", "2026", "ref-123"])).toBe("ws-1/unclassified/2026/ref-123");
  });

  it("computes a stable sha256 checksum", () => {
    const bytes = new TextEncoder().encode("circular");
    expect(checksumOf(bytes)).toBe(checksumOf(bytes));
    expect(checksumOf(bytes)).not.toBe(checksumOf(new TextEncoder().encode("other")));
    expect(checksumOf(bytes)).toMatch(/^[a-f0-9]{64}$/);
  });

  it("reads non-secret config and rejects malformed values", () => {
    expect(readConnectionConfig({ bucket: "circulars", extra: "ignored" })).toEqual({ bucket: "circulars" });
    expect(() => readConnectionConfig({ bucket: 42 })).toThrow(IngestionError);
  });

  it("rejects a cross-workspace connection", () => {
    expect(() => assertConnectionWorkspace(connection, "ws-2")).toThrow(IngestionError);
    expect(() => assertConnectionWorkspace(connection, "ws-1")).not.toThrow();
  });
});
