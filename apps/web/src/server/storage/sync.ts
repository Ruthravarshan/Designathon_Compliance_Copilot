import "server-only";
import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { logger } from "@/lib/logger";
import { db } from "@/server/db";
import { recordAudit } from "@/server/audit";
import { IngestionError } from "@/server/ingestion/errors";
import { indexDocument } from "@/server/search/indexer";
import { extractDocument } from "@/server/watch/fetch";
import { checksumOf } from "./config";
import { listStorageConnections } from "./connections";
import { getStorageProvider } from "./index";
import type { StorageProvider } from "./types";

const MAX_SYNC_BYTES = 25 * 1024 * 1024;
const MAX_DOCUMENTS_PER_RUN = 50;

export interface StorageSyncResult {
  workspaceId: string;
  checked: number;
  updated: number;
  reindexed: number;
  failed: number;
  skipped: number;
}

async function collectBytes(body: ReadableStream, limit: number): Promise<Uint8Array<ArrayBuffer>> {
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    if (value) {
      total += value.byteLength;
      if (total > limit) {
        await reader.cancel();
        throw new IngestionError("RESPONSE_TOO_LARGE", "The stored file is too large to sync.");
      }
      chunks.push(value);
    }
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return merged;
}

/**
 * Compares the stored file's modified time against the archived copy. A newer
 * file is re-downloaded, re-extracted, and re-embedded; the changed text also
 * resets clause-derived findings so the review queue reflects the new revision.
 */
export async function syncWorkspaceStorage(workspaceId: string): Promise<StorageSyncResult> {
  const result: StorageSyncResult = {
    workspaceId,
    checked: 0,
    updated: 0,
    reindexed: 0,
    failed: 0,
    skipped: 0,
  };

  const connections = await listStorageConnections(workspaceId);
  if (connections.length === 0) {
    return result;
  }
  const connectionById = new Map(connections.map((connection) => [connection.id, connection]));

  const documents = await db.regulatoryDocument.findMany({
    where: {
      workspaceId,
      storageConnectionId: { not: null },
      storageItemId: { not: null },
    },
    orderBy: { ingestedAt: "asc" },
    take: MAX_DOCUMENTS_PER_RUN,
    select: {
      id: true,
      reference: true,
      sourceUrl: true,
      checksum: true,
      storageConnectionId: true,
      storageItemId: true,
      storageModifiedAt: true,
    },
  });

  for (const document of documents) {
    const connection = document.storageConnectionId
      ? connectionById.get(document.storageConnectionId)
      : undefined;
    if (!connection || !document.storageItemId) {
      result.skipped += 1;
      continue;
    }

    let provider: StorageProvider;
    try {
      provider = getStorageProvider(connection);
    } catch {
      result.skipped += 1;
      continue;
    }
    if (!provider.stat) {
      result.skipped += 1;
      continue;
    }

    result.checked += 1;
    try {
      const stat = await provider.stat(document.storageItemId);
      if (!stat || !stat.modifiedAt) {
        result.skipped += 1;
        continue;
      }
      const modifiedAt = new Date(stat.modifiedAt);
      if (Number.isNaN(modifiedAt.getTime())) {
        result.skipped += 1;
        continue;
      }
      if (document.storageModifiedAt && modifiedAt <= document.storageModifiedAt) {
        continue;
      }

      const read = await provider.read({ itemId: document.storageItemId });
      const bytes = await collectBytes(read.body, MAX_SYNC_BYTES);
      const extracted = await extractDocument({
        finalUrl: document.sourceUrl,
        contentType: read.contentType,
        bytes: Buffer.from(bytes),
      });
      if (extracted.clauses.length === 0) {
        result.skipped += 1;
        continue;
      }

      const textChecksum = createHash("sha256").update(extracted.text.trim()).digest("hex");
      const fileChecksum = checksumOf(bytes);

      if (textChecksum === document.checksum) {
        await db.regulatoryDocument.update({
          where: { id: document.id },
          data: {
            storageModifiedAt: modifiedAt,
            fileChecksum,
            fileBytes: bytes,
            ...(stat.webUrl ? { storageWebUrl: stat.webUrl } : {}),
            ...(stat.name ? { filename: stat.name } : {}),
          },
        });
        result.updated += 1;
        continue;
      }

      await db.$transaction(async (tx) => {
        // Clause-derived obligations and findings are regenerated for the new text.
        await tx.documentClause.deleteMany({ where: { documentId: document.id } });
        for (const [index, clause] of extracted.clauses.entries()) {
          await tx.documentClause.create({
            data: {
              workspaceId,
              documentId: document.id,
              sectionLabel: clause.sectionLabel,
              heading: clause.heading ?? null,
              pageNumber: clause.pageNumber,
              orderIndex: index + 1,
              text: clause.text,
            },
          });
        }
        await tx.regulatoryDocument.update({
          where: { id: document.id },
          data: {
            content: extracted.text.trim(),
            checksum: textChecksum,
            pageCount: extracted.pageCount,
            fileChecksum,
            fileBytes: bytes,
            fileContentType: read.contentType,
            ...(stat.name ? { filename: stat.name } : {}),
            ...(stat.webUrl ? { storageWebUrl: stat.webUrl } : {}),
            storageModifiedAt: modifiedAt,
            indexStatus: "PENDING",
          },
        });
        await tx.regulatoryRevision.create({
          data: {
            workspaceId,
            documentId: document.id,
            previousChecksum: document.checksum,
            newChecksum: textChecksum,
            previousContent: "",
            newContent: extracted.text.trim(),
            summary: "Storage change detected; clauses re-extracted and findings regenerated.",
            diff: [] as unknown as Prisma.InputJsonValue,
          },
        });
        await recordAudit(
          {
            workspaceId,
            actorId: null,
            action: "document.storage_synced",
            entity: "RegulatoryDocument",
            entityId: document.id,
            metadata: {
              reference: document.reference,
              provider: connection.provider,
              clauses: extracted.clauses.length,
            },
          },
          tx,
        );
      });

      const index = await indexDocument({ workspaceId, documentId: document.id });
      if (index.status === "READY") {
        result.reindexed += 1;
      }
      result.updated += 1;
    } catch (error) {
      result.failed += 1;
      logger.warn(
        {
          workspaceId,
          documentId: document.id,
          errorName: error instanceof Error ? error.name : "UnknownError",
          code: error instanceof IngestionError ? error.ingestionCode : "STORAGE_SYNC_FAILED",
        },
        "storage sync failed for document",
      );
    }
  }

  return result;
}

export async function syncAllWorkspaceStorage(): Promise<StorageSyncResult[]> {
  const workspaces = await db.storageConnection.findMany({
    select: { workspaceId: true },
    distinct: ["workspaceId"],
  });
  const results: StorageSyncResult[] = [];
  for (const workspace of workspaces) {
    try {
      results.push(await syncWorkspaceStorage(workspace.workspaceId));
    } catch (error) {
      logger.warn(
        {
          workspaceId: workspace.workspaceId,
          errorName: error instanceof Error ? error.name : "UnknownError",
        },
        "storage sync failed for workspace",
      );
    }
  }
  return results;
}
