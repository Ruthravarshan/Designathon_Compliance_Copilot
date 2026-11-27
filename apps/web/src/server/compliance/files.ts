import "server-only";
import { logger } from "@/lib/logger";
import { IngestionError, type IngestionErrorCode } from "@/server/ingestion/errors";
import { getStorageProvider, checksumOf, safeObjectPath } from "@/server/storage";
import { listStorageConnections } from "@/server/storage/connections";
import { selectStorageConnections } from "@/server/storage/selection";
import type { StoredObject } from "@/server/storage/types";

export const MAX_ARCHIVE_BYTES = 20 * 1024 * 1024;

const FALLBACK_CODES: ReadonlySet<IngestionErrorCode> = new Set([
  "INTEGRATION_NOT_CONFIGURED",
  "STORAGE_UNAVAILABLE",
]);

export interface DocumentStoragePointer {
  connectionId: string;
  itemId: string;
  webUrl: string;
  path: string;
  modifiedAt?: Date;
}

export interface ArchivedDocumentFile {
  filename: string;
  contentType: string;
  checksum: string;
  /** Backed by a plain ArrayBuffer so it fits Prisma's Bytes column. */
  bytes: Uint8Array<ArrayBuffer>;
  storage: DocumentStoragePointer | null;
  usedFallback: boolean;
}

export interface ArchiveFileInput {
  workspaceId: string;
  bytes: Uint8Array;
  filename: string;
  contentType: string;
  regulator: string;
  reference: string;
  publishedAt: Date;
  /** Imported from a provider: the object already lives there. */
  existingStorage?: DocumentStoragePointer;
}

function cleanFilename(value: string): string {
  const base = value.split(/[\\/]/).pop() ?? "document.pdf";
  const safe = base.replace(/[^\w.\- ()]+/g, "-").slice(0, 140).trim();
  return safe.length > 0 ? (safe.toLowerCase().endsWith(".pdf") ? safe : `${safe}.pdf`) : "document.pdf";
}

/**
 * Keeps the real bytes on the document so the authorized PDF link always works,
 * and mirrors the file into the primary storage connection when one is
 * configured. A missing or failing provider is logged and does not destroy the
 * ingested document; the archive copy remains the source of truth for the demo.
 */
export async function archiveDocumentFile(
  input: ArchiveFileInput,
): Promise<ArchivedDocumentFile> {
  if (input.bytes.byteLength === 0) {
    throw new IngestionError("INVALID_PDF", "The PDF is empty.");
  }
  if (input.bytes.byteLength > MAX_ARCHIVE_BYTES) {
    throw new IngestionError("BAD_REQUEST", "The PDF is larger than the 20 MB archive limit.");
  }

  // Copy into a plain ArrayBuffer so the bytes fit Prisma's Bytes input type.
  const bytes = new Uint8Array(input.bytes.byteLength);
  bytes.set(input.bytes);

  const filename = cleanFilename(input.filename);
  const checksum = checksumOf(bytes);

  if (input.existingStorage) {
    return {
      filename,
      contentType: input.contentType,
      checksum,
      bytes,
      storage: input.existingStorage,
      usedFallback: false,
    };
  }

  let storage: DocumentStoragePointer | null = null;
  let usedFallback = false;

  try {
    const connections = await listStorageConnections(input.workspaceId);
    const { primary, fallback } = selectStorageConnections(connections);

    if (primary) {
      const year = String(input.publishedAt.getUTCFullYear());
      const path = safeObjectPath([
        input.workspaceId,
        input.regulator.toLowerCase(),
        year,
        `${input.reference}-${checksum.slice(0, 8)}.pdf`,
      ]);

      const byId = new Map(connections.map((connection) => [connection.id, connection]));
      const upload = async (connectionId: string): Promise<StoredObject> => {
        const connection = byId.get(connectionId);
        if (!connection) {
          throw new IngestionError(
            "STORAGE_UNAVAILABLE",
            "The storage connection is no longer available.",
          );
        }
        return getStorageProvider(connection).upload({
          workspaceId: input.workspaceId,
          path,
          bytes,
          contentType: input.contentType,
          filename,
        });
      };

      let stored: StoredObject | null = null;
      let usedId = primary.id;
      try {
        stored = await upload(primary.id);
      } catch (error) {
        const code = error instanceof IngestionError ? error.ingestionCode : null;
        if (fallback && fallback.id !== primary.id && code && FALLBACK_CODES.has(code)) {
          stored = await upload(fallback.id);
          usedId = fallback.id;
          usedFallback = true;
        } else {
          throw error;
        }
      }

      if (stored) {
        storage = {
          connectionId: usedId,
          itemId: stored.itemId,
          webUrl: stored.webUrl,
          path: stored.path,
        };
      }
    }
  } catch (error) {
    logger.warn(
      {
        workspaceId: input.workspaceId,
        errorName: error instanceof Error ? error.name : "UnknownError",
        code:
          error instanceof IngestionError ? error.ingestionCode : "STORAGE_MIRROR_UNAVAILABLE",
      },
      "storage mirror unavailable; PDF kept in the workspace archive",
    );
  }

  return {
    filename,
    contentType: input.contentType,
    checksum,
    bytes,
    storage,
    usedFallback,
  };
}
