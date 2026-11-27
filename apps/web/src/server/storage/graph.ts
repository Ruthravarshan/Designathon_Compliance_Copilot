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

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";
const SMALL_UPLOAD_BYTES = 4 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 20_000;
const LARGE_UPLOAD_TIMEOUT_MS = 60_000;
const TOKEN_CACHE_LIMIT = 8;

const tokenCache = new Map<string, { value: string; expiresAt: number }>();

const tokenSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().int().positive(),
});
const itemSchema = z.object({ id: z.string().min(1), webUrl: z.string().url().optional() });
const uploadSessionSchema = z.object({ uploadUrl: z.string().url() });

export type GraphFetch = (url: string, init: RequestInit) => Promise<Response>;

export interface GraphProviderOptions {
  fetch?: GraphFetch;
  now?: () => number;
}

function requiredEnv(name: string): string {
  const parsed = z.string().trim().min(1).safeParse(process.env[name]);
  if (!parsed.success) {
    throw new IngestionError(
      "INTEGRATION_NOT_CONFIGURED",
      `Microsoft Graph ${name} is not configured.`,
    );
  }
  return parsed.data;
}

/** Safe codes only: provider status and message are never returned to callers. */
export function graphErrorCode(status: number): IngestionErrorCode {
  if (status === 401) {
    return "INTEGRATION_NOT_CONFIGURED";
  }
  if (status === 403) {
    return "STORAGE_UNAVAILABLE";
  }
  if (status === 404 || status === 429 || status >= 500) {
    return "STORAGE_UNAVAILABLE";
  }
  return "STORAGE_UNAVAILABLE";
}

function encodePath(path: string): string {
  const segments = path.split("/").filter((segment) => segment.length > 0);
  if (segments.some((segment) => segment === "." || segment === "..")) {
    throw new IngestionError("BAD_REQUEST", "The storage path is not valid.");
  }
  return segments.map(encodeURIComponent).join("/");
}

