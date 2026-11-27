-- Initial schema for the compliance copilot demo database.
-- Mirrors apps/web/prisma/schema.prisma. Prisma migrate cannot run where
-- binaries.prisma.sh is blocked, so this script is the deployable fallback.
-- Idempotent: safe to run repeatedly.

DO $$ BEGIN CREATE TYPE "Role" AS ENUM ('OWNER', 'ADMIN', 'MEMBER', 'VIEWER'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "EmailStatus" AS ENUM ('QUEUED', 'SENDING', 'SENT', 'FAILED', 'CANCELED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "Regulator" AS ENUM ('RBI', 'SEBI', 'IRDAI', 'MEITY'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "DocumentStatus" AS ENUM ('INGESTED', 'ANALYZED', 'ARCHIVED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "ObligationType" AS ENUM ('SECURITY_TESTING', 'INCIDENT_REPORTING', 'DATA_LOCALIZATION', 'CONSENT', 'DATA_RETENTION', 'THIRD_PARTY_AUDIT', 'CRYPTOGRAPHY', 'RESILIENCE', 'LOGGING', 'GOVERNANCE', 'GRIEVANCE', 'OTHER'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "GapStatus" AS ENUM ('COMPLIANT', 'PARTIAL_GAP', 'CRITICAL_GAP', 'MISSING_CONTROL'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "Severity" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "ReviewStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'APPROVED_WITH_EDITS', 'REJECTED', 'NOT_REQUIRED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "ReviewAction" AS ENUM ('APPROVED', 'APPROVED_WITH_EDITS', 'REJECTED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "User" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "name" TEXT,
  "imageUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");

CREATE TABLE IF NOT EXISTS "Workspace" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Workspace_slug_key" ON "Workspace"("slug");

CREATE TABLE IF NOT EXISTS "Membership" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "role" "Role" NOT NULL DEFAULT 'MEMBER',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Membership_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Membership_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "Membership_userId_workspaceId_key" ON "Membership"("userId", "workspaceId");
CREATE INDEX IF NOT EXISTS "Membership_workspaceId_role_idx" ON "Membership"("workspaceId", "role");

CREATE TABLE IF NOT EXISTS "AuditLog" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT,
  "actorId" TEXT,
  "action" TEXT NOT NULL,
  "entity" TEXT NOT NULL,
  "entityId" TEXT,
  "metadata" JSONB,
  "ip" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AuditLog_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "AuditLog_workspaceId_createdAt_idx" ON "AuditLog"("workspaceId", "createdAt");
CREATE INDEX IF NOT EXISTS "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");
CREATE INDEX IF NOT EXISTS "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

CREATE TABLE IF NOT EXISTS "EmailMessage" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT,
  "userId" TEXT,
  "toEmail" TEXT NOT NULL,
  "template" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "status" "EmailStatus" NOT NULL DEFAULT 'QUEUED',
  "idempotencyKey" TEXT NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "provider" TEXT,
  "providerMessageId" TEXT,
  "scheduledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmailMessage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EmailMessage_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "EmailMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "EmailMessage_idempotencyKey_key" ON "EmailMessage"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "EmailMessage_status_scheduledAt_idx" ON "EmailMessage"("status", "scheduledAt");
CREATE INDEX IF NOT EXISTS "EmailMessage_workspaceId_createdAt_idx" ON "EmailMessage"("workspaceId", "createdAt");
CREATE INDEX IF NOT EXISTS "EmailMessage_userId_createdAt_idx" ON "EmailMessage"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "EmailMessage_toEmail_createdAt_idx" ON "EmailMessage"("toEmail", "createdAt");

CREATE TABLE IF NOT EXISTS "EmailPreference" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "transactional" BOOLEAN NOT NULL DEFAULT true,
  "product" BOOLEAN NOT NULL DEFAULT true,
  "marketing" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmailPreference_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EmailPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "EmailPreference_userId_key" ON "EmailPreference"("userId");

CREATE TABLE IF NOT EXISTS "EmailSuppression" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmailSuppression_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "EmailSuppression_email_key" ON "EmailSuppression"("email");

CREATE TABLE IF NOT EXISTS "RegulatoryDocument" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "regulator" "Regulator" NOT NULL,
  "title" TEXT NOT NULL,
  "reference" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "sourceUrl" TEXT NOT NULL,
  "publishedAt" TIMESTAMP(3) NOT NULL,
  "effectiveAt" TIMESTAMP(3),
  "status" "DocumentStatus" NOT NULL DEFAULT 'INGESTED',
  "content" TEXT NOT NULL,
  "pageCount" INTEGER NOT NULL DEFAULT 1,
  "checksum" TEXT NOT NULL,
  "ingestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RegulatoryDocument_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RegulatoryDocument_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "RegulatoryDocument_workspaceId_reference_key" ON "RegulatoryDocument"("workspaceId", "reference");
CREATE INDEX IF NOT EXISTS "RegulatoryDocument_workspaceId_ingestedAt_idx" ON "RegulatoryDocument"("workspaceId", "ingestedAt");
CREATE INDEX IF NOT EXISTS "RegulatoryDocument_workspaceId_regulator_publishedAt_idx" ON "RegulatoryDocument"("workspaceId", "regulator", "publishedAt");

CREATE TABLE IF NOT EXISTS "DocumentClause" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "sectionLabel" TEXT NOT NULL,
  "heading" TEXT,
  "pageNumber" INTEGER NOT NULL,
  "orderIndex" INTEGER NOT NULL,
  "text" TEXT NOT NULL,
  CONSTRAINT "DocumentClause_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DocumentClause_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "RegulatoryDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "DocumentClause_workspaceId_documentId_orderIndex_key" ON "DocumentClause"("workspaceId", "documentId", "orderIndex");
CREATE INDEX IF NOT EXISTS "DocumentClause_workspaceId_documentId_idx" ON "DocumentClause"("workspaceId", "documentId");

CREATE TABLE IF NOT EXISTS "InternalPolicy" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "section" TEXT NOT NULL,
  "ownerName" TEXT NOT NULL,
  "ownerEmail" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "tags" TEXT[],
  "attributes" JSONB NOT NULL,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InternalPolicy_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "InternalPolicy_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "InternalPolicy_workspaceId_code_key" ON "InternalPolicy"("workspaceId", "code");
CREATE INDEX IF NOT EXISTS "InternalPolicy_workspaceId_idx" ON "InternalPolicy"("workspaceId");

CREATE TABLE IF NOT EXISTS "InternalControl" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "ownerName" TEXT NOT NULL,
  "ownerEmail" TEXT NOT NULL,
  "systemName" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "tags" TEXT[],
  "attributes" JSONB NOT NULL,
  "lastTestedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InternalControl_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "InternalControl_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "InternalControl_workspaceId_code_key" ON "InternalControl"("workspaceId", "code");
CREATE INDEX IF NOT EXISTS "InternalControl_workspaceId_status_idx" ON "InternalControl"("workspaceId", "status");

CREATE TABLE IF NOT EXISTS "Obligation" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "clauseId" TEXT NOT NULL,
  "reference" TEXT NOT NULL,
  "plainLanguage" TEXT NOT NULL,
  "actionRequired" TEXT NOT NULL,
  "applicableTo" TEXT NOT NULL,
  "obligationType" "ObligationType" NOT NULL,
  "requirement" JSONB NOT NULL,
  "sla" TEXT,
  "effectiveDeadline" TIMESTAMP(3),
  "extractionConfidence" DOUBLE PRECISION NOT NULL,
  "citationVerified" BOOLEAN NOT NULL DEFAULT false,
  "criticNotes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Obligation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Obligation_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Obligation_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "RegulatoryDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Obligation_clauseId_fkey" FOREIGN KEY ("clauseId") REFERENCES "DocumentClause"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "Obligation_workspaceId_reference_key" ON "Obligation"("workspaceId", "reference");
CREATE INDEX IF NOT EXISTS "Obligation_workspaceId_obligationType_idx" ON "Obligation"("workspaceId", "obligationType");
CREATE INDEX IF NOT EXISTS "Obligation_workspaceId_documentId_idx" ON "Obligation"("workspaceId", "documentId");

CREATE TABLE IF NOT EXISTS "Finding" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "obligationId" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "policyId" TEXT,
  "controlId" TEXT,
  "status" "GapStatus" NOT NULL,
  "severity" "Severity" NOT NULL,
  "gapDescription" TEXT NOT NULL,
  "severityRationale" TEXT,
  "citationVerified" BOOLEAN NOT NULL DEFAULT false,
  "extractionConfidence" DOUBLE PRECISION NOT NULL,
  "mappingConfidence" DOUBLE PRECISION NOT NULL,
  "confidence" DOUBLE PRECISION NOT NULL,
  "dueDate" TIMESTAMP(3) NOT NULL,
  "redlineBefore" TEXT NOT NULL,
  "redlineAfter" TEXT NOT NULL,
  "approvedWording" TEXT,
  "taskTitle" TEXT,
  "taskAssignee" TEXT,
  "taskAssigneeEmail" TEXT,
  "taskDueDate" TIMESTAMP(3),
  "reviewStatus" "ReviewStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
  "reviewerId" TEXT,
  "reviewerName" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "reviewComments" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Finding_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Finding_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Finding_obligationId_fkey" FOREIGN KEY ("obligationId") REFERENCES "Obligation"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Finding_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "RegulatoryDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Finding_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "InternalPolicy"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Finding_controlId_fkey" FOREIGN KEY ("controlId") REFERENCES "InternalControl"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Finding_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "Finding_obligationId_key" ON "Finding"("obligationId");
CREATE INDEX IF NOT EXISTS "Finding_workspaceId_reviewStatus_severity_idx" ON "Finding"("workspaceId", "reviewStatus", "severity");
CREATE INDEX IF NOT EXISTS "Finding_workspaceId_dueDate_idx" ON "Finding"("workspaceId", "dueDate");
CREATE INDEX IF NOT EXISTS "Finding_workspaceId_createdAt_idx" ON "Finding"("workspaceId", "createdAt");
CREATE INDEX IF NOT EXISTS "Finding_workspaceId_documentId_idx" ON "Finding"("workspaceId", "documentId");

CREATE TABLE IF NOT EXISTS "ReviewEvent" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "findingId" TEXT NOT NULL,
  "actorId" TEXT,
  "actorName" TEXT NOT NULL,
  "actorRole" "Role" NOT NULL,
  "action" "ReviewAction" NOT NULL,
  "previous" JSONB NOT NULL,
  "updated" JSONB NOT NULL,
  "comments" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReviewEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ReviewEvent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ReviewEvent_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "Finding"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ReviewEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "ReviewEvent_workspaceId_createdAt_idx" ON "ReviewEvent"("workspaceId", "createdAt");
CREATE INDEX IF NOT EXISTS "ReviewEvent_findingId_createdAt_idx" ON "ReviewEvent"("findingId", "createdAt");

CREATE TABLE IF NOT EXISTS "DataFieldScan" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "datasetName" TEXT NOT NULL,
  "fieldName" TEXT NOT NULL,
  "dataCategory" TEXT NOT NULL,
  "sensitiveType" TEXT,
  "sampleMasked" TEXT,
  "encrypted" BOOLEAN NOT NULL,
  "consented" BOOLEAN NOT NULL,
  "riskLevel" "Severity" NOT NULL,
  "finding" TEXT NOT NULL,
  "citation" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DataFieldScan_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DataFieldScan_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "DataFieldScan_workspaceId_datasetName_fieldName_key" ON "DataFieldScan"("workspaceId", "datasetName", "fieldName");
CREATE INDEX IF NOT EXISTS "DataFieldScan_workspaceId_riskLevel_idx" ON "DataFieldScan"("workspaceId", "riskLevel");
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

-- ---------------------------------------------------------------------------
-- Regulatory watch, policy checks, and revision tracking (v1.1)
-- ---------------------------------------------------------------------------

DO $$ BEGIN CREATE TYPE "WatchTrigger" AS ENUM ('MANUAL', 'SCHEDULED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "WatchRunStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'PARTIAL', 'FAILED', 'SKIPPED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "WatchSourceKind" AS ENUM ('LISTING', 'FEED', 'DIRECT'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "PolicyCheckResult" AS ENUM ('COMPLIANT', 'AT_RISK', 'GAPS'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "RegulatorySource" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "regulator" "Regulator" NOT NULL,
  "kind" "WatchSourceKind" NOT NULL DEFAULT 'LISTING',
  "listingUrl" TEXT NOT NULL,
  "allowedDomains" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "linkPattern" TEXT,
  "schedule" TEXT NOT NULL DEFAULT 'weekly',
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "lastCheckedAt" TIMESTAMP(3),
  "lastStatus" "WatchRunStatus",
  "lastItemCount" INTEGER NOT NULL DEFAULT 0,
  "lastErrorCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RegulatorySource_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RegulatorySource_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "RegulatorySource_workspaceId_listingUrl_key" ON "RegulatorySource"("workspaceId", "listingUrl");
CREATE INDEX IF NOT EXISTS "RegulatorySource_workspaceId_enabled_idx" ON "RegulatorySource"("workspaceId", "enabled");

ALTER TABLE "RegulatoryDocument" ADD COLUMN IF NOT EXISTS "sourceId" TEXT;
CREATE INDEX IF NOT EXISTS "RegulatoryDocument_workspaceId_sourceId_idx" ON "RegulatoryDocument"("workspaceId", "sourceId");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RegulatoryDocument_sourceId_fkey') THEN
    ALTER TABLE "RegulatoryDocument" ADD CONSTRAINT "RegulatoryDocument_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "RegulatorySource"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "WatchRun" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "sourceId" TEXT,
  "trigger" "WatchTrigger" NOT NULL,
  "status" "WatchRunStatus" NOT NULL DEFAULT 'RUNNING',
  "discovered" INTEGER NOT NULL DEFAULT 0,
  "ingested" INTEGER NOT NULL DEFAULT 0,
  "skipped" INTEGER NOT NULL DEFAULT 0,
  "failed" INTEGER NOT NULL DEFAULT 0,
  "revisions" INTEGER NOT NULL DEFAULT 0,
  "newFindings" INTEGER NOT NULL DEFAULT 0,
  "overdueCritical" INTEGER NOT NULL DEFAULT 0,
  "overdueHigh" INTEGER NOT NULL DEFAULT 0,
  "summary" JSONB,
  "errorCode" TEXT,
  "triggeredById" TEXT,
  "triggeredByName" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  CONSTRAINT "WatchRun_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WatchRun_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "WatchRun_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "RegulatorySource"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "WatchRun_workspaceId_startedAt_idx" ON "WatchRun"("workspaceId", "startedAt");
CREATE INDEX IF NOT EXISTS "WatchRun_sourceId_startedAt_idx" ON "WatchRun"("sourceId", "startedAt");

CREATE TABLE IF NOT EXISTS "PolicyCheck" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "policyId" TEXT NOT NULL,
  "result" "PolicyCheckResult" NOT NULL,
  "score" INTEGER NOT NULL,
  "openFindings" INTEGER NOT NULL DEFAULT 0,
  "critical" INTEGER NOT NULL DEFAULT 0,
  "high" INTEGER NOT NULL DEFAULT 0,
  "medium" INTEGER NOT NULL DEFAULT 0,
  "low" INTEGER NOT NULL DEFAULT 0,
  "overdue" INTEGER NOT NULL DEFAULT 0,
  "summary" TEXT NOT NULL,
  "details" JSONB,
  "actorId" TEXT,
  "actorName" TEXT,
  "trigger" "WatchTrigger" NOT NULL DEFAULT 'MANUAL',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PolicyCheck_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PolicyCheck_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PolicyCheck_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "InternalPolicy"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "PolicyCheck_workspaceId_createdAt_idx" ON "PolicyCheck"("workspaceId", "createdAt");
CREATE INDEX IF NOT EXISTS "PolicyCheck_policyId_createdAt_idx" ON "PolicyCheck"("policyId", "createdAt");

CREATE TABLE IF NOT EXISTS "RegulatoryRevision" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "previousChecksum" TEXT NOT NULL,
  "newChecksum" TEXT NOT NULL,
  "previousContent" TEXT NOT NULL,
  "newContent" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "diff" JSONB NOT NULL,
  "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RegulatoryRevision_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RegulatoryRevision_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "RegulatoryRevision_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "RegulatoryDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "RegulatoryRevision_workspaceId_detectedAt_idx" ON "RegulatoryRevision"("workspaceId", "detectedAt");
CREATE INDEX IF NOT EXISTS "RegulatoryRevision_documentId_detectedAt_idx" ON "RegulatoryRevision"("documentId", "detectedAt");

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
CREATE UNIQUE INDEX IF NOT EXISTS "StorageConnection_one_default_per_workspace" ON "StorageConnection"("workspaceId") WHERE "isDefault";
CREATE UNIQUE INDEX IF NOT EXISTS "StorageConnection_one_fallback_per_workspace" ON "StorageConnection"("workspaceId") WHERE "isFallback";
