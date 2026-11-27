import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createGraphProvider, graphErrorCode, graphShareId, type GraphFetch } from "./graph";
import type { StorageConnection } from "./types";

const connection = (suffix: string): StorageConnection => ({
  id: `conn-${suffix}`,
  workspaceId: "ws-1",
  provider: "SHAREPOINT",
  config: { siteId: "site-1", driveId: "drive-1", folder: "circulars" },
  isDefault: true,
});

const bytes = new TextEncoder().encode("%PDF-1.7 test circular");

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("SharePoint Graph adapter", () => {
  let tenant = "";

  beforeEach(() => {
    tenant = `tenant-${randomUUID()}`;
    vi.stubEnv("MSFT_GRAPH_TENANT_ID", tenant);
    vi.stubEnv("MSFT_GRAPH_CLIENT_ID", "client-test");
    vi.stubEnv("MSFT_GRAPH_CLIENT_SECRET", "secret-test");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("maps provider statuses to safe codes", () => {
    expect(graphErrorCode(401)).toBe("INTEGRATION_NOT_CONFIGURED");
    expect(graphErrorCode(403)).toBe("STORAGE_UNAVAILABLE");
    expect(graphErrorCode(404)).toBe("STORAGE_UNAVAILABLE");
    expect(graphErrorCode(429)).toBe("STORAGE_UNAVAILABLE");
    expect(graphErrorCode(503)).toBe("STORAGE_UNAVAILABLE");
  });

  it("fails closed when credentials or site/drive are missing", async () => {
    vi.stubEnv("MSFT_GRAPH_TENANT_ID", "");
    await expect(createGraphProvider(connection("missing-env")).healthCheck()).resolves.toEqual({
      ok: false,
      code: "INTEGRATION_NOT_CONFIGURED",
    });
    vi.stubEnv("MSFT_GRAPH_TENANT_ID", tenant);
    const bare = { ...connection("missing-drive"), config: {} };
    const fetchMock: GraphFetch = vi.fn(async () => json({}));
    await expect(
      createGraphProvider(bare, { fetch: fetchMock }).upload({
        workspaceId: "ws-1",
        path: "ws/circular.pdf",
        bytes,
        contentType: "application/pdf",
        filename: "circular.pdf",
      }),
    ).rejects.toMatchObject({ ingestionCode: "INTEGRATION_NOT_CONFIGURED" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uploads a small file with a direct PUT and prevents overwrite", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchMock: GraphFetch = async (url, init) => {
      calls.push({ url, init });
      if (url.includes("/oauth2/v2.0/token")) {
        return json({ access_token: "token-value", expires_in: 3600 });
      }
      return json({ id: "item-1", webUrl: "https://sharepoint.example/circular.pdf" });
    };
    const stored = await createGraphProvider(connection("small"), {
      fetch: fetchMock,
      now: () => 1_000,
    }).upload({
      workspaceId: "ws-1",
      path: "ws-1/issuer/2026/ref-abc123.pdf",
      bytes,
      contentType: "application/pdf",
      filename: "circular.pdf",
    });

    expect(stored).toMatchObject({
      itemId: "item-1",
      webUrl: "https://sharepoint.example/circular.pdf",
      path: "ws-1/issuer/2026/ref-abc123.pdf",
    });
    expect(stored.checksum).toMatch(/^[a-f0-9]{64}$/);
    const put = calls.find((call) => call.init.method === "PUT");
    expect(put?.url).toContain("/root:/circulars/ws-1/issuer/2026/ref-abc123.pdf:/content");
    expect((put?.init.headers as Record<string, string>)["if-none-match"]).toBe("*");
    expect((put?.init.headers as Record<string, string>).authorization).toBe("Bearer token-value");
  });

  it("caches the token until expiry", async () => {
    let time = 1_000;
    const tokenCalls: string[] = [];
    const fetchMock: GraphFetch = async (url, init) => {
      if (url.includes("/oauth2/v2.0/token")) {
        tokenCalls.push(String(init.body));
        return json({ access_token: "token-value", expires_in: 3600 });
      }
      return json({ id: "item-1", webUrl: "https://sharepoint.example/a.pdf" });
    };
    const provider = createGraphProvider(connection("cache"), {
      fetch: fetchMock,
      now: () => time,
    });
    const input = {
      workspaceId: "ws-1",
      path: "ws/a.pdf",
      bytes,
      contentType: "application/pdf",
      filename: "a.pdf",
    };
    await provider.upload(input);
    await provider.upload(input);
    expect(tokenCalls).toHaveLength(1);
    time += 60 * 60_000;
    await provider.upload(input);
    expect(tokenCalls).toHaveLength(2);
  });

  it("uses an upload session for files of 4 MB or more", async () => {
    const large = new Uint8Array(4 * 1024 * 1024 + 16).fill(65);
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchMock: GraphFetch = async (url, init) => {
      calls.push({ url, init });
      if (url.includes("/oauth2/v2.0/token")) {
        return json({ access_token: "token-value", expires_in: 3600 });
      }
      if (url.includes("createUploadSession")) {
        return json({ uploadUrl: "https://graph.example/session?token=redacted" });
      }
      return json({ id: "item-large", webUrl: "https://sharepoint.example/large.pdf" });
    };
    await createGraphProvider(connection("large"), { fetch: fetchMock }).upload({
      workspaceId: "ws-1",
      path: "ws/large.pdf",
      bytes: large,
      contentType: "application/pdf",
      filename: "large.pdf",
    });
    const sessionPut = calls.find((call) => call.url.includes("/session?"));
    expect((sessionPut?.init.headers as Record<string, string>)["content-range"]).toBe(
      `bytes 0-${large.byteLength - 1}/${large.byteLength}`,
    );
    expect(sessionPut?.init.headers).not.toHaveProperty("authorization");
  });

  it("maps upload conflicts and provider failures without leaking bodies", async () => {
    const fetchMock: GraphFetch = async (url) => {
      if (url.includes("/oauth2/v2.0/token")) {
        return json({ access_token: "token-value", expires_in: 3600 });
      }
      return new Response("tenant secret details", { status: 409 });
    };
    await expect(
      createGraphProvider(connection("conflict"), { fetch: fetchMock }).upload({
        workspaceId: "ws-1",
        path: "ws/a.pdf",
        bytes,
        contentType: "application/pdf",
        filename: "a.pdf",
      }),
    ).rejects.toMatchObject({
      ingestionCode: "DUPLICATE_DOCUMENT",
      message: expect.not.stringContaining("secret"),
    });
  });

  it("streams a ranged read with truthful status and range headers", async () => {
    const fetchMock: GraphFetch = async (url, _init) => {
      if (url.includes("/oauth2/v2.0/token")) {
        return json({ access_token: "token-value", expires_in: 3600 });
      }
      return new Response(bytes, {
        status: 206,
        headers: {
          "content-type": "application/pdf",
          "content-length": String(bytes.byteLength),
          "content-range": `bytes 0-${bytes.byteLength - 1}/${bytes.byteLength}`,
        },
      });
    };
    const read = await createGraphProvider(connection("read"), { fetch: fetchMock }).read({
      itemId: "item-1",
      range: { start: 0, end: bytes.byteLength - 1 },
    });
    expect(read.status).toBe(206);
    expect(read.contentLength).toBe(bytes.byteLength);
    expect(read.contentRange).toContain("bytes 0-");
    expect(new Uint8Array(await new Response(read.body).arrayBuffer())).toEqual(bytes);
    await expect(
      createGraphProvider(connection("bad-range"), { fetch: fetchMock }).read({
        itemId: "item-1",
        range: { start: 9, end: 2 },
      }),
    ).rejects.toMatchObject({ ingestionCode: "BAD_REQUEST" });
  });

  it("resolves a pasted folder link and uploads into that folder", async () => {
    const linked = "https://contoso.sharepoint.com/sites/reg/Shared%20Documents/PolicyPulse?e=abc";
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchMock: GraphFetch = async (url, init) => {
      calls.push({ url, init });
      if (url.includes("/oauth2/v2.0/token")) {
        return json({ access_token: "token-value", expires_in: 3600 });
      }
      if (url.includes("/shares/")) {
        return json({ id: "folder-9", parentReference: { driveId: "drive-9" } });
      }
      return json({ id: "item-shared", webUrl: "https://sharepoint.example/shared.pdf" });
    };

    const stored = await createGraphProvider(
      { ...connection("shared"), config: { folderUrl: linked } },
      { fetch: fetchMock },
    ).upload({
      workspaceId: "ws-1",
      path: "ws/a.pdf",
      bytes,
      contentType: "application/pdf",
      filename: "a.pdf",
    });

    expect(stored.itemId).toBe("item-shared");
    expect(calls.some((call) => call.url.includes(`/shares/${graphShareId(linked)}/driveItem`))).toBe(
      true,
    );
    const put = calls.find((call) => call.init.method === "PUT");
    expect(put?.url).toContain("/drives/drive-9/items/folder-9:/ws/a.pdf:/content");
  });

  it("resolves the drive from the owner UPN when no drive id is set", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchMock: GraphFetch = async (url, init) => {
      calls.push({ url, init });
      if (url.includes("/oauth2/v2.0/token")) {
        return json({ access_token: "token-value", expires_in: 3600 });
      }
      if (url.includes("/users/")) {
        return json({ id: "drive-7" });
      }
      return json({ id: "item-owner", webUrl: "https://sharepoint.example/owner.pdf" });
    };

    await createGraphProvider(
      { ...connection("owner"), config: { driveOwner: "owner@contoso.com" } },
      { fetch: fetchMock },
    ).upload({
      workspaceId: "ws-1",
      path: "ws/a.pdf",
      bytes,
      contentType: "application/pdf",
      filename: "a.pdf",
    });

    const put = calls.find((call) => call.init.method === "PUT");
    expect(put?.url).toContain("/drives/drive-7/root:/ws/a.pdf:/content");
  });

  it("reports connection health from a live drive read", async () => {
    const okFetch: GraphFetch = async (url) =>
      url.includes("/oauth2/v2.0/token")
        ? json({ access_token: "token-value", expires_in: 3600 })
        : json({ id: "drive-1" });
    await expect(
      createGraphProvider(connection("health-ok"), { fetch: okFetch }).healthCheck(),
    ).resolves.toEqual({
      ok: true,
    });

    const badFetch: GraphFetch = async (url, _init) =>
      url.includes("/oauth2/v2.0/token")
        ? json({ access_token: "token-value", expires_in: 3600 })
        : new Response("forbidden", { status: 403 });
    await expect(
      createGraphProvider(connection("health-bad"), { fetch: badFetch }).healthCheck(),
    ).resolves.toEqual({
      ok: false,
      code: "STORAGE_UNAVAILABLE",
    });
  });
});