export function createGraphProvider(
  connection: StorageConnection,
  options: GraphProviderOptions = {},
): StorageProvider {
  const config = readConnectionConfig(connection.config);
  const httpFetch = options.fetch ?? globalThis.fetch;
  const now = options.now ?? Date.now;

  async function token(): Promise<string> {
    const tenant = requiredEnv("MSFT_GRAPH_TENANT_ID");
    const cached = tokenCache.get(tenant);
    if (cached && cached.expiresAt > now() + 60_000) {
      return cached.value;
    }

    const body = new URLSearchParams({
      client_id: requiredEnv("MSFT_GRAPH_CLIENT_ID"),
      client_secret: requiredEnv("MSFT_GRAPH_CLIENT_SECRET"),
      scope: "https://graph.microsoft.com/.default",
      grant_type: "client_credentials",
    });
    const response = await httpFetch(
      `https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`,
      {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        cache: "no-store",
      },
    );
    if (!response.ok) {
      throw new IngestionError(
        graphErrorCode(response.status),
        "Microsoft Graph authentication failed.",
      );
    }

    const parsed = tokenSchema.safeParse(await response.json());
    if (!parsed.success) {
      throw new IngestionError("STORAGE_UNAVAILABLE", "Microsoft Graph authentication failed.");
    }
    if (!tokenCache.has(tenant) && tokenCache.size >= TOKEN_CACHE_LIMIT) {
      const oldest = tokenCache.keys().next().value;
      if (oldest !== undefined) {
        tokenCache.delete(oldest);
      }
    }
    tokenCache.set(tenant, {
      value: parsed.data.access_token,
      expiresAt: now() + parsed.data.expires_in * 1000,
    });
    return parsed.data.access_token;
  }

  async function request(
    method: string,
    path: string,
    init: { body?: BodyInit; headers?: Record<string, string>; timeoutMs?: number } = {},
  ): Promise<Response> {
    const accessToken = await token();
    return httpFetch(`${GRAPH_BASE}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${accessToken}`,
        ...init.headers,
      },
      body: init.body,
      signal: AbortSignal.timeout(init.timeoutMs ?? REQUEST_TIMEOUT_MS),
      cache: "no-store",
    });
  }

  function requireSiteDrive(): { siteId: string; driveId: string } {
    if (!config.siteId || !config.driveId) {
      throw new IngestionError(
        "INTEGRATION_NOT_CONFIGURED",
        "The SharePoint site and drive are not configured.",
      );
    }
    return { siteId: config.siteId, driveId: config.driveId };
  }

  function bodyFor(bytes: Uint8Array): BodyInit {
    // Node fetch accepts Uint8Array; the DOM BodyInit type is narrower.
    return bytes as unknown as BodyInit;
  }

  return {
    kind: "SHAREPOINT",

    async healthCheck() {
      try {
        const { siteId } = requireSiteDrive();
        const response = await request("GET", `/sites/${encodeURIComponent(siteId)}/drive`);
        if (!response.ok) {
          return { ok: false, code: graphErrorCode(response.status) };
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
      const { driveId } = requireSiteDrive();
      const path = encodePath(input.path);
      const checksum = checksumOf(input.bytes);
      const drivePath = `/drives/${encodeURIComponent(driveId)}/root:/${path}`;

      let response: Response;
      if (input.bytes.byteLength < SMALL_UPLOAD_BYTES) {
        response = await request("PUT", `${drivePath}:/content`, {
          body: bodyFor(input.bytes),
          headers: {
            "content-type": input.contentType,
            "if-none-match": "*",
          },
          timeoutMs: LARGE_UPLOAD_TIMEOUT_MS,
        });
        if (response.status === 409 || response.status === 412) {
          throw new IngestionError("DUPLICATE_DOCUMENT", "The file already exists in storage.");
        }
      } else {
        const sessionResponse = await request("POST", `${drivePath}:/createUploadSession`, {
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ item: { "@microsoft.graph.conflictBehavior": "fail" } }),
        });
        if (!sessionResponse.ok) {
          throw new IngestionError(
            graphErrorCode(sessionResponse.status),
            "The storage provider could not start the upload.",
          );
        }
        const session = uploadSessionSchema.safeParse(await sessionResponse.json());
        if (!session.success) {
          throw new IngestionError(
            "STORAGE_UNAVAILABLE",
            "The storage provider could not start the upload.",
          );
        }
        // The session URL carries its own short-lived credential: never log it.
        response = await httpFetch(session.data.uploadUrl, {
          method: "PUT",
          headers: {
            "content-range": `bytes 0-${input.bytes.byteLength - 1}/${input.bytes.byteLength}`,
            "content-type": input.contentType,
          },
          body: bodyFor(input.bytes),
          signal: AbortSignal.timeout(LARGE_UPLOAD_TIMEOUT_MS),
          cache: "no-store",
        });
      }

      if (!response.ok) {
        throw new IngestionError(
          graphErrorCode(response.status),
          "The storage provider rejected the upload.",
        );
      }
      const parsed = itemSchema.safeParse(await response.json());
      if (!parsed.success || !parsed.data.webUrl) {
        throw new IngestionError(
          "STORAGE_UNAVAILABLE",
          "The storage provider returned an incomplete result.",
        );
      }
      return {
        itemId: parsed.data.id,
        webUrl: parsed.data.webUrl,
        path: input.path,
        checksum,
      };
    },

    async read(input: StorageReadInput): Promise<StorageReadResult> {
      const { driveId } = requireSiteDrive();
      if (input.range && (input.range.start < 0 || input.range.end < input.range.start)) {
        throw new IngestionError("BAD_REQUEST", "The requested byte range is not valid.");
      }
      const response = await request(
        "GET",
        `/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(input.itemId)}/content`,
        {
          ...(input.range
            ? { headers: { range: `bytes=${input.range.start}-${input.range.end}` } }
            : {}),
        },
      );
      if (!response.ok) {
        throw new IngestionError(
          graphErrorCode(response.status),
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
