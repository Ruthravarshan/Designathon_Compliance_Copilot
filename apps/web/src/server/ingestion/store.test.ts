import { describe, expect, it } from "vitest";
import type { StorageConnection, StorageProvider } from "@/server/storage/types";
import { createMemoryRuntime } from "./__fixtures__/runtime";
import { IngestionError } from "./errors";
import { storePdf } from "./store";

const bytes = new TextEncoder().encode("%PDF-1.7 fallback circular");

const primary: StorageConnection = {
  id: "conn-1",
  workspaceId: "ws-1",
  provider: "SHAREPOINT",
  config: { driveId: "drive-1" },
  isDefault: true,
};

const fallback: StorageConnection = {
  id: "conn-2",
  workspaceId: "ws-1",
  provider: "SUPABASE_STORAGE",
  config: { bucket: "fallback" },
  isDefault: false,
  isFallback: true,
};

function failingProvider(code: "STORAGE_UNAVAILABLE" | "DUPLICATE_DOCUMENT"): StorageProvider {
  return {
    kind: "SHAREPOINT",
    async healthCheck() {
      return { ok: false, code };
    },
    async upload() {
      throw new IngestionError(code, "primary storage failed");
    },
    async read() {
      throw new IngestionError(code, "primary storage failed");
    },
  };
}

function input(overrides: Partial<Parameters<typeof storePdf>[0]> = {}) {
  return {
    workspaceId: "ws-1",
    bytes,
    filename: "circular.pdf",
    issuer: "RBI",
    reference: null,
    publishedAt: null,
    connection: primary,
    ...overrides,
  };
}

describe("storePdf fallback", () => {
  it("stores in the standby connection when the primary is unavailable", async () => {
    const runtime = createMemoryRuntime();
    const result = await storePdf(
      input({
        fallback,
        provider: failingProvider("STORAGE_UNAVAILABLE"),
        fallbackProvider: runtime.provider,
      }),
      runtime.repository,
    );

    expect(result.usedFallback).toBe(true);
    expect(result.storageConnectionId).toBe("conn-2");
    expect(result.stored?.path).toBe(result.path);
    expect(runtime.objects.size).toBe(1);
  });

  it("does not fall back on a duplicate, so the primary conflict stays visible", async () => {
    const runtime = createMemoryRuntime();
    await expect(
      storePdf(
        input({
          fallback,
          provider: failingProvider("DUPLICATE_DOCUMENT"),
          fallbackProvider: runtime.provider,
        }),
        runtime.repository,
      ),
    ).rejects.toMatchObject({ ingestionCode: "DUPLICATE_DOCUMENT" });
    expect(runtime.objects.size).toBe(0);
  });

  it("never falls back into a different workspace", async () => {
    const runtime = createMemoryRuntime();
    const foreign: StorageConnection = { ...fallback, workspaceId: "ws-2" };
    await expect(
      storePdf(
        input({
          fallback: foreign,
          provider: failingProvider("STORAGE_UNAVAILABLE"),
          fallbackProvider: runtime.provider,
        }),
        runtime.repository,
      ),
    ).rejects.toMatchObject({ ingestionCode: "STORAGE_UNAVAILABLE" });
    expect(runtime.objects.size).toBe(0);
  });

  it("links an existing document instead of uploading again", async () => {
    const runtime = createMemoryRuntime();
    runtime.state.files.set("ws-1:unused", { documentId: "doc-1" });
    const existing = await storePdf(
      input({ checksum: "unused", provider: failingProvider("STORAGE_UNAVAILABLE") }),
      runtime.repository,
    );
    expect(existing).toMatchObject({ duplicate: true, documentId: "doc-1" });
    expect(runtime.objects.size).toBe(0);
  });
});
