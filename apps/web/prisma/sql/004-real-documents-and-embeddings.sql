-- Real PDF archive, storage pointers, and pgvector embeddings.
-- Idempotent: safe to apply after init.sql or against an already-pushed schema.

CREATE EXTENSION IF NOT EXISTS vector;

DO $$ BEGIN
  CREATE TYPE "EmbeddingStatus" AS ENUM ('PENDING', 'READY', 'FAILED', 'SKIPPED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "RegulatoryDocument" ADD COLUMN IF NOT EXISTS "filename" TEXT;
ALTER TABLE "RegulatoryDocument" ADD COLUMN IF NOT EXISTS "fileContentType" TEXT;
ALTER TABLE "RegulatoryDocument" ADD COLUMN IF NOT EXISTS "fileChecksum" TEXT;
ALTER TABLE "RegulatoryDocument" ADD COLUMN IF NOT EXISTS "fileBytes" BYTEA;
ALTER TABLE "RegulatoryDocument" ADD COLUMN IF NOT EXISTS "storageConnectionId" TEXT;
ALTER TABLE "RegulatoryDocument" ADD COLUMN IF NOT EXISTS "storageItemId" TEXT;
ALTER TABLE "RegulatoryDocument" ADD COLUMN IF NOT EXISTS "storageWebUrl" TEXT;
ALTER TABLE "RegulatoryDocument" ADD COLUMN IF NOT EXISTS "storagePath" TEXT;
ALTER TABLE "RegulatoryDocument" ADD COLUMN IF NOT EXISTS "storageModifiedAt" TIMESTAMP(3);
ALTER TABLE "RegulatoryDocument" ADD COLUMN IF NOT EXISTS "indexStatus" "EmbeddingStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "RegulatoryDocument" ADD COLUMN IF NOT EXISTS "indexedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "RegulatoryDocument_workspaceId_storageItemId_idx"
  ON "RegulatoryDocument"("workspaceId", "storageItemId");
CREATE INDEX IF NOT EXISTS "RegulatoryDocument_workspaceId_indexStatus_idx"
  ON "RegulatoryDocument"("workspaceId", "indexStatus");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RegulatoryDocument_storageConnectionId_fkey') THEN
    ALTER TABLE "RegulatoryDocument"
      ADD CONSTRAINT "RegulatoryDocument_storageConnectionId_fkey"
      FOREIGN KEY ("storageConnectionId") REFERENCES "StorageConnection"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "DocumentClause" ADD COLUMN IF NOT EXISTS "embedding" vector(768);
ALTER TABLE "DocumentClause" ADD COLUMN IF NOT EXISTS "embeddingModel" TEXT;
ALTER TABLE "DocumentClause" ADD COLUMN IF NOT EXISTS "embeddedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "DocumentClause_embedding_hnsw_idx"
  ON "DocumentClause" USING hnsw ("embedding" vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
