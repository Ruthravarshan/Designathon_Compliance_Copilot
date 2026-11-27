import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { IngestionError } from "@/server/ingestion/errors";
import { assertConnectionWorkspace, checksumOf, readConnectionConfig } from "./config";
import type {
  StorageConnection,
  StorageProvider,
  StorageReadInput,
  StorageReadResult,
  StorageUploadInput,
  StoredObject,
} from "./types";

const SIGNED_URL_TTL_SECONDS = 60;
const REQUEST_TIMEOUT_MS = 20_000;

interface StorageError {
  message: string;
}

export interface SupabaseStorageLike {
  upload(
    path: string,
    bytes: Uint8Array,
    options: { contentType: string; upsert: boolean },
  ): Promise<{ error: StorageError | null }>;
  createSignedUrl(
    path: string,
    expiresIn: number,
  ): Promise<{ data: { signedUrl: string } | null; error: StorageError | null }>;
  list(path: string, options: { limit: number }): Promise<{ error: StorageError | null }>;
}

export interface SupabaseClientLike {
  storage: { from(bucket: string): SupabaseStorageLike };
}

export interface SupabaseProviderOptions {
  client?: SupabaseClientLike;
  fetch?: typeof globalThis.fetch;
}

function requiredEnv(name: string): string {
  const parsed = z.string().trim().min(1).safeParse(process.env[name]);
  if (!parsed.success) {
    throw new IngestionError(
      "INTEGRATION_NOT_CONFIGURED",
      `Supabase ${name} is not configured.`,
    );
  }
  return parsed.data;
}

export function createSupabaseProvider(
  connection: StorageConnection,
  options: SupabaseProviderOptions = {},
): StorageProvider {
  const config = readConnectionConfig(connection.config);
  const httpFetch = options.fetch ?? globalThis.fetch;
  let client = options.client;

  function bucket(): string {
    if (!config.bucket) {
      throw new IngestionError("INTEGRATION_NOT_CONFIGURED", "The Supabase bucket is not configured.");
    }
    return config.bucket;
  }

  function getClient(): SupabaseClientLike {
    if (client) {
      return client;
    }
    const supabaseUrl = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
    const serviceKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
    client = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    }) as unknown as SupabaseClientLike;
    return client;
  }

  return {
    kind: "SUPABASE_STORAGE",

    async healthCheck() {
      try {
        const result = await getClient().storage.from(bucket()).list("", { limit: 1 });
        return result.error ? { ok: false, code: "STORAGE_UNAVAILABLE" } : { ok: true };
      } catch (error) {
        return { ok: false, code: error instanceof IngestionError ? error.ingestionCode : "STORAGE_UNAVAILABLE" };
      }
    },

    async upload(input: StorageUploadInput): Promise<StoredObject> {
      assertConnectionWorkspace(connection, input.workspaceId);
      const result = await getClient()
        .storage.from(bucket())
        .upload(input.path, input.bytes, { contentType: input.contentType, upsert: false });
      if (result.error) {
        throw new IngestionError("STORAGE_UNAVAILABLE", "The private bucket rejected the upload.");
      }
      // Signed URLs are short-lived and must never be exposed to the browser.
      // Qoder links the persisted file through the authorized app proxy instead.
      return {
        itemId: input.path,
        webUrl: "",
        path: input.path,
        checksum: checksumOf(input.bytes),
      };
    },

    async read(input: StorageReadInput): Promise<StorageReadResult> {
      if (input.range && (input.range.start < 0 || input.range.end < input.range.start)) {
        throw new IngestionError("BAD_REQUEST", "The requested byte range is not valid.");
      }
      const signed = await getClient()
        .storage.from(bucket())
        .createSignedUrl(input.itemId, SIGNED_URL_TTL_SECONDS);
      if (signed.error || !signed.data) {
        throw new IngestionError("STORAGE_UNAVAILABLE", "The stored file could not be prepared.");
      }
      const response = await httpFetch(signed.data.signedUrl, {
        headers: input.range
          ? { range: `bytes=${input.range.start}-${input.range.end}` }
          : undefined,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        cache: "no-store",
      });
      if (!response.ok) {
        throw new IngestionError("STORAGE_UNAVAILABLE", "The stored file could not be read.");
      }
      const bytes = new Uint8Array(await response.arrayBuffer());
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(bytes);
          controller.close();
        },
      });
      const contentLengthHeader = response.headers.get("content-length");
      const contentLength = contentLengthHeader ? Number.parseInt(contentLengthHeader, 10) : undefined;
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
