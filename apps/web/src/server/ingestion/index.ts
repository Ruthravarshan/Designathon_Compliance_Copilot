import { z } from "zod";
import { checksumOf } from "@/server/storage";
import type { StorageProvider } from "@/server/storage/types";
import { parseHttpUrl } from "./fetch";
import { IngestionError } from "./errors";
import { hasPdfMagic } from "./pdf";
import { getRuntime } from "./runtime";
import { storePdf } from "./store";
import { runIngestionJobs as runJobs, type WorkerDeps } from "./worker";
import type { IngestionJobPayload } from "./types";

/**
 * Frozen surface imported by Qoder's routes. Only these three functions are
 * contractual; every extra export is a lane-internal seam.
 *
 *   queueUrlIngest(input): Promise<{ runId, jobId }>
 *   queueUploadedPdf(input): Promise<{ runId?, jobId?, documentId?, duplicate }>
 *   runIngestionJobs(input): Promise<{ processed, failed, skipped }>
 */

const queueUrlSchema = z.object({
  workspaceId: z.string().trim().min(1),
  userId: z.string().trim().min(1),
  url: z.string().trim().min(1).max(2_048).url(),
  mode: z.enum(["url", "listing"]),
  sourceId: z.string().trim().min(1).optional(),
});

const queueUploadSchema = z.object({
  workspaceId: z.string().trim().min(1),
  userId: z.string().trim().min(1),
  bytes: z.custom<Uint8Array>((value) => value instanceof Uint8Array),
  filename: z.string().trim().min(1).max(200),
  sourceId: z.string().trim().min(1).optional(),
});

const DEFAULT_MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

function requireConnection(connection: Awaited<ReturnType<ReturnType<typeof getRuntime>["repository"]["getConnection"]>>): NonNullable<typeof connection> {
  if (!connection) {
    throw new IngestionError("INTEGRATION_NOT_CONFIGURED", "No storage connection is configured.");
  }
  return connection;
}

function validated<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new IngestionError("BAD_REQUEST", "The ingestion request is not valid.");
  }
  return parsed.data;
}

export async function queueUrlIngest(
  input: z.input<typeof queueUrlSchema>,
  deps: { repository?: ReturnType<typeof getRuntime>["repository"] } = {},
): Promise<{ runId: string; jobId: string }> {
  const value = validated(queueUrlSchema, input);
  const repository = deps.repository ?? getRuntime().repository;

  if (!value.sourceId) {
    throw new IngestionError("INTEGRATION_NOT_CONFIGURED", "No ingestion source is configured.");
  }
  const source = await repository.getSource(value.workspaceId, value.sourceId);
  if (!source || !source.enabled) {
    throw new IngestionError("INTEGRATION_NOT_CONFIGURED", "The ingestion source is not enabled.");
  }

  const url = parseHttpUrl(value.url, source.allowHttp);
  if (!source.allowedDomains.includes(url.hostname)) {
    throw new IngestionError("HOST_NOT_ALLOWED", "The source host is not in the configured allowlist.");
  }

  const run = await repository.createRun({
    workspaceId: value.workspaceId,
    userId: value.userId,
    mode: value.mode,
    sourceId: source.id,
  });
  const payload: IngestionJobPayload = {
    workspaceId: value.workspaceId,
    userId: value.userId,
    runId: run.id,
    mode: value.mode,
    sourceId: source.id,
    url: url.toString(),
  };
  const job = await repository.createJob({
    workspaceId: value.workspaceId,
    runId: run.id,
    userId: value.userId,
    mode: value.mode,
    sourceId: source.id,
    payload,
  });
  return { runId: run.id, jobId: job.id };
}

export async function queueUploadedPdf(
  input: z.input<typeof queueUploadSchema>,
  deps: {
    repository?: ReturnType<typeof getRuntime>["repository"];
    provider?: StorageProvider;
  } = {},
): Promise<{ runId?: string; jobId?: string; documentId?: string; duplicate: boolean }> {
  const value = validated(queueUploadSchema, input);
  const repository = deps.repository ?? getRuntime().repository;
  const settings = await repository.getSettings(value.workspaceId);
  const maxBytes = settings?.maxUploadBytes ?? DEFAULT_MAX_UPLOAD_BYTES;
  if (value.bytes.byteLength === 0 || value.bytes.byteLength > maxBytes) {
    throw new IngestionError("BAD_REQUEST", "The uploaded PDF is empty or exceeds the size limit.");
  }
  if (!hasPdfMagic(value.bytes)) {
    throw new IngestionError("INVALID_PDF", "The uploaded file is not a PDF.");
  }

  const checksum = checksumOf(value.bytes);
  const existing = await repository.findFileByChecksum(value.workspaceId, checksum);
  if (existing) {
    return { documentId: existing.documentId, duplicate: true };
  }

  const source = value.sourceId ? await repository.getSource(value.workspaceId, value.sourceId) : null;
  if (value.sourceId && !source) {
    throw new IngestionError("INTEGRATION_NOT_CONFIGURED", "The ingestion source is not configured.");
  }
  const connection = await repository.getConnection(
    value.workspaceId,
    source?.storageConnectionId ?? undefined,
  );
  const stored = await storePdf(
    {
      workspaceId: value.workspaceId,
      bytes: value.bytes,
      filename: value.filename,
      checksum,
      issuer: source?.issuer ?? null,
      reference: null,
      publishedAt: null,
      connection: requireConnection(connection),
      ...(deps.provider ? { provider: deps.provider } : {}),
    },
    repository,
  );
  if (stored.duplicate) {
    return { documentId: stored.documentId, duplicate: true };
  }
  if (!stored.stored || !stored.path) {
    throw new IngestionError("STORAGE_UNAVAILABLE", "The uploaded PDF could not be stored.");
  }

  const run = await repository.createRun({
    workspaceId: value.workspaceId,
    userId: value.userId,
    mode: "url",
    ...(source ? { sourceId: source.id } : {}),
  });
  const payload: IngestionJobPayload = {
    workspaceId: value.workspaceId,
    userId: value.userId,
    runId: run.id,
    mode: "url",
    ...(source ? { sourceId: source.id } : {}),
    storageItemId: stored.stored.itemId,
    storageConnectionId: stored.storageConnectionId,
    checksum,
    filename: stored.filename,
    size: stored.size,
  };
  const job = await repository.createJob({
    workspaceId: value.workspaceId,
    runId: run.id,
    userId: value.userId,
    mode: "url",
    ...(source ? { sourceId: source.id } : {}),
    payload,
  });
  return { runId: run.id, jobId: job.id, duplicate: false };
}

export async function runIngestionJobs(
  input: { limit: number; now?: Date },
  deps: WorkerDeps = {},
): Promise<{ processed: number; failed: number; skipped: number }> {
  return runJobs(input, deps);
}
