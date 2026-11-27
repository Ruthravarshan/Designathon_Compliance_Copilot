# Disaster Recovery & Business Continuity Plan

## Recovery objectives (target enterprise tiers)

| Tier | RPO (Max Data Loss) | RTO (Max Recovery Time) | Primary mechanism |
| --- | --- | --- | --- |
| **PostgreSQL Database** | <= 5 minutes | <= 30 minutes | Automated daily snapshots + Point-in-Time Recovery (PITR, 35-day retention in prod blueprints) |
| **Circular Evidence Storage** | 0 (Versioned) | <= 15 minutes | Blob/S3/GCS object versioning + zone/geo redundancy + SharePoint primary copy |
| **Application Compute** | 0 (Stateless) | <= 10 minutes | Immutable container images in ACR/ECR/Artifact Registry; redeploy via IaC or Kustomize |
| **Secrets & Configuration** | 0 | <= 15 minutes | Soft-deleted/purge-protected Key Vault or KMS-backed Secret Manager + `WorkspaceSettings` DB table |

## Database backup & restore drill

1. **Pre-migration safety:** Always run `npm run db:deploy` (`prisma migrate deploy`) from an operator/CI step against `DIRECT_URL`, never inside container startup or web build steps.
2. **PITR restore:** Restore PostgreSQL to a new instance/timestamp from the managed provider snapshot, verify row counts for `Workspace`, `RegulatoryDocument`, `Finding`, `PolicyVersion`, and `AuditLog`, then swap `DATABASE_URL` / `DIRECT_URL` in the secret store and restart replicas.
3. **Evidence reconciliation:** `DocumentFile.checksum` (SHA-256) guarantees deduplication and integrity verification between PostgreSQL metadata and stored PDF objects across SharePoint, Azure Blob, S3, or GCS.

## Multi-cloud failover strategy

Because `@hexa/web` is packaged as a standard OCI container (`Dockerfile`) and Prisma targets standard PostgreSQL 16 (`pg` driver) with pluggable storage (`StorageProviderKind`) and email adapters:

- **Primary -> Secondary cloud:** Rebuild or mirror the OCI image, provision the target cloud's Terraform stack (`infra/terraform/{azure,aws,gcp}`), restore the latest `pg_dump` / logical snapshot into the target PostgreSQL 16 instance, populate secrets, and update DNS/TLS.
- **Verification after recovery:** Confirm `GET /api/health` returns `200` (`database: "ok"`), run an authenticated smoke check on `/app`, and verify `GET /api/cron/email` drains queued notifications cleanly.
