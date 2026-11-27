# PolicyPulse — parallel build master handoff

> Date: 2026-11-27 · Product: **PolicyPulse** · Base: `hexa-designathon` (Next.js 15, Prisma,
> Postgres). This file is the contract for three parallel lanes and the integration owner. Read it,
> then your lane file, then the linked sections — not the whole repo.

| Lane | Owner | Handoff | Exclusive scope |
| --- | --- | --- | --- |
| Contracts, auth, APIs, worker, deploy | Qoder | [QODER-BACKEND.md](QODER-BACKEND.md) | schema, server, API, integration |
| UI, login, shell, pages, dark, responsive | Antigravity | [ANTIGRAVITY-UI.md](ANTIGRAVITY-UI.md) | routes, components, styles, e2e UI |
| Ingestion, storage, Gemini, queue jobs | OpenCode | [OPENCODE-INGESTION.md](OPENCODE-INGESTION.md) | ingestion/storage/llm modules |

## Product outcome (do not re-scope)

PolicyPulse turns a public circular (URL or uploaded PDF) into a stored, cited policy change that the
right people can see, acknowledge, reject with a mandatory note, and audit. Owner controls identity,
roles, per-person overrides, departments, providers, and visibility from the database-backed admin
surface. Login offers SSO, a gated demo, and gated guests. Every screen is real: no proof page, no
invented data, no fake integration, no mock upload.

**Non-negotiables:** deploy-ready (Supabase + Vercel); DB-driven values (no hardcoded roles, options,
branding, sources, counts); PDF + source citation links; rejection note required; email at every
handoff; dark mode; fast (enqueue long work, server-first UI); official logo or recorded wordmark
fallback; tenant isolation and server-side authorization everywhere.

## Source of truth (read in this order)

1. [AGENTS.md](../../AGENTS.md) — engineering and brand contract, phase gate.
2. [05-solution-design.md](../discovery/05-solution-design.md) — architecture, schema, RBAC, pipeline,
   API, email, security, acceptance.
3. [06-visual-direction.md](../discovery/06-visual-direction.md) — login, shell, tokens, dark mode,
   states, responsive, motion.
4. ADRs [0003](../decisions/0003-supabase-auth-sso.md) ·
   [0004](../decisions/0004-gemini-verified-extraction.md) ·
   [0005](../decisions/0005-sharepoint-storage.md) ·
   [0006](../decisions/0006-worker-and-schedule.md).
5. Lane file. If two documents disagree, 05 wins on behavior, this file wins on ownership, BRAND.md
   wins on visual values.

## Frozen contracts (change only by Qoder, announced to all lanes)

### Roles, capabilities, scopes

Roles: `OWNER`, `ADMIN`, `COMPLIANCE_MANAGER`, `MANAGER`, `EMPLOYEE`, `AUDITOR`, `GUEST`.
Capabilities (exact strings): `circular:read`, `circular:ingest`, `policy:read`, `finding:read`,
`finding:review`, `compliance:view_all`, `compliance:view_team`, `compliance:view_own`,
`assignment:read`, `assignment:ack`, `assignment:manage`, `policy:publish`, `member:manage`,
`role:manage`, `settings:manage`, `storage:manage`, `source:manage`, `audit:read`, `guest:manage`.
Compliance scope: `all | team | own | none`. Resolution: owner all → user DENY → user GRANT → role row →
missing denies. Every API and page re-checks server-side.

### Shared TypeScript contracts

Qoder creates these first, in `apps/web/src/lib/contracts/` (no `server-only`, safe for client types):
`permissions.ts` (the strings above), `api.ts` (`ApiSuccess<T>`, `ApiError`, `ActorContext`,
`Page<T>`), `domain.ts` (enums and DTOs the UI renders). `GET /api/v1/me` returns
`{ actor, permissions, scope, workspace, settings, theme }`; `ActorContext` includes user id/name/
email (nullable for guests)/avatar/isDemo/isGuest, workspace id/name/slug/appName/logoUrl/isDemo,
membership role/department/status. `GET /api/public/branding` also returns enabled SSO providers,
demo personas (no emails) when enabled, and the guest gate.

