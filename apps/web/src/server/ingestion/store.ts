import {
  getStorageProvider,
  safeObjectPath,
  sanitizePathSegment,
  checksumOf,
} from "@/server/storage";
import type { StorageConnection, StorageProvider, StoredObject } from "@/server/storage/types";
import { IngestionError } from "./errors";
import { getRuntime, type IngestionRepository } from "./runtime";

const MAX_FILENAME_LENGTH = 120;

export interface StorePdfInput {
  workspaceId: string;
  bytes: Uint8Array;
  filename: string;
  checksum?: string;
  issuer: string | null;
  reference: string | null;
  publishedAt: string | null;
  connection: StorageConnection;
  /** Test seam; production always uses the configured provider. */
  provider?: StorageProvider;
}

export interface StorePdfResult {
  duplicate: boolean;
  documentId?: string;
  stored?: StoredObject;
  filename: string;
  size: number;
  path?: string;
  storageConnectionId: string;
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
  const stored = await provider.upload({
    workspaceId: input.workspaceId,
    path,
    bytes: input.bytes,
    contentType: "application/pdf",
    filename,
  });

  return {
    duplicate: false,
    stored,
    filename,
    size: input.bytes.byteLength,
    path,
    storageConnectionId: input.connection.id,
  };
}
