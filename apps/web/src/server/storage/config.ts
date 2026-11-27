import { createHash } from "node:crypto";
import { z } from "zod";
import { IngestionError } from "@/server/ingestion/errors";
import type { StorageConnection, StorageConnectionConfig } from "./types";

export const connectionConfigSchema = z.object({
  siteId: z.string().trim().min(1).optional(),
  driveId: z.string().trim().min(1).optional(),
  driveOwner: z.string().trim().min(1).optional(),
  folder: z.string().trim().min(1).optional(),
  folderItemId: z.string().trim().min(1).optional(),
  folderUrl: z.string().trim().url().optional(),
  folderId: z.string().trim().min(1).optional(),
  bucket: z.string().trim().min(1).optional(),
  pathPrefix: z.string().trim().min(1).optional(),
});

export function readConnectionConfig(value: unknown): StorageConnectionConfig {
  const parsed = connectionConfigSchema.safeParse(value);
  if (!parsed.success) {
    throw new IngestionError(
      "INTEGRATION_NOT_CONFIGURED",
      "The storage connection settings are invalid.",
    );
  }
  return parsed.data;
}

export function assertConnectionWorkspace(
  connection: StorageConnection,
  workspaceId: string,
): void {
  if (connection.workspaceId !== workspaceId) {
    throw new IngestionError(
      "BAD_REQUEST",
      "The storage connection does not belong to this workspace.",
    );
  }
}

/** Slug to [a-z0-9._-], 80 chars, with traversal stripped before it reaches a provider. */
export function sanitizePathSegment(value: string): string {
  const slug = value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, "")
    .replace(/-+/g, "-")
    .slice(0, 80);
  return slug === "" || slug === "." || slug === ".." ? "unclassified" : slug;
}

export function safeObjectPath(segments: readonly string[]): string {
  const clean = segments.map(sanitizePathSegment);
  if (clean.some((segment) => segment === "." || segment === "..")) {
    throw new IngestionError("BAD_REQUEST", "The storage path is not valid.");
  }
  return clean.join("/");
}

export function checksumOf(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/** Extracts the folder id from a Google Drive folder link: /folders/<id> or ?id=<id>. */
export function driveFolderIdFromUrl(url: string): string | null {
  const match =
    /\/folders\/([A-Za-z0-9_-]{6,})/.exec(url) ?? /[?&]id=([A-Za-z0-9_-]{6,})/.exec(url);
  return match?.[1] ?? null;
}
