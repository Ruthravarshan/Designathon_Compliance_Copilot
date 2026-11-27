# Enterprise Multi-Cloud Infrastructure Architecture

> **Deployment status:** The templates under `infra/` are **reference-only blueprints** kept in the
> repository to document enterprise portability across **Microsoft Azure**, **AWS**, **GCP**, and
> **Kubernetes**. They have **not** been applied to live cloud accounts. For the active judged demo
> deployment (Vercel + Supabase) and local Docker stack, see [DEPLOYMENT.md](DEPLOYMENT.md).

## 1. Cross-cloud service mapping

PolicyPulse (`@hexa/web`) is a stateless Next.js 15 App Router container (`Dockerfile`, port `3000`,
liveness/readiness probe at `GET /api/health`) backed by PostgreSQL 16, Redis 7 (optional distributed
rate limits/caching), encrypted object storage for regulatory PDFs, a secret store, and scheduled
triggers for `/api/cron/email` and `/api/cron/watch`.

| Capability | Local (`docker-compose.yml`) | Judged Demo (`docs/DEPLOYMENT.md`) | Azure (`infra/bicep/` & `infra/terraform/azure/`) | AWS (`infra/terraform/aws/`) | GCP (`infra/terraform/gcp/`) | Kubernetes (`infra/k8s/`) |
| --- | --- | --- | --- | --- | --- | --- |
| **Compute** | Node / `Dockerfile` | Vercel Functions | Azure Container Apps (`2–10` replicas) | ECS Fargate behind HTTPS ALB | Cloud Run v2 (`1–10` instances) | Deployment + HPA + PDB |
| **Database** | Postgres 16 container (`:5433`) | Supabase Postgres (`:6543` / `:5432`) | Azure DB for PostgreSQL 16 Flexible Server (Zone-Redundant HA) | Amazon RDS PostgreSQL 16 (Multi-AZ, KMS encrypted) | Cloud SQL PostgreSQL 16 (Regional HA, Private IP) | Managed External / Operator Postgres |
| **Cache / Rate Limit** | Redis 7 container | In-memory fallback / Upstash | Azure Cache for Redis (TLS 1.2, private endpoint) | ElastiCache Redis 7 (in-transit & at-rest KMS) | Memorystore Redis 7 (AUTH + TLS) | Managed Redis |
| **Document Storage** | Local / SharePoint | SharePoint Graph + Supabase Storage | SharePoint + Azure Blob Storage (`ZRS`, private, versioned) | SharePoint + Amazon S3 (SSE-KMS, public access blocked) | SharePoint + Cloud Storage (uniform access, versioned) | Provider adapter |
| **Secrets** | `apps/web/.env` (gitignored) | Vercel Env Secrets | Azure Key Vault (RBAC, purge protection, Managed Identity) | AWS Secrets Manager (KMS CMK) | GCP Secret Manager (IAM least privilege) | External Secrets / K8s Secret |
| **Registry** | Local build | Vercel build | Azure Container Registry (Managed Identity `AcrPull`) | Amazon ECR (immutable tags, scan on push) | Artifact Registry (Docker) | OCI Registry |
| **Scheduled Cron** | `npm run email:process` | Vercel Cron / `pg_cron` | Container Apps Jobs (`*/5 * * * *`, `0 4 * * 1`) | EventBridge Scheduler → HTTPS/ECS | Cloud Scheduler (`*/5 * * * *`, `0 4 * * 1`) | Kubernetes `CronJob` |
| **Observability** | Pino JSON stdout | Vercel Logs + `/api/health` | Log Analytics + Application Insights | CloudWatch Logs + 5xx Alarms | Cloud Logging + Monitoring | Prometheus alerts + SLOs |

## 2. Security & network posture across all templates

1. **Private data tier:** PostgreSQL and Redis sit in private subnets/VPCs with no public IP in production blueprints; TLS (`sslmode=require` / `rediss://`) is mandatory.
2. **Non-root, immutable runtime:** `Dockerfile` runs as UID `1001` (`nextjs`) with a built-in Node `HEALTHCHECK` against `/api/health`. Kubernetes manifests enforce `pod-security.kubernetes.io/enforce: restricted`, `readOnlyRootFilesystem: true`, `allowPrivilegeEscalation: false`, and `capabilities.drop: ["ALL"]`.
3. **Least-privilege identity:** Azure uses User-Assigned Managed Identity for Key Vault (`Key Vault Secrets User`), ACR (`AcrPull`), and Blob Storage (`Storage Blob Data Contributor`). AWS uses separate ECS Execution vs Task IAM roles. GCP uses a dedicated Cloud Run runtime service account.
4. **Encryption & key management:** Customer-managed keys (AWS KMS) or platform-managed encryption with 90-day soft-delete / purge protection (Azure Key Vault) and automatic versioning on evidence buckets.
5. **CI/CD & supply chain controls:**
   - `.github/workflows/ci.yml`: Prettier format check, ESLint, strict TypeScript, Vitest >= 95% coverage gate, production Next.js build, and Docker image build check.
   - `.github/workflows/security.yml`: `npm audit --omit=dev --audit-level=high`, CodeQL SAST, and Trivy filesystem/IaC/secret scanning.
   - `.github/workflows/infra-validate.yml`: Automated Bicep build, `terraform fmt` / `validate` across all 3 clouds, and `kubeconform` validation.
   - `.github/dependabot.yml`: Weekly automated security updates across npm, GitHub Actions, Docker, and all three Terraform stacks.

## 3. Secret inventory & rotation policy

| Secret | Used by | Rotation cadence | Storage |
| --- | --- | --- | --- |
| `DATABASE_URL` / `DIRECT_URL` | Prisma + `pg` pool | 90 days (managed DB rotation) | Cloud Secret Store |
| `REDIS_URL` | Shared rate limits | 90 days | Cloud Secret Store |
| `AUTH_SECRET` | Demo HMAC session signing | 90 days (or disable demo in prod) | Cloud Secret Store |
| `CRON_SECRET` | `/api/cron/email`, `/api/cron/watch` | 90 days | Cloud Secret Store |
| `TOKEN_ENCRYPTION_KEY` | AES-256-GCM OAuth token encryption | 180 days (with re-encryption window) | Cloud Secret Store |
| `GEMINI_API_KEY` | Grounded assistant & extraction | 90 days | Cloud Secret Store |
| `MSFT_GRAPH_CLIENT_SECRET` | SharePoint Graph storage | Before app secret expiry (<= 180 days) | Cloud Secret Store |

## 4. Enterprise compliance alignment

| Control Domain | Implementation in PolicyPulse |
| --- | --- |
| **Access Control & RBAC** | Server-side `assertCan` / `requireMembership`, last-owner protection, role escalation guards (`docs/SECURITY.md`) |
| **Tenant Isolation** | Mandatory `workspaceId` filtering on every tenant table; cross-tenant probes return `404` |
| **Auditability** | Immutable `AuditLog` and `ReviewEvent` records with `requestId` on access, status, and ownership changes |
| **Data Protection (DPDP / RBI)** | AES-256-GCM token encryption, TLS 1.2/1.3 in transit, KMS/encrypted storage at rest, Pino log PII redaction |
| **Availability & Resilience** | Stateless containers, `/api/health` readiness/liveness probes, PDB (`minAvailable: 1`), HPA, Multi-AZ DB & PITR |
