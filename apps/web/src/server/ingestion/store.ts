import {
  getStorageProvider,
  safeObjectPath,
  sanitizePathSegment,
  checksumOf,
} from "@/server/storage";
import type { StorageConnection, StorageProvider, StoredObject } from "@/server/storage/types";
import { IngestionError, type IngestionErrorCode } from "./errors";
import { getRuntime, type IngestionRepository } from "./runtime";

const MAX_FILENAME_LENGTH = 120;
const FALLBACK_CODES: ReadonlySet<IngestionErrorCode> = new Set([
  "INTEGRATION_NOT_CONFIGURED",
  "STORAGE_UNAVAILABLE",
]);

export interface StorePdfInput {
  workspaceId: string;
  bytes: Uint8Array;
  filename: string;
  checksum?: string;
  issuer: string | null;
  reference: string | null;
  publishedAt: string | null;
  connection: StorageConnection;
  /** Standby connection an admin configured; used only for the safe codes above. */
  fallback?: StorageConnection;
  /** Test seam; production always uses the configured provider. */
  provider?: StorageProvider;
  /** Test seam for the standby connection. */
  fallbackProvider?: StorageProvider;
}

export interface StorePdfResult {
  duplicate: boolean;
  documentId?: string;
  stored?: StoredObject;
  filename: string;
  size: number;
  path?: string;
  storageConnectionId: string;
  usedFallback?: boolean;
}

/** Never overwrite: a known checksum links the existing document instead. */
export function displayFilename(filename: string): string {
  const base = filename.split(/[\\/]/).pop() ?? "";
  const clean = sanitizePathSegment(base).slice(0, MAX_FILENAME_LENGTH);
  return clean === ""
    ? "circular.pdf"
    : clean.toLowerCase().endsWith(".pdf")
      ? clean
      : `${clean}.pdf`;
}

export function objectPath(input: {
  workspaceId: string;
  issuer: string | null;
  reference: string | null;
  publishedAt: string | null;
  checksum: string;
  now?: () => Date;
}): string {
  const yearMatch = /^(\d{4})-\d{2}-\d{2}$/.exec(input.publishedAt ?? "");
  const fallbackYear = String((input.now ?? (() => new Date()))().getUTCFullYear());
  const year = yearMatch?.[1] ?? fallbackYear;
  const checksum8 = input.checksum.slice(0, 8);
  return safeObjectPath([
    input.workspaceId,
    input.issuer ?? "unclassified",
    year,
    `${input.reference ?? "upload"}-${checksum8}.pdf`,
  ]);
}

export async function storePdf(
  input: StorePdfInput,
  repository: IngestionRepository = getRuntime().repository,
): Promise<StorePdfResult> {
  const filename = displayFilename(input.filename);
  const checksum = input.checksum ?? checksumOf(input.bytes);
  const filenameForPath = filename.replace(/\.pdf$/i, "");
  const path = objectPath({
    workspaceId: input.workspaceId,
    issuer: input.issuer,
    reference: input.reference ?? filenameForPath,
    publishedAt: input.publishedAt,
    checksum,
  });

  const existing = await repository.findFileByChecksum(input.workspaceId, checksum);
  if (existing) {
    return {
      duplicate: true,
      documentId: existing.documentId,
      filename,
      size: input.bytes.byteLength,
      storageConnectionId: input.connection.id,
    };
  }

  if (input.connection.workspaceId !== input.workspaceId) {
    throw new IngestionError(
      "BAD_REQUEST",
      "The storage connection does not belong to this workspace.",
    );
  }

  const provider = input.provider ?? getStorageProvider(input.connection);
  const upload = (target: StorageConnection, via: StorageProvider | undefined) =>
    (via ?? getStorageProvider(target)).upload({
      workspaceId: input.workspaceId,
      path,
      bytes: input.bytes,
      contentType: "application/pdf",
      filename,
    });

  let used = input.connection;
  let stored: StoredObject;
  try {
    stored = await upload(input.connection, provider);
  } catch (error) {
    const fallback = input.fallback;
    const code = error instanceof IngestionError ? error.ingestionCode : null;
    const eligible =
      fallback !== undefined &&
      fallback.id !== input.connection.id &&
      fallback.workspaceId === input.workspaceId &&
      code !== null &&
      FALLBACK_CODES.has(code);
    if (!eligible) {
      throw error;
    }
    stored = await upload(fallback, input.fallbackProvider);
    used = fallback;
  }

  return {
    duplicate: false,
    stored,
    filename,
    size: input.bytes.byteLength,
    path,
    storageConnectionId: used.id,
    ...(used.id !== input.connection.id ? { usedFallback: true } : {}),
  };
}
