# Deployment — Supabase + Vercel

The judged demo runs from a Vercel URL against a Supabase Postgres database. A local Docker stack
remains the development and fallback path. Decision record: `docs/decisions/0002-supabase-vercel.md`.

```text
Browser ──HTTPS──▶ Vercel (Next.js, apps/web)
                      │
                      ├─ Prisma + pg adapter ──▶ Supabase pooler :6543 (DATABASE_URL)
                      │
                      └─ Vercel Cron ──▶ GET /api/cron/email ──▶ outbox drain ──▶ Resend
```

## Environments

| Environment | Purpose                        | Database                        | Secrets            |
| ----------- | ------------------------------ | ------------------------------- | ------------------ |
| Local       | Build, test, fallback recording | Docker Postgres `:5433`         | `apps/web/.env`    |
| Preview     | Branch / PR checks             | Supabase branch DB or same demo | Vercel preview env |
| Production  | Judged demo and submission     | Supabase project                | Vercel production  |

Never point local or preview at the production database.

## Supabase setup

1. Create a project (region closest to the judges; the demo uses `ap-south-1` style regions).
2. Open **Project Settings → Database → Connection string**:
   - **Transaction pooler** (`:6543`) → `DATABASE_URL`, append
     `?pgbouncer=true&connection_limit=1` if Prisma asks. This is the serverless runtime URL.
   - **Session pooler** (`:5432`) → `DIRECT_URL`. Used only by `prisma db push` / `migrate deploy` /
     seed scripts, which cannot run through transaction mode.
3. Both URLs must keep `sslmode=require`. SSL is mandatory on Supabase.
4. Push the schema and seed the demo workspace from the repo root with the Supabase URLs exported:

   ```bash
   DATABASE_URL="postgresql://...:6543/postgres?sslmode=require" \
   DIRECT_URL="postgresql://...:5432/postgres?sslmode=require" \
   npm run db:push
   ```

   Then seed:

   ```bash
   DATABASE_URL="postgresql://...:6543/postgres?sslmode=require" npm run db:seed
   ```

   `db:push` uses `DIRECT_URL` because `apps/web/prisma/schema.prisma` declares `directUrl`. If you
   add real migrations, use `npm run db:deploy` the same way.
5. Turn on **Point-in-time recovery / daily backups** if the plan allows it. The seed is idempotent,
   so reseeding is the recovery path for demo data.
6. Free-tier projects pause after inactivity. Warm the database (`/api/health` returns
   `database: "ok"`) before the pitch.

Supabase Auth, Row Level Security, and Storage are **not used**. Identity is the flag-gated demo
persona picker; authorization is enforced server-side by the app's RBAC layer. Postgres access is
owned by the Vercel deployment, not the browser.

## Vercel setup

1. **Add New Project → Import** the GitHub repository.
2. **Root Directory:** `apps/web`.
3. **Framework preset:** Next.js (auto-detected). Build command `npm run build`, output `.next`.
4. Enable **Include files outside the Root Directory in the Build Step** so `tsconfig.base.json`,
   the hoisted `node_modules`, and `outputFileTracingRoot` resolve.
5. Add the production environment variables (below) for **Production** and **Preview**.
6. Deploy. First deploy generates the Prisma client (`postinstall` + `build` script); it does not
   touch the database.
7. Add the domain, confirm HTTPS, and set `APP_URL` to that exact origin (no trailing slash).
8. Vercel Cron is declared in `apps/web/vercel.json`:
   - Hobby plan: daily run (`0 3 * * *`), which is the maximum for Hobby.
   - Pro plan: change the schedule to `*/10 * * * *` for a ten-minute drain.
   - Vercel sends `Authorization: Bearer $CRON_SECRET` automatically when `CRON_SECRET` exists in
     the project environment. The route also accepts `POST` from any external scheduler.
9. Confirm the deployment in **Deployments → Functions** shows `nodejs` runtime for
   `/api/health` and `/api/cron/email`.

### Required environment variables (Vercel)

```text
APP_URL=https://<project>.vercel.app          # set after the first deploy; exact origin
APP_VERSION=0.1.0-demo
NODE_ENV=production                            # Vercel sets this; do not override
LOG_LEVEL=info
DATABASE_URL=postgresql://...:6543/postgres?sslmode=require&pgbouncer=true&connection_limit=1
DIRECT_URL=postgresql://...:5432/postgres?sslmode=require
DATABASE_POOL_MAX=2                             # pg pool per serverless instance (default 10)
AUTH_SECRET=<openssl rand -base64 32>          # required in a production runtime
DEMO_MODE=true                                 # judged demo: persona sign-in, no real identities
EMAIL_PROVIDER=resend                          # or console for a no-email dry run
EMAIL_FROM="Hexa <no-reply@<verified-domain>>"
RESEND_API_KEY=re_...
CRON_SECRET=<openssl rand -hex 24>
```

Optional: `REDIS_URL`, `SENTRY_DSN`, `SMTP_URL` (only with `EMAIL_PROVIDER=smtp`).

