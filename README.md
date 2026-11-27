# PolicyPulse

Regulatory change, reviewed and on record. PolicyPulse is a role-scoped compliance workspace built on
the Hexaware brand system: a public circular or uploaded PDF becomes a stored, cited policy change
that the right people see, acknowledge, or reject with a mandatory note — and every decision is
audited.

> **Build status (2026-11-27):** the v2 product is fully specified and handed off in
> [docs/handoffs/](docs/handoffs/), but it is **not implemented or deployed yet**. This checkout still
> runs the v1 deterministic workbench while the three lanes build. Claims below marked “v2” are the
> target; evidence will live in [07-build-log.md](docs/discovery/07-build-log.md) and
> [09-release-report.md](docs/discovery/09-release-report.md). No mock or unobserved result is claimed.

## What PolicyPulse will do

- **Ingest actual public sources:** the owner supplies real listing/direct-PDF URLs through
  `INGESTION_SOURCE_URLS` (env; never hardcoded or invented). A one-time seed imports them into the
  DB-backed source registry. Paste a link or upload a PDF; the worker fetches with SSRF and allowlist
  guards, stores the original in SharePoint (primary) or Supabase Storage (fallback), and keeps the
  real source URL.
- **Extract with proof:** Gemini proposes structured facts; every quote must be an exact substring of
  the cited PDF page. Unverified output is flagged for review, never published; the deterministic
  engine remains the verifier and fallback.
- **Cite two ways:** every item shows **View PDF** (authorized proxy of the stored file) and **View
  source** (the original website); the reader chooses. A missing link is disabled with a reason.
- **Control access:** owner-defined role matrix, per-person grant/deny overrides, department scope, and
  gated guests. Defaults: owner all; admin all operational; compliance manager all compliance; manager
  team; **employee no compliance**; auditor read-only; guest sample only. Owner can change visibility
  for a role or one person from the DB-backed admin UI.
- **Assign and acknowledge:** assignments with due dates, acknowledgements, rejections that require a
  note, and email at every handoff through the outbox.
- **Owner-configurable:** branding, SSO providers, demo/guest access, SharePoint/Supabase/Drive
  connection, sources, model, schedules, and email from the database — no hardcoded product values.
- **Fast, clean, dark:** long work is queued; server-first UI; light and dark themes; 320–1440px;
  real loading/empty/error/unauthorized states; no proof page and no fake screenshots.

## Current state vs v2

| Area | Today (v1) | v2 target |
| --- | --- | --- |
| Identity | HMAC demo personas | Supabase Auth (Google/Microsoft), gated demo, gated guests |
| Ingest | paste-only text path | URL/listing fetch or PDF upload, stored file + source |
| Extraction | deterministic only | Gemini structured extraction, verified quotes, deterministic fallback |
| Permissions | static role matrix | DB role matrix + per-person overrides + department scope |
| Storage | none | SharePoint Graph primary, Supabase Storage fallback |
| Email | review/remediation events | every step: circular, assignment, ack, reject, overdue, policy change, member/guest |
| UI | workbench light | all real pages, clean login, admin, dark, responsive |
| Deploy | local Docker | Supabase Postgres/Auth + Vercel + worker cron |

The v1 workbench (circulars, findings, review, audit, outbox, deterministic engine) is the base and
remains test-covered. Its seeded corpus is representative demo material and is **not** presented as
v2 fetched evidence; v2 documents come from actual owner-supplied sources or uploads. Test fixtures
never appear in the demo workspace. The v2 design is in
[05-solution-design.md](docs/discovery/05-solution-design.md) and
[06-visual-direction.md](docs/discovery/06-visual-direction.md).

## Parallel build — start here

| Lane | Owner | Handoff | Scope |
| --- | --- | --- | --- |
| Contracts, auth, RBAC, APIs, worker, deploy | Qoder | [QODER-BACKEND.md](docs/handoffs/QODER-BACKEND.md) | schema, server, API, integration |
| All UI, login, admin, dark, responsive | Antigravity | [ANTIGRAVITY-UI.md](docs/handoffs/ANTIGRAVITY-UI.md) | routes, components, styles, UI e2e |
| Ingestion, storage, Gemini, queue jobs | OpenCode | [OPENCODE-INGESTION.md](docs/handoffs/OPENCODE-INGESTION.md) | fetch, PDF, Graph/Supabase, verification |

