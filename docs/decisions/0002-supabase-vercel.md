# ADR 0002: Supabase Postgres and Vercel for the hosted demo

- Status: Accepted
- Date: 2026-11-27
- Deciders: Operator, engineering lead

## Context

The application runs locally against Docker Postgres. It must now be hosted: Supabase provides the
managed Postgres backend and Vercel hosts the Next.js app. Both are free-tier friendly and are the
platforms the operator will use for the judged demo.

The data model is relational and already written against PostgreSQL with Prisma, including
idempotent seed data and a demo workspace. There is no file-upload path, so Supabase Storage is not
needed. Identity in the demo is a flag-gated persona picker with an HMAC session cookie; Supabase Auth
would add a second identity system the demo does not exercise.

## Decision

1. **Database: Supabase Postgres, unchanged schema.** Prisma keeps `provider = "postgresql"`. The
   runtime connects through the Supavisor transaction pooler (`:6543`) using `DATABASE_URL`; schema
   pushes and migrations use the session/direct connection via `DIRECT_URL`.
2. **No Supabase SDK.** The app talks to Postgres through Prisma and the `pg` driver adapter only.
   Supabase-specific client libraries are not shipped, so the database remains portable.
3. **Hosting: Vercel, Root Directory `apps/web`,** with the monorepo install handled by Vercel's npm
   workspace detection and "include files outside Root Directory" enabled for `tsconfig.base.json`
   and `outputFileTracingRoot`.
4. **Email drain: Vercel Cron calls `GET /api/cron/email`** with `Authorization: Bearer
   $CRON_SECRET`. Vercel sends that header automatically when `CRON_SECRET` is set. The route keeps
   its `POST` handler for external schedulers.
5. **Identity stays demo-cookie auth.** Supabase Auth is an explicit non-goal for this brief; the
   RBAC and tenant isolation are enforced server-side regardless of identity provider.
6. **Production session safety stays fail-fast.** `session.ts` throws unless `AUTH_SECRET` is set
   when `NODE_ENV=production`; the local demo fallback secret is non-production only. Builds do not
   require secrets, so CI stays green.

## Consequences

Positive:

- Zero code change in domain, RBAC, or compliance logic; only connection and deployment config.
- Pooled connections suit Vercel's serverless concurrency; direct connections suit migrations.
- Cron retries are safe because the outbox claim is idempotent (`finding-task:<findingId>`).
- The same build runs locally, on Vercel, and in Docker.

Negative:

- Two connection strings must be configured and kept in sync.
- Supabase free-tier projects pause after inactivity, so the demo database must be warmed before the
  pitch.
- Vercel Hobby cron runs at most once per day; the judged demo drains the outbox manually or relies
  on the manual `email:process` command. Pro unlocks minute-level schedules.
- Supabase Auth, Row Level Security, and Storage are not exercised; if the product moves beyond the
  demo, those become a separate ADR.