### API surface

All under `/api/v1` except auth, cron, health. Envelope `{ data }` or
`{ error: { code, message, requestId, details? } }`. Mutations are same-origin, Zod-validated,
rate-limited, audited. Routes are listed in [05 §API](../discovery/05-solution-design.md#api-contract-v2-additions);
the UI may rely on: `/me` (+ `/me/preferences`), `/circulars`, `/circulars/:id`,
`/circulars/ingest|upload`, `/files/:fileId`, `/policies` (+ `/:id/publish`), `/compliance`
(+ `/:id/review`), `/assignments` (+ ack/reject/reassign), `/notifications`, `/audit`,
`/ingestion/sources|runs`, `/admin/settings|roles|members|departments|storage|ai|email`,
`/api/public/branding`, `/api/auth/*`. No lane adds a route without Qoder. Every rejection path —
assignment, finding review, policy change — requires a note (min 10, max 2000).

### Ingestion module boundary

Qoder owns the HTTP routes; OpenCode owns these server functions and their types (paths fixed in
[OPENCODE-INGESTION.md](OPENCODE-INGESTION.md)):

```ts
queueUrlIngest(input: { workspaceId; userId; url; mode: "url" | "listing"; sourceId? }): Promise<{ runId; jobId }>
queueUploadedPdf(input: { workspaceId; userId; bytes: Uint8Array; filename; sourceId? }):
  Promise<{ runId?; jobId?; documentId?; duplicate: boolean }>
runIngestionJobs(input: { limit: number; now?: Date }): Promise<{ processed; failed; skipped }>
```

Routes return `202` with `{ data: { runId } }`; the UI polls
`GET /api/v1/ingestion/runs/:id` (Qoder) for real steps. No Gemini/Graph call in a request path.
Uploads are stored before enqueue; a storage failure fails the request, never fakes success.

### Storage and LLM

`StorageProvider` (OpenCode, `server/storage`): `healthCheck()`, `upload({ workspaceId, path, bytes,
contentType, filename }) → { itemId, webUrl, path, checksum }`, `read({ itemId, range? }) → { body,
contentType, contentLength?, status, contentRange? }`. Primary SharePoint Graph (app-only), real
fallback Supabase Storage; Drive optional. No silent fallback. Secrets stay in env; non-secret config
in `StorageConnection`.

Gemini (OpenCode, `server/llm`): server-only REST adapter, versioned prompt, strict JSON, Zod,
exact-quote verification, deterministic fallback. Never called from a component or route directly.

### Email and worker

Events (DB-driven recipients, outbox only): `circular.received`, `ingestion.failed`,
`assignment.created|acknowledged|rejected|overdue`, `policy.change_published`,
`member.role_changed|removed`, `guest.access_revoked`, `welcome`, `workspace.invitation`,
`email.test`. Qoder owns templates/renderer/outbox. `/api/cron/worker` accepts `GET` and `POST` with
`Authorization: Bearer $CRON_SECRET` (constant-time), composes `runIngestionJobs` + email drain +
overdue reminders, and is nudged by `after()` after enqueue. Vercel Hobby cron is daily; Supabase
pg_cron calls the same route for minute-level in the demo.

## File ownership (exclusive; do not cross)

| Path | Owner |
| --- | --- |
| `apps/web/prisma/**`, `apps/web/scripts/**` | Qoder |
| `apps/web/src/lib/contracts/**`, `src/lib/env.ts`, `src/lib/**` shared utils | Qoder |
| `apps/web/src/server/**` except `ingestion/**`, `storage/**`, `llm/**` | Qoder |
| `apps/web/src/server/{ingestion,storage,llm}/**` | OpenCode |
| `apps/web/src/app/api/**`, `src/app/auth/**`, `src/middleware.ts` | Qoder |
| `apps/web/src/server/email/**` (service + templates) | Qoder |
| `apps/web/src/app/**` except `api/**`, `auth/**` (pages, layouts, loading/error, globals.css) | Antigravity |
| `apps/web/src/components/**`, `apps/web/public/**` | Antigravity |
| `playwright.config.ts`, `e2e/global-setup.ts`, auth/storage fixtures | Qoder |
| `e2e/*.spec.ts` (UI), component tests | Antigravity |
| `*.test.ts` under `server/ingestion|storage|llm` | OpenCode |
| `package.json`, `package-lock.json`, `.env.example`, `vercel.json`, root config | Qoder |
| `docs/**` | Qoder (lanes report changes, do not edit) |

Cross-cutting a file needs the owner's agreement in writing (channel/PR comment) before editing.
Never edit someone else's file to "make it compile"; report the missing contract.

## Dependencies

Only Qoder edits package files and the lockfile. At kickoff Qoder installs the agreed set:
`@supabase/ssr`, `@supabase/supabase-js`, `unpdf` (server PDF text), `node-html-parser` (bounded
listing anchors), and existing deps. Graph and Gemini use `fetch`; no SDK. Any further need goes to Qoder as package + version + why; Qoder installs,
runs `npm run check`, and announces. Do not add a package for a one-line utility.

## Branches, commits, and merge

- `main` stays frozen. Qoder first lands `contracts/v2` (schema, contracts, env placeholders, schema
  migration, generated client) so all lanes compile against one shape.
- From that commit: `lane/qoder`, `lane/antigravity`, `lane/opencode` (separate worktrees).
- One lane = one branch. Small commits with a lane prefix. **No push.** No force-push. No rebase of
  someone else's branch. No commits to `main`; integration owner merges only when the operator asks.
- Merge order: `contracts/v2` → `lane/qoder` → `lane/opencode` → `lane/antigravity` → integration
  fixes. Resolve conflicts in favor of the frozen contract, not the newest code.
- Integration owner: Qoder. It runs the full gate, owns the merge commit, and is the only lane that
  may touch two lanes' files during conflict resolution.

## Timeline (T+ hours from kickoff; compress, never skip a gate)

| T+ | Milestone | Exit |
| --- | --- | --- |
| 0:00–0:30 | Read 05/06/ADR/lane; confirm env gaps; Qoder freezes contracts | Contracts commit compiled |
| 0:30–2:00 | Qoder schema/auth/RBAC; OpenCode adapters + parsers; Antigravity tokens/shell/login | Migrations apply; adapters fail closed; login renders |
| 2:00–4:00 | Qoder APIs/admin; OpenCode ingest pipeline; Antigravity all routes | Each lane demoable against real contracts |
| 4:00–5:00 | Integration: merge, wire, seed, first e2e | Golden path green locally |
| 5:00–6:00 | Harden: RBAC matrix, tenant isolation, rejection note, email, dark, 320px | No high/critical findings |
| 6:00–7:00 | Release gate, deploy Supabase/Vercel, smoke | Real URL + evidence |
| 7:00–8:00 | Demo rehearsal with real data | Two clean runs |

## Secrets and access checklist (owner-provided; never commit)

| Need | Env / location | Status |
| --- | --- | --- |
| Supabase Postgres (pooler + direct) | `DATABASE_URL`, `DIRECT_URL` | **pending owner** |
| Supabase Auth + anon | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **pending owner** |
| Supabase service role (server only) | `SUPABASE_SERVICE_ROLE_KEY` | **pending owner** |
| Supabase Storage bucket | `StorageConnection` row (non-secret) | fallback only |
| Gemini dev key | gitignored `apps/web/.env` as `GEMINI_API_KEY` | provided; operator inserts, never in docs |
| Gemini prod key | Vercel secret `GEMINI_API_KEY` | **pending owner** |
| Gemini model | `WorkspaceSettings.llmModel` (DB, server allowlist) | verify at spike |
| Graph app-only | `MSFT_GRAPH_TENANT_ID`, `CLIENT_ID`, `CLIENT_SECRET`, `SITE_ID`, `DRIVE_ID` | **pending owner** |
| Demo/session signing | `AUTH_SECRET` | generate locally |
| Cron | `CRON_SECRET` | generate; set in Vercel |
| Email | `EMAIL_PROVIDER`, `EMAIL_FROM`, `RESEND_API_KEY`/`SMTP_URL` | demo uses Mailpit; prod pending |
| Google/Microsoft OAuth | Supabase dashboard providers + redirect URLs | **pending owner** |
| Official Hexaware logo | `apps/web/public/` + `WorkspaceSettings.logoUrl` | **pending owner** |
| Actual source URLs | `INGESTION_SOURCE_URLS` (env, bootstrap only) → `IngestionSource` rows | **pending owner; never hardcode** |

Never paste a key into a tracked file, a doc, a screenshot, a log, or the client bundle. Rotate any
key that appears in a recording. Prod Gemini key goes only to Vercel. If Supabase/Graph/OAuth arrive
late, ship the interface + honest "Not configured" state; do not fake the integration.

## No-mock rule (applies to all lanes)

- Runtime: no mock rows, canned counts, placeholder names, fake invoices, fake PDFs, fake citations,
  fake emails, or fake provider success. Empty states and "Not configured" are the honest UI.
- Ingestion uses **actual public sources only**. Their URLs are supplied by the owner through
  `INGESTION_SOURCE_URLS`; no regulator URL, listing selector, or document is hardcoded or guessed.
  The bootstrap writes `IngestionSource` rows, and runtime/UI read the DB registry. The v1
  representative-excerpt corpus is not presented as fetched v2 evidence; test fixtures stay in tests.
- Demo seed is allowed only behind `DEMO_MODE=true`, marked by a persistent `Demo` badge, with users
  flagged `isDemo`. It is seed data, not runtime mocks, and never mixed with a real tenant.
- Tests/e2e may use test doubles and fixtures; they must never leak into the app path. External calls
  in tests are intercepted or pointed at local services (Mailpit, local bucket stub is not shipped).
- A missing credential is a visible configuration gap, not a reason to invent a value.

## Definition of done

Per lane: code compiles under `tsc --noEmit`; `npm run lint`; unit tests for the lane's logic; no
`any`, `@ts-ignore`, `console.log`, commented-out code, or secrets; loading/empty/error/unauthorized
states for your surfaces; audit + permission checks for writes; build log update with evidence.

Integration owner: all lanes merged; migrations apply to Supabase; seed idempotent; SSO/demo/guest
paths real; owner matrix + per-user override enforced and audited; manager sees team, employee sees
no compliance by default, guest sees none; URL and PDF ingest both work with real storage; PDF and source links both
serve; rejection without note fails; ack/reject/circular emails observable; tenant isolation tests;
dark + 320–1440 + keyboard/reduced motion; `npm run check` and `npm run release:check` green;
deployed URL smoke; no high/critical findings. Evidence goes in `docs/discovery/09-release-report.md`.

## Kickoff checklist

- [ ] Operator confirms Supabase URL/keys, Graph credentials, OAuth apps, Resend, logo, seed sources.
- [ ] Qoder reads 05 + ADRs, creates `contracts/v2`, installs agreed deps, pushes nothing.
- [ ] Each lane reads its handoff, restates its 3 deliverables + 1 blocker in the channel.
- [ ] Each lane works only in its owned paths; reports contract gaps instead of patching around them.
- [ ] Daily (or T+2h) sync: merged demo, blockers, next command.
- [ ] No commit/push to `main`; integration owner merges after operator approval.

## Top three risks

1. **Credentials and real source URLs late** (Supabase/Graph/OAuth/Gemini/ingestion) — build adapters
   that fail closed; demo login + Supabase Storage fallback keep the demo alive; owner-visible "Not
   configured"; never invent a URL or document.
2. **Contract drift across three lanes** — freeze contracts first, one owner, compile gate at every
   merge, no cross-path edits.
3. **Perceived slowness** — no LLM/Graph in request path; server components; cursor pagination;
   lazy admin/PDF; measure real LCP/INP and record numbers.

Gate: lanes, paths, contracts, merge protocol, secrets, no-mock rule, and definition of done are
defined. Product code may start; 05 and 06 exist.

Next: lane kickoff → [QODER-BACKEND.md](QODER-BACKEND.md),
[ANTIGRAVITY-UI.md](ANTIGRAVITY-UI.md), [OPENCODE-INGESTION.md](OPENCODE-INGESTION.md)