import { describe, expect, it, vi } from "vitest";
import { createSupabaseProvider, type SupabaseClientLike, type SupabaseStorageLike } from "./supabase";
import type { StorageConnection } from "./types";

const bytes = new TextEncoder().encode("%PDF-1.7 private bucket");
const connection: StorageConnection = {
  id: "conn-supabase",
  workspaceId: "ws-1",
  provider: "SUPABASE_STORAGE",
  config: { bucket: "circulars" },
  isDefault: false,
};

function client(overrides: Partial<SupabaseStorageLike> = {}): SupabaseClientLike {
  const base = {
    upload: vi.fn(async () => ({ error: null })),
    createSignedUrl: vi.fn(async () => ({
      data: { signedUrl: "https://signed.example/secret-token" },
      error: null,
    })),
    list: vi.fn(async () => ({ error: null })),
  };
  return { storage: { from: () => ({ ...base, ...overrides }) } };
}

describe("Supabase Storage adapter", () => {
  it("uploads with upsert:false and never exposes a signed URL", async () => {
    const upload = vi.fn(async () => ({ error: null }));
    const provider = createSupabaseProvider(connection, { client: client({ upload }) });
    const stored = await provider.upload({
      workspaceId: "ws-1",
      path: "ws-1/issuer/2026/ref.pdf",
      bytes,
      contentType: "application/pdf",
      filename: "ref.pdf",
    });
    expect(upload).toHaveBeenCalledWith("ws-1/issuer/2026/ref.pdf", bytes, {
      contentType: "application/pdf",
      upsert: false,
    });
    expect(stored.itemId).toBe("ws-1/issuer/2026/ref.pdf");
    expect(stored.webUrl).toBe("");
    expect(stored.checksum).toMatch(/^[a-f0-9]{64}$/);
  });

  it("rejects a cross-workspace upload before any provider call", async () => {
    const upload = vi.fn(async () => ({ error: null }));
    await expect(
      createSupabaseProvider(connection, { client: client({ upload }) }).upload({
        workspaceId: "ws-2",
        path: "ws-2/a.pdf",
        bytes,
        contentType: "application/pdf",
        filename: "a.pdf",
      }),
    ).rejects.toMatchObject({ ingestionCode: "BAD_REQUEST" });
    expect(upload).not.toHaveBeenCalled();
  });

  it("fetches a short-lived signed URL server-side for a ranged read", async () => {
    const signedUrl = vi.fn(async () => ({
      data: { signedUrl: "https://signed.example/secret-token" },
      error: null,
    }));
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      new Response(bytes, {
        status: 206,
        headers: { "content-type": "application/pdf", "content-range": "bytes 0-22/23" },
      }),
    );
    const provider = createSupabaseProvider(connection, {
      client: client({ createSignedUrl: signedUrl }),
      fetch: fetchMock as unknown as typeof globalThis.fetch,
    });
    const read = await provider.read({ itemId: "ws-1/a.pdf", range: { start: 0, end: 22 } });
    expect(signedUrl).toHaveBeenCalledWith("ws-1/a.pdf", 60);
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      headers: { range: "bytes=0-22" },
      cache: "no-store",
    });
    expect(read.status).toBe(206);
    expect(new Uint8Array(await new Response(read.body).arrayBuffer())).toEqual(bytes);
  });

  it("maps provider failures to safe codes and checks the real bucket", async () => {
    const failing = createSupabaseProvider(connection, {
      client: client({ upload: async () => ({ error: { message: "bucket secret key" } }) }),
    });
    await expect(
      failing.upload({
        workspaceId: "ws-1",
        path: "ws-1/a.pdf",
        bytes,
        contentType: "application/pdf",
        filename: "a.pdf",
      }),
    ).rejects.toMatchObject({ ingestionCode: "STORAGE_UNAVAILABLE", message: expect.not.stringContaining("secret") });

    const healthy = createSupabaseProvider(connection, { client: client() });
    await expect(healthy.healthCheck()).resolves.toEqual({ ok: true });
    const unhealthy = createSupabaseProvider(connection, {
      client: client({ list: async () => ({ error: { message: "forbidden" } }) }),
    });
    await expect(unhealthy.healthCheck()).resolves.toEqual({ ok: false, code: "STORAGE_UNAVAILABLE" });
  });

  it("fails closed when the bucket is not configured", async () => {
    const unconfigured = { ...connection, config: {} };
    const provider = createSupabaseProvider(unconfigured, { client: client() });
    await expect(provider.healthCheck()).resolves.toEqual({
      ok: false,
      code: "INTEGRATION_NOT_CONFIGURED",
    });
    await expect(
      provider.read({ itemId: "a.pdf" }),
    ).rejects.toMatchObject({ ingestionCode: "INTEGRATION_NOT_CONFIGURED" });
  });
});
