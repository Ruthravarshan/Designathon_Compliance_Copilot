# 07 — Build log

> Phase 07. Chronological log of the actual build session (2026-11-27). Times are omitted rather than
> invented; order is real.

## Slice 1 — Corpus and deterministic engine

- Extended the Prisma schema: `RegulatoryDocument`, `DocumentClause`, `InternalPolicy`,
  `InternalControl`, `Obligation`, `Finding`, `ReviewEvent`, `DataFieldScan`; all tenant-owned tables
  carry `workspaceId` with unique `(workspaceId, reference/code)` keys and review/date indexes.
- Seeded 5 circulars, 4 policies, 4 controls, 13 findings, 12 data fields, two workspaces
  (`hexa-demo`, `northwind-assurance`), and a pre-reviewed LOGGING finding.
- Built the engine in `src/lib/compliance`: parse → extract → verify → map → gap → redline → Q&A →
  data scan → confidence. Unit-tested each module (223 tests).
- Fixed strict-TS regex group typing after `noUncheckedIndexedAccess` flagged optional groups.

## Slice 2 — Auth, RBAC, tenancy

- HMAC-signed session cookie (8h, httpOnly, SameSite=Lax), `getActor` from `react.cache`, membership
  resolved per request.
- Demo persona sign-in gated by `DEMO_MODE_ENABLED`; audit row on sign-in/sign-out.
- RBAC policy with four roles and server-side `assertCan`; no client-supplied role or workspace id.

## Slice 3 — Read surfaces

- Landing product page ("Regulatory change, with receipts.") with a labelled illustrative seeded
  finding render; `/platform` keeps the 10-hour Build OS.
- Workbench: overview, circulars list/detail, findings list with review/severity filters and cursor
  "Next page", finding detail with clause, mapping, diff, confidence breakdown, task, history.
- Policy Q&A, data discovery, audit trail, sign-in persona picker.

## Slice 4 — Write path

- `POST /api/documents`: Zod body, same-origin, RBAC, ingest rate limit, duplicate reference 409,
  single transaction for document, clauses, obligations, findings, and audit.
- Review: approve / approve-with-edits / reject, transactional status update + review event + audit
  row, 409 on re-review, rejection reason minimum, outbox email with idempotency key.
- Data scan and assistant endpoints with limits and grounded answers.

## Slice 5 — UI states and brand

- Added loading, error, not-found, and unauthorized states for the app and marketing surfaces.
- Applied tokens only; replaced stray `bg-brand/8` and `accent-[var(--color-brand)]` with valid
  utilities.

## Slice 6 — Verification

- `npm run db:seed` green against local Postgres.
- Playwright browsers installed; e2e suite written. Fixes during the run:
  - Sign-in assertions timed out during Next dev first-compile → raised `timeout` (120s), `expect`
    (20s), navigation/action timeouts, and limited workers to 2.
  - Finding row regex targeted clause text instead of plain-language heading → targeted
    "servers located within India".
  - "Citation verified" matched two nodes → `.first()`.
  - Mobile project re-ran the stateful approval and raced the desktop project → moved it to
    `e2e/owner-review.spec.ts` and ignored that file in the mobile project.
- Added `e2e/global-setup.ts` to reseed before each suite so review states are deterministic.
- Coverage: extract branch coverage was 94.31% due to unreachable `?? ""` branches; replaced them
  with documented regex-group casts and a testable first-sentence scan → 98.75% branches.

## Current state

- Unit: 223 passed, coverage 99.86% statements / 98.19% branches.
- E2E: 13 passed across chromium + mobile-chrome; the stateful approval runs once on desktop.
- Release gate: **READY** — 8/8 checks passed in 215.8s (`artifacts/release-report.md`).
- Typecheck and lint: clean.

## 2026-11-27 — Hosted deployment target: Supabase + Vercel

- Chose Supabase Postgres for the hosted demo and Vercel for the app
  ([ADR 0002](../decisions/0002-supabase-vercel.md)); docker stays the local/fallback path.
- Prisma `directUrl = env("DIRECT_URL")`: runtime uses the `:6543` transaction pooler, schema
  commands use the `:5432` session pooler. Verified `prisma generate` still works without
  `DIRECT_URL` so CI and local builds stay green.
- Cron route now serves `GET` (Vercel Cron) and `POST` (external schedulers); `apps/web/vercel.json`
  declares the daily Hobby schedule.
- `APP_URL` derives from `VERCEL_PROJECT_PRODUCTION_URL`/`VERCEL_URL` when unset; production session
  behavior is unchanged (no `AUTH_SECRET` → no minting, no demo fallback in production).
- Rewrote `docs/DEPLOYMENT.md` with Supabase pooler details, env matrix, cron, smoke, and rollback.
- Re-ran the release gate after these config-only changes.

## Next command

```bash
# local gate already green; after deployment:
curl -i https://<project>.vercel.app/api/health
```

## Top three risks

1. Supabase free-tier projects pause when idle; warm `/api/health` before the pitch and reseed if the
   workspace looks empty.
2. Vercel Hobby cron runs daily only; the demo must drain the outbox manually or use Pro.
3. Demo auth is persona-based and must never be presented as production authentication.

Next: `08-hardening-report.md`
