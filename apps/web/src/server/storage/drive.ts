import { sign } from "node:crypto";
import { z } from "zod";
import { IngestionError, type IngestionErrorCode } from "@/server/ingestion/errors";
import { assertConnectionWorkspace, checksumOf, readConnectionConfig } from "./config";
import type {
  StorageConnection,
  StorageProvider,
  StorageReadInput,
  StorageReadResult,
  StorageUploadInput,
  StoredObject,
} from "./types";

const DRIVE_API = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";
const SIMPLE_UPLOAD_BYTES = 5 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 20_000;
const UPLOAD_TIMEOUT_MS = 60_000;
const TOKEN_CACHE_LIMIT = 8;
const ASSERTION_TTL_SECONDS = 3600;

const tokenCache = new Map<string, { value: string; expiresAt: number }>();

const serviceAccountSchema = z.object({
  client_email: z.string().trim().min(1),
  private_key: z.string().trim().min(1),
});
const tokenSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().int().positive(),
});
const fileSchema = z.object({
  id: z.string().min(1),
  webViewLink: z.string().url().optional(),
});

export interface DriveServiceAccount {
  clientEmail: string;
  privateKey: string;
}

export type DriveFetch = (url: string, init: RequestInit) => Promise<Response>;

export interface DriveProviderOptions {
  fetch?: DriveFetch;
  now?: () => number;
  serviceAccount?: DriveServiceAccount;
}

function requiredEnv(name: string): string {
  const parsed = z.string().trim().min(1).safeParse(process.env[name]);
  if (!parsed.success) {
    throw new IngestionError(
      "INTEGRATION_NOT_CONFIGURED",
      `Google Drive ${name} is not configured.`,
    );
  }
  return parsed.data;
}

/** Safe codes only: provider status and message are never returned to callers. */
export function driveErrorCode(status: number): IngestionErrorCode {
  if (status === 401) {
    return "INTEGRATION_NOT_CONFIGURED";
  }
  return "STORAGE_UNAVAILABLE";
}

function readServiceAccount(): DriveServiceAccount {
  const encoded = requiredEnv("GOOGLE_SERVICE_ACCOUNT_JSON_BASE64");
  let decoded: unknown;
  try {
    decoded = JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
  } catch {
    throw new IngestionError(
      "INTEGRATION_NOT_CONFIGURED",
      "The Google Drive service account is not valid.",
    );
  }
  const parsed = serviceAccountSchema.safeParse(decoded);
  if (!parsed.success) {
    throw new IngestionError(
      "INTEGRATION_NOT_CONFIGURED",
      "The Google Drive service account is not valid.",
    );
  }
  return { clientEmail: parsed.data.client_email, privateKey: parsed.data.private_key };
}

function base64url(value: string | Buffer): string {
  return Buffer.from(value).toString("base64url");
}

/** RS256 JWT assertion for the OAuth 2.0 service-account flow. */
export function createDriveAssertion(account: DriveServiceAccount, nowSeconds: number): string {
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(
    JSON.stringify({
      iss: account.clientEmail,
      scope: DRIVE_SCOPE,
      aud: TOKEN_ENDPOINT,
      iat: nowSeconds,
      exp: nowSeconds + ASSERTION_TTL_SECONDS,
    }),
  );
  const signingInput = `${header}.${claims}`;
  const signature = sign("RSA-SHA256", Buffer.from(signingInput), account.privateKey);
  return `${signingInput}.${signature.toString("base64url")}`;
}