`AUTH_SECRET` is enforced at production runtime, not at build time: builds run without secrets so CI
and local `npm run build` stay green. A missing `AUTH_SECRET` on the deployed runtime fails fast on
the first session read instead of minting forgeable cookies.

`DATABASE_POOL_MAX` caps each serverless instance's `pg` pool (default 10). On Vercel set it to 1–3 so
concurrent lambdas cannot exhaust the Supabase pooler. The `connection_limit` URL parameter belongs to
the Prisma engine and is ignored by the `pg` driver adapter, hence the explicit variable.

### Email on Vercel

Resend is the recommended provider on serverless. Verify the sending domain (SPF, DKIM, DMARC) in
Resend, then set `EMAIL_PROVIDER=resend`. The outbox pattern is unchanged: the request only writes a
`QUEUED` row; the cron drain marks `SENT`/`FAILED` and retries are idempotent
(`finding-task:<findingId>`). No recipient address or token is logged.

## Local development (unchanged)

```bash
npm run db:up      # Docker Postgres :5433, Redis, Mailpit
npm run setup      # copies .env.example, installs, generates
npm run db:push
npm run db:seed
npm run dev        # http://localhost:3000
```

To point local at Supabase instead of Docker, set `DATABASE_URL`/`DIRECT_URL` in
`apps/web/.env` and skip `npm run db:up`.

## Deploy pipeline (operator runbook)

```bash
# 1. Prove the frozen build
npm run check
npm run release:check          # add --skip-e2e only if the local DB is unavailable

# 2. Push schema to Supabase (session pooler)
DATABASE_URL="<6543 url>" DIRECT_URL="<5432 url>" npm run db:push
DATABASE_URL="<6543 url>" npm run db:seed

# 3. Deploy (Vercel Git integration or CLI)
npx vercel --prod              # first run links the project; Root Directory must be apps/web
```

Do **not** run migrations in the Vercel build step. Supabase migrations are an operator action so a
bad schema push cannot break the build of a working demo. Do not run destructive database commands
against the shared Supabase project.

## Post-deploy smoke

```bash
curl -i https://<project>.vercel.app/
curl -i https://<project>.vercel.app/api/health
curl -i -H "Authorization: Bearer $CRON_SECRET" https://<project>.vercel.app/api/cron/email
```

Then in a browser at 390px and 1440px:

- [ ] Home loads over HTTPS; security headers present (`Strict-Transport-Security`, CSP, nosniff).
- [ ] `/api/health` returns `200`, `database: "ok"`, a request id, and a latency under ~1s warm.
- [ ] Persona sign-in works (`DEMO_MODE=true`) and the cookie is `Secure`.
- [ ] Golden path: open findings → open circular → approve draft → decision on record → audit entry.
- [ ] Viewer persona gets the read-only state; `/api/findings/<id>/review` returns 403.
- [ ] Empty workspace (Northwind) shows its empty states.
- [ ] Cron endpoint returns `200` with the drain summary; it returns `401` without the bearer token.
- [ ] One outbox row reaches `SENT` (Resend dashboard or Mailpit locally).
- [ ] A second approval attempt returns 409 (idempotency guard).
- [ ] No secret appears in page source, network payloads, or logs.

Record the URL, smoke timestamp, and results in `docs/discovery/09-release-report.md` and
`docs/WEBSITE-DELIVERY-STATUS.md`.

## Rollback

- Vercel keeps every deployment; **Instant Rollback** to the last known-good build first, diagnose
  second.
- The seed is idempotent: reseed the demo workspace rather than restoring the whole project.
- Never attempt a destructive down-migration under pitch pressure; restore from Supabase backup.
- Supabase free tier has no PITR: keep a `pg_dump` of the seeded demo before the event.

## Runbook

| Symptom                     | First action                                                      |
| --------------------------- | ----------------------------------------------------------------- |
| 502 / 503 from Vercel       | Deployment logs → function logs → `/api/health`                   |
| Health says `degraded`      | Check `DATABASE_URL`, Supabase project status, pooler port        |
| `too many connections`      | Use the `:6543` pooler URL; add `connection_limit=1`              |
| `prepared statement` errors | Runtime must use the transaction pooler; migrations the session pooler |
| Prisma client missing       | Redeploy; confirm `postinstall` and build logs show generate      |
| Auth loop / cookie rejected | `AUTH_SECRET` differs between deployments; `APP_URL` is the exact origin |
| Cron returns 401            | `CRON_SECRET` set in Vercel; header is `Authorization: Bearer ...` |
| Cron returns 503            | `CRON_SECRET` missing at runtime; set it and redeploy             |
| Demo data missing           | Rerun the seed against Supabase                                   |
| Emails not delivered        | Resend domain verification, `EMAIL_FROM`, outbox status           |
| Supabase paused             | Restore the project, warm `/api/health`, reseed if needed         |

## Submission URLs

Record in `docs/discovery/10-demo-script.md`:

- Deployed URL (Vercel)
- Supabase project ref (not the database password)
- Demo-mode sign-in instructions
- Fallback recording path
- Health endpoint
- Repository URL
