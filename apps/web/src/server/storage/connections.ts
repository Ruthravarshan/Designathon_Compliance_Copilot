import "server-only";
import { Prisma, type StorageConnection as StorageConnectionRow } from "@prisma/client";
import { z } from "zod";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { recordAudit } from "@/server/audit";
import { db } from "@/server/db";
import { connectionConfigSchema, driveFolderIdFromUrl, readConnectionConfig } from "./config";
import { getStorageProvider } from "./index";
import type { StorageConnection, StorageConnectionConfig, StorageKind } from "./types";

export const STORAGE_PROVIDERS = ["SHAREPOINT", "GOOGLE_DRIVE", "SUPABASE_STORAGE"] as const;

export const storageConnectionInputSchema = z.object({
  provider: z.enum(STORAGE_PROVIDERS),
  config: connectionConfigSchema,
  isDefault: z.boolean().optional(),
  isFallback: z.boolean().optional(),
});
export type StorageConnectionInput = z.infer<typeof storageConnectionInputSchema>;

export interface StorageEnvironmentStatus {
  graph: boolean;
  drive: boolean;
  supabase: boolean;
}

function envSet(name: string): boolean {
  return (process.env[name] ?? "").trim().length > 0;
}

/** Secrets stay in the environment; this only tells the UI what is configured. */
export function storageEnvironmentStatus(): StorageEnvironmentStatus {
  return {
    graph:
      envSet("MSFT_GRAPH_TENANT_ID") &&
      envSet("MSFT_GRAPH_CLIENT_ID") &&
      envSet("MSFT_GRAPH_CLIENT_SECRET"),
    drive: envSet("GOOGLE_SERVICE_ACCOUNT_JSON_BASE64"),
    supabase: envSet("NEXT_PUBLIC_SUPABASE_URL") && envSet("SUPABASE_SERVICE_ROLE_KEY"),
  };
}

function normalizeConfig(
  provider: StorageKind,
  config: StorageConnectionConfig,
): StorageConnectionConfig {
  if (provider === "SHAREPOINT") {
    if (!config.driveId && !config.siteId && !config.driveOwner && !config.folderUrl) {
      throw new AppError(
        ERROR_CODES.BAD_REQUEST,
        "Add the SharePoint folder link, or a drive id, site id, or drive owner.",
      );
    }
    return config;
  }

  if (provider === "GOOGLE_DRIVE") {
    const folderId =
      config.folderId ?? (config.folderUrl ? driveFolderIdFromUrl(config.folderUrl) : null);
    if (!folderId) {
      throw new AppError(
        ERROR_CODES.BAD_REQUEST,
        "Paste the Google Drive folder link or enter the folder id.",
      );
    }
    return { ...config, folderId };
  }

  if (!config.bucket) {
    throw new AppError(ERROR_CODES.BAD_REQUEST, "The Supabase Storage bucket is required.");
  }
  return config;
}

function toConnection(row: StorageConnectionRow): StorageConnection {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    provider: row.provider as StorageKind,
    config: readConnectionConfig(row.config),
    isDefault: row.isDefault,
    isFallback: row.isFallback,
    status: row.status,
    lastErrorCode: row.lastErrorCode,
    lastCheckedAt: row.lastCheckedAt?.toISOString() ?? null,
  };
}

function isMissingStorageTable(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021";
}

function schemaNotMigrated(): AppError {
  return new AppError(
    ERROR_CODES.INTERNAL,
    "Storage settings are not migrated yet. Apply apps/web/prisma/sql/003-storage-connections.sql.",
    { status: 503 },
  );
}

export async function listStorageConnections(workspaceId: string): Promise<StorageConnection[]> {
  try {
    const rows = await db.storageConnection.findMany({
      where: { workspaceId },
      orderBy: [{ isDefault: "desc" }, { isFallback: "desc" }, { createdAt: "asc" }],
    });
    return rows.map(toConnection);
  } catch (error) {
    if (isMissingStorageTable(error)) {
      throw schemaNotMigrated();
    }
    throw error;
  }
}

export async function getStorageConnection(
  workspaceId: string,
  id: string,
): Promise<StorageConnection | null> {
  try {
    const row = await db.storageConnection.findFirst({ where: { workspaceId, id } });
    return row ? toConnection(row) : null;
  } catch (error) {
    if (isMissingStorageTable(error)) {
      throw schemaNotMigrated();
    }
    throw error;
  }
}

