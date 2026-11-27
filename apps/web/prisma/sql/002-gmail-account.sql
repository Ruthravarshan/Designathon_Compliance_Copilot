-- Gmail OAuth sender connection (one per workspace).
-- Idempotent: safe to apply against an existing database.
-- Mirrors the GmailAccount model in apps/web/prisma/schema.prisma.

DO $$ BEGIN CREATE TYPE "GmailStatus" AS ENUM ('CONNECTED', 'REVOKED', 'ERROR'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "GmailAccount" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "accessTokenEnc" TEXT NOT NULL,
  "refreshTokenEnc" TEXT NOT NULL,
  "tokenType" TEXT NOT NULL DEFAULT 'Bearer',
  "scope" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "status" "GmailStatus" NOT NULL DEFAULT 'CONNECTED',
  "lastErrorCode" TEXT,
  "connectedById" TEXT,
  "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastRefreshedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GmailAccount_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GmailAccount_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "GmailAccount_connectedById_fkey" FOREIGN KEY ("connectedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "GmailAccount_workspaceId_key" ON "GmailAccount"("workspaceId");
CREATE INDEX IF NOT EXISTS "GmailAccount_status_idx" ON "GmailAccount"("status");
CREATE INDEX IF NOT EXISTS "GmailAccount_email_idx" ON "GmailAccount"("email");
