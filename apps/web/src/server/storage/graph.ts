import { z } from "zod";
import { IngestionError, type IngestionErrorCode } from "@/server/ingestion/errors";
import { assertConnectionWorkspace, checksumOf, readConnectionConfig } from "./config";
import type {
  StorageConnection,
  StorageListInput,
  StorageListResult,
  StorageProvider,
  StorageReadInput,
  StorageReadResult,
  StorageStat,
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
const driveSchema = z.object({ id: z.string().min(1) });
const sharedItemSchema = z.object({
  id: z.string().min(1),
  parentReference: z.object({ driveId: z.string().min(1).optional() }).optional(),
});
const childrenSchema = z.object({
  value: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string(),
      size: z.number().optional(),
      lastModifiedDateTime: z.string().optional(),
      webUrl: z.string().url().optional(),
      folder: z.object({}).optional(),
      file: z.object({ mimeType: z.string().optional() }).optional(),
    }),
  ),
  "@odata.nextLink": z.string().url().optional(),
});
const statSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  size: z.number().optional(),
  lastModifiedDateTime: z.string().optional(),
  webUrl: z.string().url().optional(),
});

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

/** Graph share id for a sharing link: "u!" + unpadded base64url of the URL. */
export function graphShareId(url: string): string {
  return `u!${Buffer.from(url).toString("base64url")}`;
}

