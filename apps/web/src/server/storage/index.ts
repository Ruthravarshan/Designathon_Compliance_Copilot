import { IngestionError } from "@/server/ingestion/errors";
import { createGraphProvider } from "./graph";
import { createSupabaseProvider } from "./supabase";
import type { StorageConnection, StorageProvider } from "./types";

export type {
  StorageConnection,
  StorageConnectionConfig,
  StorageKind,
  StorageProvider,
  StorageReadInput,
  StorageReadResult,
  StorageUploadInput,
  StoredObject,
} from "./types";
export { checksumOf, safeObjectPath, sanitizePathSegment } from "./config";

/** Selects exactly the configured connection. Failures never silently fall back. */
export function getStorageProvider(connection: StorageConnection): StorageProvider {
  switch (connection.provider) {
    case "SHAREPOINT":
      return createGraphProvider(connection);
    case "SUPABASE_STORAGE":
      return createSupabaseProvider(connection);
    case "GOOGLE_DRIVE":
      throw new IngestionError(
        "INTEGRATION_NOT_CONFIGURED",
        "Google Drive storage is not configured.",
      );
    default:
      throw new IngestionError("INTEGRATION_NOT_CONFIGURED", "The storage provider is not configured.");
  }
}