Read [docs/handoffs/README.md](docs/handoffs/README.md) first for frozen contracts, file ownership,
branches, secrets, the no-mock rule, and the merge protocol. Qoder is the integration owner. No lane
pushes; `main` stays frozen until the operator asks for a merge.

## Quickstart (v1 app in this checkout)

Requirements: Node 22.12+, npm 10+, Docker Desktop.

```bash
npm install
npm run db:up          # Postgres :5433, Redis, Mailpit :8025
npm run db:push        # current v1 schema
npm run db:seed        # seeded demo corpus and personas
npm run dev            # http://localhost:3000
```

Open `/signin` and choose a seeded persona. Drain the outbox with `npm run email:process` and inspect
Mailpit at `http://localhost:8025`. Copy `.env.example` to `apps/web/.env` first; never commit it.

## Hosted target — Supabase + Vercel

- **Database:** Supabase Postgres via Prisma. `DATABASE_URL` uses the transaction pooler (`:6543`);
  `DIRECT_URL` uses the session/direct connection (`:5432`) for migrations and seed.
- **Identity:** Supabase Auth for Google/Microsoft and anonymous guest sessions; the demo HMAC session
  is a flag-gated fallback only.
- **Storage:** SharePoint via Microsoft Graph is primary; Supabase Storage is the real fallback.
  Secrets are env-only; site/drive/folder/bucket is a DB `StorageConnection`.
- **Worker:** Postgres job/outbox tables, secret `GET/POST /api/cron/worker`, `after()` nudge, and
  Supabase `pg_cron`/`pg_net` (or Vercel Pro) for schedule. Vercel Hobby’s daily cron is not enough for
  a live demo; the manual drain is documented.
- **AI:** Gemini key is server-only (dev in gitignored `apps/web/.env`, prod as a Vercel secret). Model
  and enablement are DB settings. No prompt or document text is logged.
- **Deployment:** Vercel root `apps/web`; see [DEPLOYMENT.md](docs/DEPLOYMENT.md) and ADRs
  [0002](docs/decisions/0002-supabase-vercel.md), [0003](docs/decisions/0003-supabase-auth-sso.md),
  [0004](docs/decisions/0004-gemini-verified-extraction.md),
  [0005](docs/decisions/0005-sharepoint-storage.md),
  [0006](docs/decisions/0006-worker-and-schedule.md).

Pending owner inputs: Supabase URL/keys, Google/Microsoft OAuth apps, Microsoft Graph app + site/drive,
Resend/verified sender, official Hexaware logo, guest policy, and the **actual source URLs** supplied
only through `INGESTION_SOURCE_URLS`. No regulator URL or selector is hardcoded. Missing inputs show
an honest “Not configured” state; they are never mocked.

## Architecture (target)

```text
Browser
  / (session router) → /signin (SSO + demo + guest) → /app (server components + client islands)
    → /api/v1/* (same-origin, Zod, requirePermission, scope) → Prisma → Supabase Postgres
    → /api/v1/files/:id → storage adapter (Graph primary | Supabase Storage fallback) → PDF stream

Ingest
  URL/listing or PDF upload → 202 + IngestionJob
    → safe fetch (allowlist, SSRF, robots, size/timeout) → checksum/dedupe
    → storage upload → per-page text → Gemini structured JSON → exact-quote verification
    → deterministic mapping/gap/redline → persist + audit + outbox email + notification
    → /api/cron/worker drains ingestion, email, reminders
```

The v1 deterministic engine stays as the citation verifier and fallback; it is never presented as a
live model. Every citation shown to a user exists in the stored PDF.

## Access defaults (owner-editable in DB)

| Role | Compliance visibility | Circular/policy read | Ingest/review | Audit | Admin |
| --- | --- | --- | --- | --- | --- |
| OWNER | All | All | Yes | All | All |
| ADMIN | All | All | Yes | All | Members, departments, guest revoke |
| COMPLIANCE_MANAGER | All | All | Yes | All | — |
| MANAGER | Team | Team/own | Recommend only | Team | — |
| EMPLOYEE | **None by default** | Assigned | — | — | — |
| AUDITOR | All read-only | All | — | All | — |
| GUEST | None | Sample only | — | — | — |