function trimFolder(folder: string | undefined): string {
  return (folder ?? "").replace(/^\/+|\/+$/g, "");
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

  function bodyFor(bytes: Uint8Array): BodyInit {
    // Node fetch accepts Uint8Array; the DOM BodyInit type is narrower.
    return bytes as unknown as BodyInit;
  }

  interface DriveTarget {
    driveId: string;
    folderItemId?: string;
    folderPath: string;
  }

  let resolvedTarget: DriveTarget | null = null;

  async function resolveSharedFolder(url: string): Promise<{ driveId: string; itemId: string }> {
    const response = await request(
      "GET",
      `/shares/${encodeURIComponent(graphShareId(url))}/driveItem?$select=id,parentReference`,
    );
    if (!response.ok) {
      throw new IngestionError(
        graphErrorCode(response.status),
        "The shared SharePoint folder could not be resolved.",
      );
    }
    const parsed = sharedItemSchema.safeParse(await response.json());
    const driveId = parsed.success ? parsed.data.parentReference?.driveId : undefined;
    if (!parsed.success || !driveId) {
      throw new IngestionError(
        "STORAGE_UNAVAILABLE",
        "The shared SharePoint folder could not be resolved.",
      );
    }
    return { driveId, itemId: parsed.data.id };
  }

  async function resolveDriveId(): Promise<string> {
    if (config.driveId) {
      return config.driveId;
    }
    if (config.driveOwner) {
      const response = await request(
        "GET",
        `/users/${encodeURIComponent(config.driveOwner)}/drive?$select=id`,
      );
      if (!response.ok) {
        throw new IngestionError(
          graphErrorCode(response.status),
          "The SharePoint drive owner could not be resolved.",
        );
      }
      const parsed = driveSchema.safeParse(await response.json());
      if (!parsed.success) {
        throw new IngestionError(
          "STORAGE_UNAVAILABLE",
          "The SharePoint drive owner could not be resolved.",
        );
      }
      return parsed.data.id;
    }
    if (config.siteId) {
      const response = await request(
        "GET",
        `/sites/${encodeURIComponent(config.siteId)}/drive?$select=id`,
      );
      if (!response.ok) {
        throw new IngestionError(
          graphErrorCode(response.status),
          "The SharePoint site drive could not be resolved.",
        );
      }
      const parsed = driveSchema.safeParse(await response.json());
      if (!parsed.success) {
        throw new IngestionError(
          "STORAGE_UNAVAILABLE",
          "The SharePoint site drive could not be resolved.",
        );
      }
      return parsed.data.id;
    }
    throw new IngestionError(
      "INTEGRATION_NOT_CONFIGURED",
      "The SharePoint drive is not configured.",
    );
  }

  async function target(): Promise<DriveTarget> {
    if (resolvedTarget) {
      return resolvedTarget;
    }

    const folderPath = trimFolder(config.folder);
    if (config.folderItemId) {
      resolvedTarget = {
        driveId: await resolveDriveId(),
        folderItemId: config.folderItemId,
        folderPath,
      };
      return resolvedTarget;
    }
    if (config.folderUrl) {
      const shared = await resolveSharedFolder(config.folderUrl);
      resolvedTarget = {
        driveId: shared.driveId,
        folderItemId: shared.itemId,
        folderPath,
      };
      return resolvedTarget;
    }
    resolvedTarget = { driveId: await resolveDriveId(), folderPath };
    return resolvedTarget;
  }

  function contentBase(resolved: DriveTarget, path: string): string {
    const relative = resolved.folderPath ? `${encodePath(resolved.folderPath)}/${path}` : path;
    const root = resolved.folderItemId
      ? `/drives/${encodeURIComponent(resolved.driveId)}/items/${encodeURIComponent(resolved.folderItemId)}`
      : `/drives/${encodeURIComponent(resolved.driveId)}/root`;
    return `${root}:/${relative}`;
  }

  return {
    kind: "SHAREPOINT",

    async healthCheck() {
      try {
        const resolved = await target();
        const response = await request("GET", `/drives/${encodeURIComponent(resolved.driveId)}`);
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
      const path = encodePath(input.path);
      const checksum = checksumOf(input.bytes);
      const drivePath = contentBase(await target(), path);

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

    async list(input: StorageListInput): Promise<StorageListResult> {
      const resolved = await target();
      const folderItemId = input.folderId ?? resolved.folderItemId;
      let path: string;
      if (folderItemId) {
        path = `/drives/${encodeURIComponent(resolved.driveId)}/items/${encodeURIComponent(folderItemId)}/children`;
      } else if (resolved.folderPath) {
        path = `/drives/${encodeURIComponent(resolved.driveId)}/root:/${encodePath(resolved.folderPath)}:/children`;
      } else {
        path = `/drives/${encodeURIComponent(resolved.driveId)}/root/children`;
      }
      const url = input.pageToken
        ? input.pageToken
        : `${path}?$select=id,name,size,lastModifiedDateTime,webUrl,folder,file&$top=${Math.min(Math.max(input.limit ?? 100, 1), 200)}`;
      const response = url.startsWith("http")
        ? await httpFetch(url, {
            method: "GET",
            headers: { authorization: `Bearer ${await token()}` },
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
            cache: "no-store",
          })
        : await request("GET", url);
      if (!response.ok) {
        throw new IngestionError(
          graphErrorCode(response.status),
          "The SharePoint folder could not be listed.",
        );
      }
      const parsed = childrenSchema.safeParse(await response.json());
      if (!parsed.success) {
        throw new IngestionError(
          "STORAGE_UNAVAILABLE",
          "The storage provider returned an incomplete folder listing.",
        );
      }
      return {
        entries: parsed.data.value.map((item) => ({
          id: item.id,
          name: item.name,
          kind: item.folder ? "folder" : "file",
          ...(typeof item.size === "number" ? { size: item.size } : {}),
          ...(item.file?.mimeType ? { contentType: item.file.mimeType } : {}),
          ...(item.lastModifiedDateTime ? { modifiedAt: item.lastModifiedDateTime } : {}),
          ...(item.webUrl ? { webUrl: item.webUrl } : {}),
        })),
        ...(parsed.data["@odata.nextLink"]
          ? { nextPageToken: parsed.data["@odata.nextLink"] }
          : {}),
      };
    },

    async stat(itemId: string): Promise<StorageStat | null> {
      const { driveId } = await target();
      const response = await request(
        "GET",
        `/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(itemId)}?$select=id,name,size,lastModifiedDateTime,webUrl`,
      );
      if (response.status === 404) {
        return null;
      }
      if (!response.ok) {
        throw new IngestionError(
          graphErrorCode(response.status),
          "The stored file could not be inspected.",
        );
      }
      const parsed = statSchema.safeParse(await response.json());
      if (!parsed.success) {
        throw new IngestionError(
          "STORAGE_UNAVAILABLE",
          "The storage provider returned incomplete file details.",
        );
      }
      return {
        id: parsed.data.id,
        name: parsed.data.name,
        ...(typeof parsed.data.size === "number" ? { size: parsed.data.size } : {}),
        ...(parsed.data.lastModifiedDateTime
          ? { modifiedAt: parsed.data.lastModifiedDateTime }
          : {}),
        ...(parsed.data.webUrl ? { webUrl: parsed.data.webUrl } : {}),
      };
    },

    async read(input: StorageReadInput): Promise<StorageReadResult> {
      const { driveId } = await target();
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