export async function upsertStorageConnection(input: {
  workspaceId: string;
  actorId: string;
  value: StorageConnectionInput;
}): Promise<StorageConnection> {
  const config = normalizeConfig(input.value.provider, input.value.config);
  const configJson = config as unknown as Prisma.InputJsonValue;
  const key = { workspaceId: input.workspaceId, provider: input.value.provider };

  try {
    const [existing, total] = await Promise.all([
      db.storageConnection.findUnique({ where: { workspaceId_provider: key } }),
      db.storageConnection.count({ where: { workspaceId: input.workspaceId } }),
    ]);

    const explicitDefault = input.value.isDefault;
    const explicitFallback = input.value.isFallback;
    if (explicitDefault && explicitFallback) {
      throw new AppError(
        ERROR_CODES.BAD_REQUEST,
        "A connection cannot be both the primary and the fallback.",
      );
    }

    const isDefault =
      explicitDefault ?? existing?.isDefault ?? (total === 0 && explicitFallback !== true);
    const isFallback =
      explicitDefault === true ? false : (explicitFallback ?? existing?.isFallback ?? false);

    const saved = await db.$transaction(async (tx) => {
      if (isDefault) {
        await tx.storageConnection.updateMany({
          where: {
            workspaceId: input.workspaceId,
            isDefault: true,
            NOT: { provider: key.provider },
          },
          data: { isDefault: false },
        });
      }
      if (isFallback) {
        await tx.storageConnection.updateMany({
          where: {
            workspaceId: input.workspaceId,
            isFallback: true,
            NOT: { provider: key.provider },
          },
          data: { isFallback: false },
        });
      }

      const row = await tx.storageConnection.upsert({
        where: { workspaceId_provider: key },
        create: {
          workspaceId: input.workspaceId,
          provider: key.provider,
          config: configJson,
          isDefault,
          isFallback,
          createdById: input.actorId,
        },
        update: {
          config: configJson,
          isDefault,
          isFallback,
          status: "UNVERIFIED",
          lastErrorCode: null,
        },
      });

      await recordAudit(
        {
          workspaceId: input.workspaceId,
          actorId: input.actorId,
          action: "storage.connection.update",
          entity: "StorageConnection",
          entityId: row.id,
          metadata: { provider: key.provider, isDefault, isFallback },
        },
        tx,
      );
      return row;
    });

    return toConnection(saved);
  } catch (error) {
    if (isMissingStorageTable(error)) {
      throw schemaNotMigrated();
    }
    throw error;
  }
}

export async function deleteStorageConnection(input: {
  workspaceId: string;
  actorId: string;
  id: string;
}): Promise<void> {
  const existing = await getStorageConnection(input.workspaceId, input.id);
  if (!existing) {
    throw new AppError(ERROR_CODES.NOT_FOUND, "That storage connection does not exist.");
  }

  await db.$transaction(async (tx) => {
    await tx.storageConnection.delete({ where: { id: existing.id } });
    if (existing.isDefault) {
      const next = await tx.storageConnection.findFirst({
        where: { workspaceId: input.workspaceId },
        orderBy: { createdAt: "asc" },
      });
      if (next) {
        await tx.storageConnection.update({ where: { id: next.id }, data: { isDefault: true } });
      }
    }
    await recordAudit(
      {
        workspaceId: input.workspaceId,
        actorId: input.actorId,
        action: "storage.connection.delete",
        entity: "StorageConnection",
        entityId: existing.id,
        metadata: { provider: existing.provider },
      },
      tx,
    );
  });
}

/** Runs a real provider probe and records the honest result on the row. */
export async function testStorageConnection(input: {
  workspaceId: string;
  actorId: string;
  id: string;
}): Promise<{ ok: boolean; code?: string }> {
  const connection = await getStorageConnection(input.workspaceId, input.id);
  if (!connection) {
    throw new AppError(ERROR_CODES.NOT_FOUND, "That storage connection does not exist.");
  }

  const result = await getStorageProvider(connection).healthCheck();
  const code = result.ok ? null : result.code;

  await db.storageConnection.update({
    where: { id: connection.id },
    data: {
      status: result.ok ? "CONNECTED" : "ERROR",
      lastErrorCode: code,
      lastCheckedAt: new Date(),
    },
  });
  await recordAudit({
    workspaceId: input.workspaceId,
    actorId: input.actorId,
    action: "storage.connection.test",
    entity: "StorageConnection",
    entityId: connection.id,
    metadata: { provider: connection.provider, ok: result.ok, code },
  });

  return result.ok ? { ok: true } : { ok: false, code: result.code };
}
