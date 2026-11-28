# Incident Response Runbook

Aligned with `infra/observability/prometheus-alerts.yaml` and `infra/observability/slo-policy.yaml`.

## Severity matrix

| Severity | Definition | Response target | Examples |
| --- | --- | --- | --- |
| **Sev1 (Critical)** | Production outage or cross-tenant data/security issue | Immediate (< 15 min) | `/api/health` returning `503`, DB unreachable, suspected auth/tenant bypass |
| **Sev2 (High)** | Degraded core workflow or > 1% 5xx rate | < 30 min | Elevated 5xx errors, ingestion pipeline failing across sources |
| **Sev3 (Warning)** | Non-blocking degradation or backlog | Next business window | Read p95 > 300 ms, email outbox age > 15 min, single source fetch error |

## Triage procedures

### Sev1: Health check failing (`/api/health` returns `503`)

1. Inspect response JSON (`status`, `database`, `latencyMs`, `requestId`).
2. Check database connectivity and active connections (`pg_stat_activity`) against `DATABASE_POOL_MAX`.
3. Verify secret store / `DATABASE_URL` (`sslmode=require`) and private network / security group rules.
4. If caused by a recent release, execute the **Rollback procedure** below immediately.

### Sev2: Elevated 5xx rate (`> 1%`)

1. Filter structured Pino logs by `status >= 500` and trace by `requestId`.
2. Check if upstream dependencies (Gemini API, Microsoft Graph, Supabase) are timing out.
3. Confirm deterministic compliance fallback is serving reads without crashing routes.

### Sev3: Latency degradation (`p95 > 300 ms`)

1. Inspect slow-query logs and verify composite indexes starting with `workspaceId`.
2. Check Redis reachability (`REDIS_URL`). Remember PolicyPulse fails open to in-process rate limits when Redis is unreachable; warn logs indicate Redis degradation.
3. Scale web replicas horizontally if CPU/concurrency is saturated.

### Sev3: Email outbox backlog (`oldest_queued > 900s`)

1. Manually probe the worker endpoint with `CRON_SECRET`:
   `curl -i -H "Authorization: Bearer $CRON_SECRET" https://<app-host>/api/cron/email`
2. Verify scheduler status (Vercel Cron, Azure Container Apps Job, GCP Cloud Scheduler, or K8s CronJob).
3. Inspect `EmailMessage` rows in `FAILED` state for safe provider error codes (never log recipient addresses).

## Rollback procedure

1. **Application rollback:** Re-point traffic to the previous immutable container digest (`imageTag`) or previous Vercel deployment.
2. **Database safety:** Schema migrations are additive (`expand-and-contract`). Never run destructive `DROP` statements during an incident; verify backward compatibility with the prior app revision before rolling back.
3. **Post-incident:** Record timeline, root cause, affected `requestId`s, and preventive action items in a post-mortem within 48 hours.
