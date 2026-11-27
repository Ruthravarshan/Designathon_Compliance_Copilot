import { generateKeyPairSync, randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createDriveAssertion,
  createDriveProvider,
  driveErrorCode,
  type DriveFetch,
  type DriveServiceAccount,
} from "./drive";
import type { StorageConnection } from "./types";

const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const privateKeyPem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();

const bytes = new TextEncoder().encode("%PDF-1.7 drive circular");

function account(): DriveServiceAccount {
  return {
    clientEmail: `storage-${randomUUID()}@example.iam.gserviceaccount.com`,
    privateKey: privateKeyPem,
  };
}

function connection(overrides: Partial<StorageConnection> = {}): StorageConnection {
  return {
    id: "conn-drive",
    workspaceId: "ws-1",
    provider: "GOOGLE_DRIVE",
    config: { folderId: "folder-1" },
    isDefault: false,
    isFallback: true,
    ...overrides,
  };
}

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

function withToken(fetchMock: DriveFetch): DriveFetch {
  return async (url, init) =>
    url.includes("oauth2.googleapis.com/token")
      ? json({ access_token: "drive-token", expires_in: 3600 })
      : fetchMock(url, init);
}

describe("Google Drive adapter", () => {
  beforeEach(() => {
    vi.stubEnv("GOOGLE_SERVICE_ACCOUNT_JSON_BASE64", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("maps provider statuses to safe codes", () => {
    expect(driveErrorCode(401)).toBe("INTEGRATION_NOT_CONFIGURED");
    expect(driveErrorCode(403)).toBe("STORAGE_UNAVAILABLE");
    expect(driveErrorCode(404)).toBe("STORAGE_UNAVAILABLE");
    expect(driveErrorCode(500)).toBe("STORAGE_UNAVAILABLE");
  });

  it("signs a JWT assertion with the service-account claims", () => {
    const assertion = createDriveAssertion(account(), 1_700_000_000);
    const [header, claims, signature] = assertion.split(".");
    expect(header && claims && signature).toBeTruthy();
    const decodedHeader = JSON.parse(Buffer.from(header ?? "", "base64url").toString("utf8"));
    const decodedClaims = JSON.parse(Buffer.from(claims ?? "", "base64url").toString("utf8"));
    expect(decodedHeader).toMatchObject({ alg: "RS256", typ: "JWT" });
    expect(decodedClaims).toMatchObject({
      scope: "https://www.googleapis.com/auth/drive",
      aud: "https://oauth2.googleapis.com/token",
      iat: 1_700_000_000,
      exp: 1_700_003_600,
    });
  });

  it("fails closed when the service account is not configured", async () => {
    const provider = createDriveProvider(connection());
    await expect(provider.healthCheck()).resolves.toEqual({
      ok: false,
      code: "INTEGRATION_NOT_CONFIGURED",
    });
    await expect(
      provider.upload({
        workspaceId: "ws-1",
        path: "ws/a.pdf",
        bytes,
        contentType: "application/pdf",
        filename: "a.pdf",
      }),
    ).rejects.toMatchObject({ ingestionCode: "INTEGRATION_NOT_CONFIGURED" });

    const missingFolder = createDriveProvider(connection({ config: {} }), {
      serviceAccount: account(),
    });
    await expect(missingFolder.healthCheck()).resolves.toEqual({
      ok: false,
      code: "INTEGRATION_NOT_CONFIGURED",
    });
  });

  it("uploads a small file as multipart into the configured folder", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchMock = withToken(async (url, init) => {
      calls.push({ url, init });
      return json({ id: "file-1", webViewLink: "https://drive.google.com/file/d/file-1/view" });
    });

    const stored = await createDriveProvider(connection(), {
      fetch: fetchMock,
      serviceAccount: account(),
      now: () => 1_000,
    }).upload({
      workspaceId: "ws-1",
      path: "ws-1/issuer/2026/ref-abc123.pdf",
      bytes,
      contentType: "application/pdf",
      filename: "circular.pdf",
    });

    expect(stored).toMatchObject({
      itemId: "file-1",
      webUrl: "https://drive.google.com/file/d/file-1/view",
      path: "ws-1/issuer/2026/ref-abc123.pdf",
    });
    expect(stored.checksum).toMatch(/^[a-f0-9]{64}$/);

    const upload = calls.find((call) => call.url.includes("uploadType=multipart"));
    expect(upload?.url).toContain("/upload/drive/v3/files");
    expect((upload?.init.headers as Record<string, string>).authorization).toBe(
      "Bearer drive-token",
    );
    const form = upload?.init.body as FormData;
    const metadata = JSON.parse(await (form.get("metadata") as Blob).text());
    expect(metadata).toMatchObject({
      name: "circular.pdf",
      parents: ["folder-1"],
      appProperties: { path: "ws-1/issuer/2026/ref-abc123.pdf" },
    });
  });

  it("uses a resumable session for files of 5 MB or more", async () => {
    const large = new Uint8Array(5 * 1024 * 1024 + 16).fill(66);
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchMock = withToken(async (url, init) => {
      calls.push({ url, init });
      if (url.includes("uploadType=resumable")) {
        return json({}, 200, { location: "https://upload.example/session?token=redacted" });
      }
      return json({ id: "file-large" });
    });

    await createDriveProvider(connection(), {
      fetch: fetchMock,
      serviceAccount: account(),
    }).upload({
      workspaceId: "ws-1",
      path: "ws/large.pdf",
      bytes: large,
      contentType: "application/pdf",
      filename: "large.pdf",
    });

    const put = calls.find((call) => call.url.includes("/session?"));
    expect((put?.init.headers as Record<string, string>)["content-range"]).toBe(
      `bytes 0-${large.byteLength - 1}/${large.byteLength}`,
    );
    expect(put?.init.headers).not.toHaveProperty("authorization");
  });

  it("streams a ranged read with truthful status and range headers", async () => {
    const fetchMock = withToken(async () =>
      Promise.resolve(
        new Response(bytes, {
          status: 206,
          headers: {
            "content-type": "application/pdf",
            "content-length": String(bytes.byteLength),
            "content-range": `bytes 0-${bytes.byteLength - 1}/${bytes.byteLength}`,
          },
        }),
      ),
    );

    const read = await createDriveProvider(connection(), {
      fetch: fetchMock,
      serviceAccount: account(),
    }).read({ itemId: "file-1", range: { start: 0, end: bytes.byteLength - 1 } });

    expect(read.status).toBe(206);
    expect(read.contentLength).toBe(bytes.byteLength);
    expect(read.contentRange).toContain("bytes 0-");
    expect(new Uint8Array(await new Response(read.body).arrayBuffer())).toEqual(bytes);

    await expect(
      createDriveProvider(connection(), {
        fetch: fetchMock,
        serviceAccount: account(),
      }).read({ itemId: "file-1", range: { start: 9, end: 2 } }),
    ).rejects.toMatchObject({ ingestionCode: "BAD_REQUEST" });
  });

  it("does not upload into another workspace", async () => {
    const fetchMock: DriveFetch = async () => json({});
    await expect(
      createDriveProvider(connection(), { fetch: fetchMock, serviceAccount: account() }).upload({
        workspaceId: "ws-2",
        path: "ws/a.pdf",
        bytes,
        contentType: "application/pdf",
        filename: "a.pdf",
      }),
    ).rejects.toMatchObject({ ingestionCode: "BAD_REQUEST" });
  });
});