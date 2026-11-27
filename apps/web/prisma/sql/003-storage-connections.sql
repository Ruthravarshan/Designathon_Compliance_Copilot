-- Owner/admin-managed storage connections (SharePoint primary, Google Drive fallback).
-- Idempotent: safe to apply against an existing database.
-- Mirrors the StorageConnection model in apps/web/prisma/schema.prisma.

DO $$ BEGIN CREATE TYPE "StorageProviderKind" AS ENUM ('SHAREPOINT', 'SUPABASE_STORAGE', 'GOOGLE_DRIVE'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "StorageConnectionStatus" AS ENUM ('UNVERIFIED', 'CONNECTED', 'ERROR'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "StorageConnection" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "provider" "StorageProviderKind" NOT NULL,
  "config" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "isFallback" BOOLEAN NOT NULL DEFAULT false,
  "status" "StorageConnectionStatus" NOT NULL DEFAULT 'UNVERIFIED',
  "lastErrorCode" TEXT,
  "lastCheckedAt" TIMESTAMP(3),
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StorageConnection_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StorageConnection_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "StorageConnection_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "StorageConnection_workspaceId_provider_key" ON "StorageConnection"("workspaceId", "provider");
CREATE INDEX IF NOT EXISTS "StorageConnection_workspaceId_isDefault_idx" ON "StorageConnection"("workspaceId", "isDefault");
CREATE INDEX IF NOT EXISTS "StorageConnection_workspaceId_isFallback_idx" ON "StorageConnection"("workspaceId", "isFallback");

-- At most one primary and one standby per workspace.
CREATE UNIQUE INDEX IF NOT EXISTS "StorageConnection_one_default_per_workspace" ON "StorageConnection"("workspaceId") WHERE "isDefault";
CREATE UNIQUE INDEX IF NOT EXISTS "StorageConnection_one_fallback_per_workspace" ON "StorageConnection"("workspaceId") WHERE "isFallback";