Per-person overrides can grant or deny capabilities; user deny wins; owner-only capabilities cannot be
granted to a non-owner. Every change is audited.

## Engineering guarantees

- TypeScript strict; Zod at every boundary; server-side authorization and `workspaceId` scoping on
  every tenant read/write; cross-tenant probes return 404.
- `AppError` + `fail(error, requestId)`; no stack, SQL, provider body, or secret leaves the server.
- Rejection requires a note (assignment, finding, or policy change); the note is stored, audited, and
  emailed.
- Outbox-only email: escaped variables, CRLF-stripped subjects, http(s)-only links, preferences and
  suppression, idempotency; no recipient addresses in logs.
- Ingestion is SSRF-guarded, allowlist-bound, size/timeout bounded, checksum-deduped; storage failure
  fails the job rather than faking success; unverified quotes never publish.
- File proxy is authorized, range-capable, `no-store`; storage credentials never reach the browser.
- Security headers, rate limits on auth/upload/write, structured redacted logs, audit on access/money/
  status/ownership changes.
- Every data view has loading, empty, error, and unauthorized states; severity never relies on color;
  keyboard, focus, contrast, 200% zoom, reduced motion, dark mode, and 320px are checks.
- Tests: unit for domain, RBAC, email, rate limits, verification, SSRF; e2e golden path, rejection
  guard, tenant isolation, mobile. `npm run test:coverage` enforces ≥95% per file; no waiver.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the app at `http://localhost:3000` |
| `npm run db:up` / `db:down` | Start / stop Postgres, Redis, Mailpit |
| `npm run db:push` | Current schema sync (hackathon path) |
| `npm run db:migrate` | Create a real migration before schema changes |
| `npm run db:deploy` | Apply migrations (Supabase/Vercel) |
| `npm run db:seed` | Idempotent demo workspace + roles + settings |
| `npm run email:process` | Drain the outbox into Mailpit |
| `npm run lint` / `typecheck` | ESLint / TypeScript |
| `npm run test` / `test:coverage` | Vitest / enforced thresholds |
| `npm run test:e2e` | Playwright (real local DB) |
| `npm run check` | Format + lint + types + unit + build |
| `npm run release:check` | Full release gate with a timed report |
| `npm run security:audit` | Production dependency audit (high) |

## Scope

**In (v2):** real URL/PDF ingestion, SharePoint/Supabase storage, verified Gemini extraction,
deterministic fallback, role+person+department permissions, owner admin, SSO/demo/guests, policy
changes, assignments + mandatory rejection notes, email at each step, PDF + source citations, dark/
responsive UI, worker, deployment.

**Out:** OCR of scanned PDFs (unsupported pages go to review), autonomous policy publishing, legal
advice, payments, file formats other than PDF, a second always-on job service, and any fabricated
integration or demo data outside the labelled demo workspace.

## Documentation

- Build plan: [docs/handoffs/](docs/handoffs/) · design
  [05](docs/discovery/05-solution-design.md) · visual direction
  [06](docs/discovery/06-visual-direction.md).
- Brand/visual: [BRAND.md](docs/BRAND.md), [DESIGN-SYSTEM.md](docs/DESIGN-SYSTEM.md).
- Security/scalability/quality: [SECURITY.md](docs/SECURITY.md),
  [SCALABILITY.md](docs/SCALABILITY.md), [QUALITY-BAR.md](docs/QUALITY-BAR.md).
- Enterprise infrastructure & SRE (reference IaC for Azure Bicep, Terraform Azure/AWS/GCP, K8s):
  [INFRASTRUCTURE.md](docs/INFRASTRUCTURE.md), [infra/](infra/README.md),
  [RUNBOOK-INCIDENT.md](docs/RUNBOOK-INCIDENT.md), [DISASTER-RECOVERY.md](docs/DISASTER-RECOVERY.md).
- Delivery evidence: [WEBSITE-DELIVERY-STATUS.md](docs/WEBSITE-DELIVERY-STATUS.md),
  [09-release-report.md](docs/discovery/09-release-report.md).
- Demo runbook: [10-demo-script.md](docs/discovery/10-demo-script.md).

## License

MIT. Third-party licenses: [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md) and [`licenses/`](licenses).