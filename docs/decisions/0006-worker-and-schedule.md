# ADR 0006: Postgres jobs + secret worker for ingestion and email

- Status: Accepted
- Date: 2026-11-27
- Deciders: Owner, backend lane, ingestion lane

## Context

V2 adds PDF ingestion, Gemini extraction, storage uploads, reminders, and emails at every step. These
cannot run inline in a page or mutation: the UI must stay fast, Vercel functions have time limits, and
the free Vercel Hobby cron runs at most daily. The demo needs acknowledgement and received emails to
move within minutes. The app already uses a transactional outbox for email.

## Decision

1. **Use Postgres as the queue.** Keep the email outbox; add `IngestionRun`/`IngestionJob` with
   `QUEUED/RUNNING/SUCCEEDED/FAILED/SKIPPED`, attempts, `lockedAt`, next-attempt, and safe error codes.
2. **One protected worker route** `GET|POST /api/cron/worker` requires `CRON_SECRET`, drains a bounded
   batch of email, ingestion jobs, and overdue reminders, and returns counts only (no PII). It is
   idempotent: claim rows with `updateMany`, recover stale locks, and never double-send or double-create.
3. **Trigger immediately, schedule as a safety net.** Enqueue then nudge the worker with Next.js
   `after()` (bounded) so the demo moves without waiting; schedule the worker every minute with
   Supabase `pg_cron` + `pg_net` (free tier) or Vercel Pro cron. Local development uses `npm run worker`
   and Mailpit.
4. **No LLM or storage call in a request path.** Ingestion/upload APIs validate and enqueue, return
   `202`, and the UI polls run status. This protects perceived performance and function limits.
5. **Bounded work:** cap documents per run, bytes per file, retries, and worker duration; chain the next
   job rather than running an unbounded batch. Re-running the same checksum is a duplicate, not a new
   job.
6. **Observability:** every run/job/email has status, attempts, timings, and a safe error code. Logs use
   request/run ids and redact recipients, URLs with secrets, tokens, and document contents.

## Consequences

Positive:

- Fast requests and a visible progress state; works on free-tier infrastructure.
- Durable retries and an audit trail for ingestion and email.
- No second always-on service required for the hackathon.

Negative:

- Postgres is doing queue work; claim queries and indexes must be correct.
- A one-minute schedule depends on Supabase pg_cron setup or a Vercel Pro plan.
- Long PDFs may need multiple worker invocations; the run must show partial progress.

Mitigations:

- Index `(status, nextAttemptAt)`, `(status, lockedAt)`, and `(runId, status)`; use short transactions.
- Add stale-lock recovery and a maximum attempt count.
- Verify the schedule with a real cron smoke test before the demo.
- Document the Vercel Hobby limitation and the Supabase pg_cron setup.

## Alternatives considered

- **Vercel cron only:** daily on Hobby; too slow for the demo.
- **Redis/BullMQ:** extra service and credentials; not needed at this scale.
- **Inline ingestion:** blocks requests and risks timeout; rejected.
- **Third-party queue (QStash):** viable, but adds a vendor; Postgres is already present.

## Follow-up

- Enable pg_cron/pg_net and store the cron secret in Supabase Vault; do not commit it.
- Measure worker p95 and backlog before the demo.
- Move to a managed queue if volume or concurrency grows.