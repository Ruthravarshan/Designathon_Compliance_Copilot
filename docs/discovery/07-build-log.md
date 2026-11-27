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

## 2026-11-27 — PolicyPulse v2 plan and handoffs (no v2 product code)

- Captured the tightened v2 scope in [00 revision 2](00-problem-statement.md#revision-2--policypulse-2026-11-27),
  [05](05-solution-design.md), and [06](06-visual-direction.md); added
  [ADRs 0003–0006](../decisions/) for identity, LLM, storage, and the worker.
- Created [handoffs](../handoffs/README.md): one frozen-contract README plus Qoder (backend),
  Antigravity (UI), and OpenCode (ingestion) lane files with file ownership and merge order.
- Actual public source URLs enter only through `INGESTION_SOURCE_URLS`; a bootstrap upserts
  `IngestionSource` rows disabled until owner review. No URL, circular, or document is invented, and
  the v1 excerpt corpus is not presented as v2 fetched evidence.
- v2 schema, UI, ingestion, LLM, and worker code are **not written yet**; the v1 app remains the
  runnable state. No commit or push requested.

## Next command

```bash
# v1 local gate was green; after deployment:
curl -i https://<project>.vercel.app/api/health

# v2: operator supplies credentials + INGESTION_SOURCE_URLS, then Qoder lands contracts/v2.
```

## Top three risks

1. Supabase free-tier projects pause when idle; warm `/api/health` before the pitch and reseed if the
   workspace looks empty.
2. Vercel Hobby cron runs daily only; the demo must drain the outbox manually or use Pro.
3. Demo auth is persona-based and must never be presented as production authentication.

Next: `08-hardening-report.md`

## 2026-11-27 — Gmail OAuth sender (Qoder lane)

- Added `GmailAccount` (workspace-unique) with encrypted access/refresh tokens, status, scope,
  expiry, last error, and connector; idempotent SQL in `prisma/sql/002-gmail-account.sql` and
  `init.sql`.
- Google OAuth 2.0 web flow: `GET /api/integrations/gmail/connect` (owner-only, HMAC state cookie,
  offline + consent), `GET .../callback` (state + session re-check, code exchange, verified email),
  `GET .../status` (optional live check), `POST .../disconnect` (revoke + delete), `POST .../test`.
- Gmail sender is the `gmail` outbox provider: RFC 2822 multipart, `gmail.send` scope, AES-256-GCM
  token encryption, 60s pre-expiry refresh, one retry on 401, `invalid_grant` marks the connection
  `REVOKED`.
- Settings → Email page: connect/reconnect, test send, disconnect with complete states; owner-only
  mutations, admin test; audit rows for connect, disconnect, and test.
- Evidence: `npm run check` green (format, lint, typecheck, 254 unit tests, production build with the
  five Gmail routes and `/app/settings/email`); local route smoke — owner status
  `{configured:false, connected:false}`, analyst status 403, admin disconnect 403, test without
  config 503; `GmailAccount` applied to local Postgres (16 tables).
- Not yet evidenced: real Google consent and a real Gmail delivery. They require the operator's
  OAuth client ID/secret and a connected mailbox; steps are in [GMAIL-OAUTH.md](../GMAIL-OAUTH.md).

## 2026-11-28 — Regulatory watch, manual policy check, posture/export/digest

- Scheduled + manual regulatory watch: `RegulatorySource`, `WatchRun`, `RegulatoryRevision` tables;
  SSRf-guarded fetch (DNS/IP guard, allowlist, redirect cap, size/timeout caps), HTML text and PDF
  extraction (`unpdf`), clause segmentation, `REG-<slug>-<hash>` references, checksum-based revision
  detection. Manual run `POST /api/watch/run`, direct URL/PDF ingest `POST /api/watch/ingest`,
  source toggles `PATCH /api/watch`, owner-only; `/app/watch` shows posture, overdue banner, sources,
  and run history.
- Weekly schedule is a secret-protected `GET|POST /api/cron/watch` (timing-safe bearer, 401/503)
  called by Vercel Cron Monday 04:00; due-gating per source (daily/weekly/monthly), in-progress guard,
  `WATCH_MAX_DOCS_PER_RUN` cap, and idempotent skip when checksums or references already exist.
- Manual compliance check for any policy (owner and HR reviewer): `POST /api/policies/:id/check`
  (`policy:check`), records `PolicyCheck` with result/score/counts, audits, and queues
  `policy.check.alert` email to the policy owner + workspace owner only when gaps exist.
- Added the HR persona (`Ananya Rao`, MEMBER, POL-HR-01 owner) and a sixth policy; the DPDP grievance
  obligation maps to POL-HR-01 and is satisfied, so the check reports
  "The 1 mapped obligation is met; no open gaps." (summary fixed from the misleading
  "no obligations mapped" wording; `check.test.ts` covers zero-finding and satisfied cases).
- Also: workspace posture score + overdue alerts on `/app`, weekly owner digest email
  (`watch.digest`), revision-diff history on circular detail, and audit evidence CSV export
  (`GET /api/export/findings`, formula-injection guarded).
- Evidence: `typecheck` and `lint` clean; 420/420 unit tests; production build green with
  `/app/watch` and `/app/policies[/policyId]`. Live smoke on a clean dev server: owner sign-in and
  pages 200; manual watch run `SUCCEEDED` (2 sources, 81 links discovered, 5 known docs skipped,
  7.7s); cron with bearer `SKIPPED (none due)` and 401 without; POL-HR-01 check as owner and as the
  HR persona → COMPLIANT, "1 mapped obligation … met"; POL-SEC-02 check → GAPS, 2 alert emails
  queued and sent through Mailpit (`policy.check.alert`); HR persona `POST /api/watch/run` → 403;
  CSV export 200 (4.4 kB, 13 findings); revision history renders on CERT-IN/2022/01.
- Not yet evidenced: a live revision being detected on the second weekly run (requires the regulator
  page to change), and direct URL ingest against a new regulator document.
- Merge of `origin/main` (`dd9e129`) resolved with the local watch/policy pages as canonical
  (`layout.tsx`, `/app/watch`, `/app/policies`, policy check button, audit export) and the remote
  shell adopted for its icon registry; remote's duplicate `policies/[id]` route and `watch-console`
  were dropped in favour of the verified `policies/[policyId]` and `watch-controls`. Remote's
  non-conflicting additions were kept: Architecture page/nav, circular detail view with PDF/diff/
  rejection panels, and the refreshed badges/settings. Local revision-history panel stays wired into
  circular detail. Post-merge `typecheck`, `lint`, and 420/420 tests are green; merge left staged for
  the operator to commit.

## 2026-11-28 — Storage: SharePoint primary, Drive/Supabase fallback, owner+admin control

- `StorageConnection` gains `isFallback`, `status`, `lastErrorCode`, `lastCheckedAt`; partial unique
  indexes keep one primary and one fallback per workspace (`prisma/sql/003-storage-connections.sql`,
  applied by `npm run db:init` alongside `init.sql`).
- Graph adapter resolves the pasted OneDrive folder link via `/shares/{id}/driveItem`, with
  `driveOwner` (UPN), `driveId`, and `siteId` alternatives; folder path is prefixed to object paths.
- Google Drive adapter is real (service-account JWT, multipart <5 MB, resumable >=5 MB, ranged read);
  it fails closed with `INTEGRATION_NOT_CONFIGURED` when the key or folder is missing.
- Ingestion uses the fallback connection only on `INTEGRATION_NOT_CONFIGURED` / `STORAGE_UNAVAILABLE`;
  duplicates and validation errors never fall back, and the document records the serving connection.
- `/app/settings/storage` + `/api/integrations/storage[/test]` let owners/admins pick roles, save
  non-secret settings, run a live provider probe, and remove a connection; every change is audited.
- Fixed a personal Gmail hard-coded as the redline fallback assignee (now
  `compliance@hexa.example`, matching the test).
- Evidence: `typecheck` clean, `lint` clean, 436/436 unit tests. Live probe against a real provider
  not yet evidenced — owner must supply Graph consent and the Drive key first.

## 2026-11-28 — Assistant: grounded generation with verified citations

- Retrieval is hybrid and deterministic (`src/lib/compliance/qa.ts`): BM25 (k1 1.2, b 0.75) over
  synonym-collapsed, stemmed tokens, label boost, kind prior, bigram phrase bonus, minimum-score
  gate, 1–6 passages. Off-topic questions escalate instead of matching noise.
- Grounded path (`src/server/llm/qa.ts`) sends the question and escaped `<passage>` blocks to Gemini
  with `responseSchema`, temperature 0.2, 1,024 output tokens, 12s timeout, one retry on 429/5xx,
  and a system instruction that treats the question and passages as untrusted data. Answers are
  Zod-validated, then `verifyGroundedAnswer` drops any citation that is not a verbatim substring of
  its passage; zero surviving citations is a refusal, not an ungrounded answer.
- Provider findings (measured with curl against the live key): Gemini 3.8-flash ignores the 12s
  budget on a real 6-passage payload (22s once, >40s twice); 3.5-flash answered in 2.4–3.9s and
  flash-lite in 1.5–1.9s. Default is now `gemini-3.5-flash` (`ASSISTANT_MODEL` can override, still
  allowlisted). Gemini 3 thinking is pinned to `thinkingLevel: "low"`; 2.x models do not get that
  field.
- `additionalProperties` is rejected by the provider inside `responseSchema` (HTTP 400). Removed
  from both `GROUNDED_ANSWER_SCHEMA` and `GEMINI_RESPONSE_SCHEMA`; Zod `.strict()` still rejects
  unknown fields after generation.
- Live smoke (owner session, seeded corpus): 4/4 questions grounded in 1.7–4.6s with verified
  citations; one burst-window call hit a provider quota error and served the deterministic
  retrieval answer instead (733ms), which is the designed fallback.
- New `e2e/assistant.spec.ts` drives the real UI in Chromium: grounded answer with citation badges
  and footer, plus the refusal path. 2/2 passing.
- Merge hygiene: a parallel session committed unresolved markers into `assistant-panel.tsx`.
  Resolved by keeping the multi-turn thread model and integrating the other side's copy button,
  Ctrl+Enter submit, shimmer skeleton, and trash-clear control.
- Concurrent dev servers on this checkout kept corrupting the shared `.next` cache. `next.config.ts`
  now honors `NEXT_DIST_DIR` so each server gets its own dist dir; ESLint ignores `.next*/`.
- Evidence: `typecheck` clean, `lint` clean, 54 unit files green at 99.88% statements, production
  build green (`/app/assistant` 8.87 kB), assistant e2e 2/2, live grounded smoke above.

## 2026-11-28 — Audit of incoming commits

- Found unresolved merge conflict markers in `src/components/assistant-panel.tsx`: format, lint, and
  typecheck all failed at parse time. Merged both sides: grounded turn-based Q&A (the page passes
  `grounded`/`model`), abortable requests, thread clearing, Ctrl/Meta+Enter submit, pending states,
  and the verified-generation safety copy. No `any`, ignored errors, or dead controls added.
- Normalised Prettier drift in 11 files changed by the incoming commits.
- Evidence after fixes: `npm run check` green (format, lint, typecheck, 465/465 unit tests,
  production build); `npm run test:coverage` green (99.88% statements, 98.07% branches, 100%
  functions, 99.88% lines); `npm run verify` 5 passed / 3 environment warnings; browser smoke
  6/6 passed on Chromium and Pixel 7 emulation (`E2E_SKIP_SEED=1`, no DB needed).
- Full release gate remains BLOCKED in this environment only: `npm run db:seed` needs Postgres and
  `apps/web/.env`, and neither Docker nor a local Postgres is installed. `npx playwright install
  chromium` was run and browsers are now available.

## 2026-11-28 — Real corpus, hybrid retrieval, storage sync, email

- Deleted the hand-written circular corpus (`DEMO_DOCUMENTS` and five fabricated clause sets).
  `REAL_DOCUMENTS` now points at two checked-in regulator PDFs in `apps/web/prisma/fixtures/`:
  IRDAI Information and Cyber Security Guidelines 2023 (`IRDAI/GA&HR/GDL/MISC/88/04/2023`) and SEBI
  CSCRF (`SEBI/HO/ITD-1/ITD_CSC_EXT/P/CIR/2024/113`). The seed parses them with the same extractor as
  live ingestion, keeps the English clauses of the bilingual SEBI PDF, archives the bytes for the
  authorized PDF route, and embeds through Gemini (`gemini-embedding-001`, 768 dims) in paced
  batches; throttling retries with 5/15/45s backoff. Result: 1,039 clauses and 672 findings across
  287+205 pages.
- Extraction cap raised from 40 clauses to 600 per PDF (`MAX_PDF_CLAUSES`): 40 clauses previously
  stopped at the cover pages of any long regulator circular and made retrieval answer from titles.
  Extraction helpers moved to `src/lib/watch/extract.ts`; embeddings and the vector literal moved to
  `src/lib/llm` / `src/lib/search` so the seed and the app share one implementation (server modules
  re-export, `server-only` stays on request paths).
- Email: `/api/integrations/gmail/test` is provider-aware (SMTP/Resend/Gmail) and `enqueueEmail`
  drains the outbox asynchronously for non-console providers. `/app/settings/email` shows the active
  provider and Mailpit inbox instead of demanding Gmail OAuth locally. SMTP leg verified: Mailpit
  received `SMTP check | smtp-check@hexa.local`.
- Storage: browse/import routes, the 30-minute `syncAllWorkspaceStorage()` cron, and the docs in
  `docs/STORAGE-SETUP.md` cover change detection (stat → read → text checksum → re-index) and the
  credentials each provider needs.
- Local reset: `public` schema dropped and rebuilt from `prisma/sql` (Prisma engines are stubbed on
  this corporate network), then reseeded.