export function createDriveProvider(
  connection: StorageConnection,
  options: DriveProviderOptions = {},
): StorageProvider {
  const config = readConnectionConfig(connection.config);
  const httpFetch = options.fetch ?? globalThis.fetch;
  const now = options.now ?? Date.now;

  function requireFolder(): string {
    if (!config.folderId) {
      throw new IngestionError(
        "INTEGRATION_NOT_CONFIGURED",
        "The Google Drive folder is not configured.",
      );
    }
    return config.folderId;
  }

  async function token(): Promise<string> {
    const account = options.serviceAccount ?? readServiceAccount();
    const cached = tokenCache.get(account.clientEmail);
    if (cached && cached.expiresAt > now() + 60_000) {
      return cached.value;
    }

    const assertion = createDriveAssertion(account, Math.floor(now() / 1000));
    const response = await httpFetch(TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: "no-store",
    });
    if (!response.ok) {
      throw new IngestionError(
        driveErrorCode(response.status),
        "Google Drive authentication failed.",
      );
    }

    const parsed = tokenSchema.safeParse(await response.json());
    if (!parsed.success) {
      throw new IngestionError("STORAGE_UNAVAILABLE", "Google Drive authentication failed.");
    }
    if (!tokenCache.has(account.clientEmail) && tokenCache.size >= TOKEN_CACHE_LIMIT) {
      const oldest = tokenCache.keys().next().value;
      if (oldest !== undefined) {
        tokenCache.delete(oldest);
      }
    }
    tokenCache.set(account.clientEmail, {
      value: parsed.data.access_token,
      expiresAt: now() + parsed.data.expires_in * 1000,
    });
    return parsed.data.access_token;
  }

  async function authorized(
    method: string,
    url: string,
    init: { body?: BodyInit; headers?: Record<string, string>; timeoutMs?: number } = {},
  ): Promise<Response> {
    return httpFetch(url, {
      method,
      headers: { authorization: `Bearer ${await token()}`, ...init.headers },
      body: init.body,
      signal: AbortSignal.timeout(init.timeoutMs ?? REQUEST_TIMEOUT_MS),
      cache: "no-store",
    });
  }

  function parseStored(response: Response, input: StorageUploadInput, checksum: string) {
    return response.json().then((body: unknown) => {
      const parsed = fileSchema.safeParse(body);
      if (!parsed.success) {
        throw new IngestionError(
          "STORAGE_UNAVAILABLE",
          "The storage provider returned an incomplete result.",
        );
      }
      return {
        itemId: parsed.data.id,
        webUrl:
          parsed.data.webViewLink ??
          `https://drive.google.com/file/d/${encodeURIComponent(parsed.data.id)}/view`,
        path: input.path,
        checksum,
      } satisfies StoredObject;
    });
  }

  async function smallUpload(
    input: StorageUploadInput,
    checksum: string,
    folderId: string,
  ): Promise<StoredObject> {
    const metadata = {
      name: input.filename,
      parents: [folderId],
      appProperties: { path: input.path, checksum },
    };
    const form = new FormData();
    form.append(
      "metadata",
      new Blob([JSON.stringify(metadata)], { type: "application/json; charset=UTF-8" }),
    );
    form.append(
      "file",
      new Blob([new Uint8Array(input.bytes)], { type: input.contentType }),
      input.filename,
    );

    const response = await authorized(
      "POST",
      `${DRIVE_UPLOAD_API}/files?uploadType=multipart&fields=id,webViewLink&supportsAllDrives=true`,
      { body: form, timeoutMs: UPLOAD_TIMEOUT_MS },
    );
    if (!response.ok) {
      throw new IngestionError(
        driveErrorCode(response.status),
        "The storage provider rejected the upload.",
      );
    }
    return parseStored(response, input, checksum);
  }

  async function resumableUpload(
    input: StorageUploadInput,
    checksum: string,
    folderId: string,
  ): Promise<StoredObject> {
    const metadata = {
      name: input.filename,
      parents: [folderId],
      appProperties: { path: input.path, checksum },
    };
    const session = await authorized(
      "POST",
      `${DRIVE_UPLOAD_API}/files?uploadType=resumable&fields=id,webViewLink&supportsAllDrives=true`,
      {
        headers: {
          "content-type": "application/json; charset=UTF-8",
          "x-upload-content-type": input.contentType,
          "x-upload-content-length": String(input.bytes.byteLength),
        },
        body: JSON.stringify(metadata),
      },
    );
    if (!session.ok) {
      throw new IngestionError(
        driveErrorCode(session.status),
        "The storage provider could not start the upload.",
      );
    }
    // The session URL carries its own short-lived credential: never log it.
    const uploadUrl = session.headers.get("location");
    if (!uploadUrl) {
      throw new IngestionError(
        "STORAGE_UNAVAILABLE",
        "The storage provider could not start the upload.",
      );
    }

    const response = await httpFetch(uploadUrl, {
      method: "PUT",
      headers: {
        "content-type": input.contentType,
        "content-range": `bytes 0-${input.bytes.byteLength - 1}/${input.bytes.byteLength}`,
      },
      // Node fetch accepts Uint8Array; the DOM BodyInit type is narrower.
      body: input.bytes as unknown as BodyInit,
      signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
      cache: "no-store",
    });
    if (!response.ok) {
      throw new IngestionError(
        driveErrorCode(response.status),
        "The storage provider rejected the upload.",
      );
    }
    return parseStored(response, input, checksum);
  }

  return {
    kind: "GOOGLE_DRIVE",

    async healthCheck() {
      try {
        const folderId = requireFolder();
        const response = await authorized(
          "GET",
          `${DRIVE_API}/files/${encodeURIComponent(folderId)}?fields=id,name&supportsAllDrives=true`,
        );
        if (!response.ok) {
          return { ok: false, code: driveErrorCode(response.status) };
        }
        return { ok: true };
      } catch (error) {
        return {
          ok: false,
          code: error instanceof IngestionError ? error.ingestionCode : "STORAGE_UNAVAILABLE",
        };
      }
    },

    async upload(input: StorageUploadInput): Promise<StoredObject> {
      assertConnectionWorkspace(connection, input.workspaceId);
      const folderId = requireFolder();
      const checksum = checksumOf(input.bytes);
      return input.bytes.byteLength < SIMPLE_UPLOAD_BYTES
        ? smallUpload(input, checksum, folderId)
        : resumableUpload(input, checksum, folderId);
    },

    async read(input: StorageReadInput): Promise<StorageReadResult> {
      if (input.range && (input.range.start < 0 || input.range.end < input.range.start)) {
        throw new IngestionError("BAD_REQUEST", "The requested byte range is not valid.");
      }
      const response = await authorized(
        "GET",
        `${DRIVE_API}/files/${encodeURIComponent(input.itemId)}?alt=media&supportsAllDrives=true`,
        {
          ...(input.range
            ? { headers: { range: `bytes=${input.range.start}-${input.range.end}` } }
            : {}),
        },
      );
      if (!response.ok) {
        throw new IngestionError(
          driveErrorCode(response.status),
          "The stored file could not be read.",
        );
      }
      const bytes = new Uint8Array(await response.arrayBuffer());
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(bytes);
          controller.close();
        },
      });
      const contentLengthHeader = response.headers.get("content-length");
      const contentLength = contentLengthHeader
        ? Number.parseInt(contentLengthHeader, 10)
        : undefined;
      return {
        body,
        contentType: response.headers.get("content-type") ?? "application/pdf",
        ...(contentLength !== undefined && Number.isFinite(contentLength) ? { contentLength } : {}),
        status: response.status === 206 ? 206 : 200,
        ...(response.headers.get("content-range")
          ? { contentRange: response.headers.get("content-range") ?? undefined }
          : {}),
      };
    },
  };
}
