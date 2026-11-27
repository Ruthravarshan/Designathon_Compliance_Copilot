-- Idempotent indexes for the primary tenant list queries.
-- Apply to an existing database with:
--   psql "$DATABASE_URL" -f apps/web/prisma/sql/hardening-indexes.sql
-- Fresh databases also receive these through prisma/sql/init.sql.

CREATE INDEX IF NOT EXISTS "RegulatoryDocument_workspaceId_publishedAt_idx"
  ON "RegulatoryDocument"("workspaceId", "publishedAt");
CREATE INDEX IF NOT EXISTS "Finding_workspaceId_reviewStatus_severity_dueDate_idx"
  ON "Finding"("workspaceId", "reviewStatus", "severity", "dueDate");
CREATE INDEX IF NOT EXISTS "Finding_workspaceId_severity_dueDate_idx"
  ON "Finding"("workspaceId", "severity", "dueDate");
CREATE INDEX IF NOT EXISTS "InternalPolicy_workspaceId_section_code_idx"
  ON "InternalPolicy"("workspaceId", "section", "code");
CREATE INDEX IF NOT EXISTS "DataFieldScan_workspaceId_riskLevel_datasetName_fieldName_idx"
  ON "DataFieldScan"("workspaceId", "riskLevel", "datasetName", "fieldName");
CREATE INDEX IF NOT EXISTS "RegulatorySource_workspaceId_enabled_name_idx"
  ON "RegulatorySource"("workspaceId", "enabled", "name");
CREATE INDEX IF NOT EXISTS "WatchRun_workspaceId_status_startedAt_idx"
  ON "WatchRun"("workspaceId", "status", "startedAt");
