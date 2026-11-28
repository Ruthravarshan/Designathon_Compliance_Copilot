# 05 — Solution design (PolicyPulse v2)

> Phase 05. This supersedes the v1 demo-only design. The existing Next.js 15 / Prisma / Postgres app
> is the base; v2 adds real identity, owner-configurable storage, live ingestion, Gemini extraction,
> database-driven permissions, policy-change visibility, email at every step, dark mode, and a
> deployable worker path. The v1 deterministic engine is retained as the citation verifier and
> fallback, not as a fake AI.

Work was split across backend, UI, and ingestion lanes with one integration owner; slices and
acceptance criteria are in [Work slices and lane ownership](#work-slices-and-lane-ownership).

## Current state and delta

| Already shipped (v1) | Keep / change for v2 |
| --- | --- |
| Next.js App Router workbench, brand tokens, loading/empty/error/unauthorized states | Keep; add dark tokens, responsive polish, real pages only |
| Prisma schema: workspaces, membership, documents, clauses, policies, controls, findings, reviews, audit, outbox | Extend; migrate roles and add settings, departments, overrides, storage, sources, jobs, policy versions, assignments, notifications |
| HMAC demo persona cookie | Keep only as a gated demo fallback; add Supabase Auth SSO and anonymous guests |
| Deterministic parse → verify → map → gap → redline | Keep; feed it verified LLM output and use it as the fallback when Gemini fails |
| Paste-only document ingest | Replace UI with URL/listing ingest and PDF upload; keep a safe manual path behind permission if useful |
| Outbox email + cron route | Extend events and worker; drain email, ingestion jobs, and reminders |
| Local Docker demo | Keep as fallback; Supabase + Vercel is the judged deployment |

## System diagram

```text
Browser
  ├─ / (redirect by session)          /signin (SSO + demo + guest)
  └─ /app (server components + client forms)
       ├─ Supabase Auth session (Google / Microsoft / anonymous guest)
       ├─ demo HMAC session (only DEMO_MODE + workspace setting)
       ├─ getActor() → membership → effective permissions (role + user override + scope)
       ├─ /api/v1/* → same-origin → Zod → requirePermission → service → Prisma → Supabase Postgres
       ├─ /api/v1/files/:id → RBAC → storage adapter (Graph / Supabase) → PDF stream
       └─ notifications, audit, policy changes, assignments

Ingestion / worker
  source listing or upload
    → allowlist fetch + SSRF guard + size/content checks
    → checksum + duplicate/version decision
    → storage adapter upload (SharePoint Graph primary, Supabase Storage fallback)
    → DocumentFile metadata (storage item, webUrl, source URL, pages)
    → PDF text per page → Gemini structured extraction → Zod → exact-quote verification
    → deterministic mapping/gap/redline → document + clauses + obligations + findings
    → assignment + outbox email + audit + in-app notification
    → /api/cron/worker (secret) drains ingestion jobs, email, reminders
```

## Stack decisions

| Area | Decision | Why / boundary |
| --- | --- | --- |
| Identity | Supabase Auth: Google and Microsoft OAuth, anonymous guest sessions | Real SSO and guest control; demo HMAC remains a gated fallback |
| Data | Supabase Postgres via Prisma; `DATABASE_URL` pooler, `DIRECT_URL` direct | Existing schema and migrations remain portable |
| Storage | Provider abstraction; SharePoint via Microsoft Graph is primary; Supabase Storage is the real fallback | Owner chooses location; never fake an upload |
| LLM | Gemini API (free tier) via server-side REST, structured JSON, versioned prompt | Real extraction; quota/backoff; key server-only; verify key mode at spike |
| Verification | Existing deterministic verifier + exact substring check on every LLM quote | Zero fabricated citations; unverified output is flagged, not published |
| Worker | Postgres job/outbox tables + secret `/api/cron/worker`; schedule with Supabase pg_cron or Vercel Pro | Works on free tier; idempotent claims; no second always-on service required |
| Config | `WorkspaceSettings`, `StorageConnection`, `IngestionSource`, role tables | Owner changes settings without a redeploy; env holds secrets only |
| UI | Tailwind 4 tokens, Manrope, light + dark, server-first | Brand contract, responsive, fast |
| Hosting | Vercel app + Supabase DB/Auth/Storage; region aligned | Deploy-ready demo; Docker stays the fallback |

## Data model (Prisma changes)

Existing models not listed here stay. Every new workspace-owned row carries `workspaceId` with an
index that starts with it. Enums are closed system contracts; user-visible values (issuers, sources,
departments, app name) are database rows.

| Model | Purpose and key fields |
| --- | --- |
| `Workspace` (extend) | `isDemo` so the UI can badge demo content without hardcoding a slug; every demo row stays visibly demo |
| `User` (extend) | `supabaseId? @unique`, `isDemo`, `isGuest`, `status`, `title?`, `lastSeenAt`, `avatarUrl?`; email is nullable-unique for anonymous guests (guests have no email and receive none) |
| `Role` enum (extend) | `OWNER`, `ADMIN`, `COMPLIANCE_MANAGER`, `MANAGER`, `EMPLOYEE`, `AUDITOR`, `GUEST`; migrate `MEMBER→EMPLOYEE`, `VIEWER→AUDITOR` |
| `Department` | workspace, name, slug, `managerId?`; unique `(workspaceId, slug)` |
| `Membership` (extend) | `departmentId?`, `status` (`ACTIVE/INVITED/SUSPENDED`), `expiresAt?` for guests |
| `RolePermission` | `(workspaceId, role, permission)` unique, `allowed`; seeded defaults, owner-editable |
| `UserPermissionOverride` | `(workspaceId, userId, permission)` unique, `effect` `GRANT/DENY`; user deny wins |
| `WorkspaceSettings` | one row per workspace: app name, logo URL, support email, default theme, demo/guest toggles, SSO toggles, allowed domains, auto-provision role, AI toggle/model, email sender name/reply-to, ingestion schedule |
| `StorageConnection` | provider (`SHAREPOINT/SUPABASE_STORAGE/GOOGLE_DRIVE`), non-secret config JSON (site, drive, folder, bucket), `isDefault`, `status`, `lastCheckedAt`, safe error code |
| `IngestionSource` | name, issuer, listing URL, allowed domains, optional selector, kind, schedule, enabled, storage connection, last run |
| `IngestionRun` / `IngestionJob` | run counts/timings/status and `steps` JSON (fetch/store/extract/verify/publish, truthful for the UI); job URL/checksum/attempts/`lockedAt`/next attempt/error code/document id |
| `LlmCall` | document/job, model, prompt version, status, latency, token counts, safe error; no prompt secrets or PII |
| `RegulatoryDocument` (extend) | issuer string (open set), `sourceType`, `sourceUrl`, `version`, `parentId?`, richer status, `ingestionRunId?`, AI status/model, risk, summary; unique `(workspaceId, reference, version)` |
| `DocumentFile` | document, `workspaceId`, kind (`PDF/SOURCE/ATTACHMENT`), provider, `storageConnectionId`, `storageItemId`, `storageWebUrl`, filename, MIME, bytes, checksum, pages, `isPrimary`, source URL; unique `(workspaceId, checksum)` so dedupe is tenant-safe |
| `PolicyVersion` | policy, version, text, change summary, source document, author, date |
| `PolicyChange` | policy, from/to version, circular, before/after or diff, summary, status, approver, published date |
| `Assignment` | kind, entity id, title, assignee user/role/department, due date, status, `acknowledgedAt`, `rejectionNote`, `rejectedAt`, creator, completed date |
| `AssignmentEvent` | action, actor, mandatory note, metadata, date |
| `Notification` | user, workspace, type, title, body, href, read date |
| `AuditLog` (extend) | add `requestId`; keep actor/entity/metadata; never secrets or PII |
| `EmailMessage` (extend) | existing outbox; add the new events and recipient user/workspace context |

`DocumentClause` keeps `pageNumber`; the primary `DocumentFile` is the PDF citation. Findings and
`ReviewEvent` remain the gap/review spine; assignments can point at a finding, circular, or policy
change.

## Identity, SSO, guests, and tenancy

- Supabase Auth owns production sessions (`@supabase/ssr` cookies, middleware refresh, server-side
  user validation with local JWT verification where available). On callback, sync the Supabase user to
  `User` by `supabaseId`/email and resolve `Membership`.
- **SSO**: Google enabled by default; Microsoft Entra available when configured. Provider buttons are
  driven by `WorkspaceSettings` and show a clear "not configured" state rather than a fake login.
- **Demo**: the persona picker is rendered from seeded `User` rows marked `isDemo`, never a hardcoded
  array. It is enabled only when `DEMO_MODE=true` **and** `WorkspaceSettings.demoLoginEnabled`; it is
  rate-limited, audited, and labelled as demo access.
- **Guest**: Supabase anonymous sign-in, then an app-side gate. `WorkspaceSettings.guestAccessEnabled`
  must be true; guest membership is `GUEST`, sample-scoped, optionally expiring. Disabling the setting
  or revoking the member blocks the next request, not just the next login. Owner/admin can revoke a
  guest and audit it.
- **New SSO users**: check the email domain against `allowedEmailDomains`; apply `autoProvisionRole` or
  create a pending membership for owner approval. Never auto-grant compliance access.
- **Tenancy**: workspace is resolved from the session; every query filters by it. File proxies,
  assignments, policies, settings, sources, and audit are workspace-scoped. Cross-tenant probes return
  404. Supabase PostgREST access for `anon/authenticated` is revoked/denied; the browser never queries
  app tables directly.

## RBAC: role + person + department

Capabilities are explicit permission strings (for example `circular:read`, `circular:ingest`,
`finding:review`, `assignment:ack`, `compliance:view_all`, `compliance:view_team`,
`compliance:view_own`, `settings:manage`, `role:manage`, `storage:manage`, `audit:read`,
`guest:manage`). The role matrix is seeded into `RolePermission` and owner-editable. Resolution:

1. `OWNER` always has every permission; the owner cannot lock themselves out.
2. An explicit user `DENY` wins over a user `GRANT`.
3. A user `GRANT` wins over the role row.
4. Otherwise the role row decides; a missing row denies.
5. Compliance reads also apply the department scope: `all`, `team` (own department), `own`
   (assignments where the user is the assignee), or `none`. Defaults matter: an **EMPLOYEE sees no
   compliance data**; a manager sees the team; the owner can grant `own` or `team` per person or role
   from the DB matrix. A user cannot widen scope by editing a URL.

| Capability | OWNER | ADMIN | COMPLIANCE_MANAGER | MANAGER | EMPLOYEE | AUDITOR | GUEST |
| --- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| Compliance visibility | all | all | all | team | none (grantable) | all read-only | none |
| Read circulars/policies | ✓ | ✓ | ✓ | team/own | assigned | ✓ | sample only |
| Ingest circulars | ✓ | ✓ | ✓ | — | — | — | — |
| Review findings / policy changes | ✓ | ✓ | ✓ | recommend | — | — | — |
| Publish policy changes | ✓ | ✓ | ✓ | — | — | — | — |
| Acknowledge / reject assignment | ✓ | ✓ | ✓ | team | own | — | — |
| Audit trail | ✓ | ✓ | ✓ | team? | — | ✓ | — |
| Members, departments, guest revoke | ✓ | ✓ | — | — | — | — | — |
| Roles, permissions, storage, SSO, AI, branding | ✓ | — | — | — | — | — | — |

Owner-only capabilities (`role:manage`, `settings:manage`, `storage:manage`, `guest:manage`) cannot
be granted to a non-owner through a per-user override.

The owner/admin UI shows this matrix as simple scope selectors plus an advanced permission grid, with
a per-person override panel. Last-owner and self-demotion guards apply; every role/override change is
audited. The UI mirrors permissions for affordances; every API and page enforces them server-side.

## Ingestion agent

Two entry paths from the real ingest page: **upload a PDF** or **provide a link** (listing page or
direct PDF). Only `circular:ingest` can submit. The API validates, enqueues an `IngestionJob`, returns
`202`, and the UI polls the run. No LLM call blocks the request.

### Actual sources, real documents

- The owner supplies **actual public source URLs** through `INGESTION_SOURCE_URLS` (env). No regulator
  URL, listing selector, or document is hardcoded or guessed in code, seed, tests, or docs. If a URL is
  missing, the app shows an honest "Not configured" path; it never substitutes a fake.
- The one-time bootstrap reads that env value into `IngestionSource` rows: host-derived label,
  `allowedDomains` from the host, disabled until the owner names/enables it. Runtime and UI read the DB,
  so the owner can edit, schedule, test, or disable a source without a redeploy. Env is the entry point
  for actual URLs; the DB is the runtime registry.
- Ingestion stores the **original fetched PDF** and its real source URL. The v1 representative-excerpt
  corpus is not presented as v2 ingested evidence; test fixtures live under tests, never in the demo
  workspace as if fetched. If a source is unreachable, robots-disallowed, or returns no PDFs, the run
  fails visibly and creates no document.

Pipeline guarantees:

1. **Fetch**: http/https only; host must match the source allowlist; block loopback, private,
   link-local, and metadata ranges after DNS resolution and on every redirect; max 5 redirects,
   bounded timeout, bounded response size; respect `robots.txt` for listing crawls.
2. **Discover**: parse anchors/files, accept PDF by content-type and `%PDF-` magic, cap links per run
   and documents per run; store the source URL and retrieval time; dedupe by normalized URL and
   SHA-256 checksum.
3. **Store**: upload to the configured provider under a sanitized
   `{workspace}/{issuer}/{year}/{reference}-{checksum8}.pdf` path; keep the storage item id, web URL,
   and source URL. SharePoint uploads use Graph (small `PUT`, upload session for larger files). A
   storage failure fails the job with a safe code; it never reports success.
4. **Extract**: extract text per page; send page-marked text to Gemini with a versioned prompt and a
   strict JSON schema. Treat the document as untrusted: ignore instructions inside it, never use tools
   from it, and return null for unknown fields.
5. **Verify**: Zod-validate the response; every quote must be an exact (whitespace-normalized)
   substring of the cited page; otherwise mark `citationVerified=false` and `NEEDS_REVIEW`, keep the
   source, and never auto-publish a finding. The deterministic engine supplies mapping/gap/redline and
   a fallback extraction path if Gemini is unavailable; the document's AI status says which path ran.
6. **Persist**: document + file + clauses + obligations + findings/impact in one transaction; audit
   `circular.ingested`; enqueue the "circular received" email and in-app notification to permitted
   roles; update the run/job.
7. **Retry**: idempotent job claim (`QUEUED→RUNNING` with `lockedAt`), bounded exponential backoff,
   stale-lock recovery. Re-running the same checksum returns the existing document link.

Citations: every item exposes **View PDF** (app file proxy, authorized and range-capable) and **View
source** (the original URL). If only one exists, the other is disabled with a reason. The reader
chooses; no fake PDF and no dead link.

## API contract (v2 additions)

All routes live under `/api/v1`, use same-origin checks for mutations, Zod at every boundary, the
existing `{ data }` / `{ error: { code, message, requestId, details? } }` envelope, cursor pagination,
bounded payloads, rate limits, and audit rows. Existing v1 routes are migrated or retired, not left
dead.

| Method | Route | Permission | Notes |
| --- | --- | --- | --- |
| GET | `/api/v1/me` | session | actor, effective permissions, scope, workspace branding/settings |
| GET/PATCH | `/api/v1/me/preferences` | session | theme-independent email categories; transactional always on |
| GET | `/api/public/branding` | none | app name/logo/theme, enabled providers, demo personas (no emails), guest gate; DB-driven, no fake |
| GET | `/auth/callback` | none | Supabase OAuth/anonymous session exchange + user sync (outside `/api/v1`) |
| POST | `/api/auth/demo` | demo gate | seeded demo user id only; rate limited |
| POST | `/api/auth/signout` | session | clears Supabase + demo sessions |
| GET | `/api/v1/circulars` | `circular:read` + scope | cursor, issuer/status/search filters |
| POST | `/api/v1/circulars/ingest` | `circular:ingest` | `{ mode: "url" \| "listing", url, sourceId? }` → 202 run |
| POST | `/api/v1/circulars/upload` | `circular:ingest` | multipart PDF, bounded → 202 run |
| GET | `/api/v1/circulars/:id` | `circular:read` + scope | files, clauses, obligations, findings, policy changes, assignments |
| GET | `/api/v1/files/:fileId` | `circular:read` + scope | authorized PDF stream, Range, `no-store` |
| GET | `/api/v1/policies` / `:id` | `policy:read` + scope | list/version history/diff |
| POST | `/api/v1/policies/:id/publish` | `policy:publish` | publish an approved change; audit + notify |
| GET | `/api/v1/compliance` | `compliance:view_*` | resolved all/team/own metrics and rows; employee default none |
| POST | `/api/v1/compliance/:id/review` | `finding:review` | approve or reject a finding; reject requires a note (min 10) |
| GET | `/api/v1/assignments` | `assignment:read` | assignee/department scope |
| POST | `/api/v1/assignments/:id/ack` | `assignment:ack` | owner-only on the assignment |
| POST | `/api/v1/assignments/:id/reject` | `assignment:ack` | `note` required, min 10 chars |
| POST | `/api/v1/assignments/:id/reassign` | `assignment:manage` | audited; emails both parties |
| GET | `/api/v1/notifications` | session | inbox; PATCH read or mark-all-read |
| GET | `/api/v1/audit` | `audit:read` | cursor; scope-aware |
| GET/POST | `/api/v1/ingestion/sources` | `settings:manage`/`source:manage` | owner/admin source registry |
| POST | `/api/v1/ingestion/sources/:id/test` | `source:manage` | real fetch probe, no fake success |
| GET | `/api/v1/ingestion/runs` | `circular:ingest` | status/timings/errors |
| POST | `/api/v1/ingestion/runs/:id/retry` | `circular:ingest` | re-enqueue failed jobs |
| GET/PATCH | `/api/v1/admin/settings` | `settings:manage` | branding/auth/AI/email/ingestion defaults |
| GET/PATCH | `/api/v1/admin/roles` | `role:manage` | role matrix |
| GET/POST/PATCH | `/api/v1/admin/members` | `member:manage` | role, department, status, overrides |
| GET/POST | `/api/v1/admin/departments` | `member:manage` | manager assignment |
| GET/POST | `/api/v1/admin/storage` | `storage:manage` | connections; secrets stay in env |
| POST | `/api/v1/admin/storage/:id/test` | `storage:manage` | real Graph/bucket probe |
| POST | `/api/v1/admin/ai/test` | `settings:manage` | real Gemini smoke; no prompt echo |
| POST | `/api/v1/admin/email/test` | `settings:manage` | enqueue test through outbox |
| GET/POST | `/api/cron/worker` | `CRON_SECRET` | email + ingestion + reminders; bounded batch |
| GET | `/api/health` | none | DB + configured integration status; no secrets |

## Email events

All email goes through the existing outbox; a request only enqueues. Recipients are derived from DB
permissions/departments/assignments, never a hardcoded list. New templates use the brand tokens, escape
variables, strip CRLF from subjects, allow only http(s) links, and honor preferences/suppression.

| Event | Recipients | Trigger |
| --- | --- | --- |
| `circular.received` | owner + roles with compliance visibility | ingestion completes with a ready document |
| `ingestion.failed` | owner + admin | run/job fails after bounded retries |
| `assignment.created` | assignee; manager copy | assignment created |
| `assignment.acknowledged` | creator/manager | assignee acknowledges |
| `assignment.rejected` | creator/manager + assignee | reject with mandatory note |
| `assignment.overdue` | assignee + manager | reminder job passes due date |
| `policy.change_published` | roles with policy/compliance permission | approved policy change published |
| `member.role_changed` / `member.removed` / `guest.access_revoked` | affected user + owner | access mutation |
| `welcome` / `workspace.invitation` | invited user | onboarding/invite |
| `email.test` | requesting owner/admin | explicit test |

`assignment.created`, `acknowledged`, `rejected`, and `circular.received` are product-category by
default (on, with a preference); access changes and invitations are transactional. The owner can see
outbox status and a safe error code; no recipient addresses or provider payloads in logs.

## Owner control surface (all DB-driven)

- **Branding**: app name (seeded `PolicyPulse`), logo URL (official Hexaware asset only), support
  email, default theme.
- **Identity**: Google/Microsoft toggles, allowed email domains, auto-provision role, pending approval,
  demo-login toggle, guest toggle + revoke, guest expiry.
- **Roles & people**: role matrix, compliance scope per role, per-user grant/deny, departments and
  managers, member status. Last-owner guard.
- **Storage**: provider choice, SharePoint site/drive/folder or Supabase bucket, test connection,
  default connection. Secrets remain in env/Vercel; the UI shows configured/not configured.
- **Ingestion**: sources, issuer names, listing URLs, allowlists, schedule, enabled, test/run-now,
  run history. Actual URLs are bootstrapped from `INGESTION_SOURCE_URLS` (never hardcoded); the
  owner edits/enables the resulting DB rows at runtime.
- **AI**: enabled, model (allowlisted), prompt version, max docs/run, status/quota errors.
- **Email**: sender name, reply-to, event toggles for product mail, outbox health.
- **Audit**: every settings, role, member, storage, source, guest, and AI change is recorded with
  actor, before/after metadata, and request id.

## Performance and perceived speed

- API mutations that call Gemini or Graph enqueue and return; the UI shows real job progress.
- Server components first; client components only for interactive islands; lazy-load the PDF viewer
  and admin-heavy tables; no chart library on the dashboard.
- Every list is cursor-paginated with a stable tiebreaker; select only fields the view renders; add
  indexes for every filter/sort; parallelize independent queries; no N+1 includes.
- Cache settings, role matrix, and branding per workspace with tag invalidation; never cache
  authorization decisions or file access.
- Stream pages with route-level `loading.tsx`/Suspense skeletons; preserve layout (CLS); prefetch
  primary nav; optimistic acknowledge/reject with rollback.
- Targets: LCP < 2.5s, INP < 200ms, CLS < 0.1, authenticated API p95 < 500ms warm, first-load JS
  < 250 kB gzipped on the main view. Measure with Lighthouse/Web Vitals before and after; record real
  numbers, not claims.
- Align the Vercel function region with Supabase; pool connections; warm the deployment before the
  demo. Use a production build for the judged walkthrough, not the dev compiler.

## Security and failure modes

| Failure | Behavior |
| --- | --- |
| Cross-tenant id / file id | 404 after workspace check; file proxy never leaks existence |
| Guest disabled or revoked mid-session | Next request is rejected; settings checked per request |
| SSO user not in an allowed domain | Denied with a safe explanation; no membership created |
| Demo mode disabled | Demo endpoint and sessions rejected; SSO still works |
| Rejection without a note | 400/422; min length enforced in Zod and service; no state change |
| SharePoint unconfigured/down | Job fails with `INTEGRATION_NOT_CONFIGURED`/`STORAGE_UNAVAILABLE`; no fake upload or citation |
| Gemini quota/error/invalid JSON | Bounded retry, then deterministic fallback; AI status visible; no invented facts |
| Quote not in source | `citationVerified=false`, `NEEDS_REVIEW`; no auto-publish |
| Duplicate source/checksum | Return existing document; no duplicate rows or emails |
| SSRF/redirect to private host | Blocked before fetch; job fails safely |
| File upload too large/wrong type | 413/415 before storage; magic-byte check |
| Worker secret wrong/missing | 401/503; no job processing |
| LLM prompt injection in a circular | Untrusted text, no tools, schema validation, quote verification |
| Outbox/Graph outage | Rows stay queued with bounded retry; UI unaffected; audit retained |
| Owner tries to remove last owner | 409/403; guard invariant |

## Deployment and gate

1. Supabase: project, poolers, Auth providers (Google/Microsoft), anonymous guests, redirect URLs,
   pg_cron/pg_net for the worker, RLS/privilege lockdown, migrations, seed.
2. Vercel: root `apps/web`, env/secrets, region, `maxDuration` for the worker, security headers/CSP
   extended for Supabase and the auth callback, health check.
3. Microsoft Graph app registration and consent; site/drive/folder set in owner settings; test.
4. Gemini prod key in Vercel only; verify mode/quota; data-use caveat recorded.
5. Resend/verified domain or SMTP; cron secret; outbox smoke.
6. Smoke: demo + SSO + guest gate, role visibility, owner matrix change, URL and PDF ingest, PDF vs
   source citation, rejection-note guard, ack email, dark/responsive, tenant isolation, 401/403/429,
   health. Record real evidence in the release report.

## Work slices and lane ownership

| Slice | Owner | Done when |
| --- | --- | --- |
| Contracts + schema/migrations + seed | Backend lane | UI and ingestion can compile against stable types; seed includes roles, demo users, departments, settings |
| Auth + RBAC + settings + admin APIs | Backend lane | SSO/demo/guest work; owner changes matrix; employee/manager/auditor scopes proven |
| Core APIs + file proxy + policy changes + assignments + emails | Backend lane | Golden path works with real DB; rejection notes; outbox events |
| UI system, login, shell, all pages, dark/responsive/perf | UI lane | Every route is real, permission-aware, complete states; no mock data |
| Ingestion + storage + Gemini + worker | Ingestion lane | Real URL/PDF ingest → storage → verified extraction → citations; failures visible |
| Integration + gate + deploy smoke | Integration owner | `npm run check`, e2e, real deploy smoke, no high/critical findings |

## Acceptance criteria

- Owner can change compliance visibility for a role and a single person; the change is enforced on the
  next request and audited. A manager sees their team; an **employee sees no compliance by default**
  and can be granted `own` or `team` by the owner; a guest sees no compliance data.
- Google SSO works (when configured); demo login works only when enabled; guest login can be turned on
  and revoked by owner/admin; the login page never shows a fake provider.
- Authorized roles can ingest a listing URL or upload a PDF; unauthorized roles cannot see the CTA or
  call the API successfully.
- A ready circular shows both a stored PDF and the source website link, and the reader can choose;
  missing links are explicit.
- Every rejection — assignment, finding review, or policy change — requires a note; the note is
  stored, audited, and emailed to the right people.
- The owner receives a "circular received" email; assignees receive acknowledgement requests; ack and
  rejection emails are observable in Mailpit/Resend.
- Every number, option, persona, source, role matrix, and setting on screen comes from the DB; empty
  states replace fake data; there is no proof/illustrative page standing in for the product.
- Dark mode, 320–1440px layouts, keyboard/focus/contrast, and reduced motion pass.
- The deployed URL passes the smoke test; `npm run check` and the release gate are green with real
  evidence.

## Risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Supabase/Graph/OAuth credentials arrive late | SSO, SharePoint, guest, deploy blocked | Build against interfaces; real adapters fail closed; prioritize demo login + Supabase Storage fallback |
| Gemini key mode/quota unknown | Extraction fails during demo | Verify at spike; queue/backoff; deterministic fallback; owner-visible AI status |
| Free-tier Gemini data use | Compliance/privacy concern | Send only public circulars by default; internal Q&A opt-in; disclose; paid/Vertex for production |
| Parallel lanes conflict | Merge pain, broken contracts | File ownership, contract freeze, branches/worktrees, integration owner merges |
| SharePoint permission model | 403 in demo | Site-scoped `Sites.Selected` or documented `Sites.ReadWrite.All`; test connection before demo |
| Scraped pages block bots/SSRF false positives | No ingested docs | Manual PDF/URL path is first-class; allowlist and robots respected; don't bypass |
| No mock rule misunderstood as no tests | Untestable externals | Test doubles allowed only under test/e2e; runtime never fakes data |
| Performance regressions from auth/LLM | Slow app | No LLM in request path; auth caches/JWT verification; pagination; measure |

Gate: architecture, data, API, RBAC, ingestion, storage, email, performance, deployment, and acceptance
criteria are defined. `06-visual-direction.md` is updated; product code may start now that both
artifacts exist. Real source URLs are supplied through `INGESTION_SOURCE_URLS` and never hardcoded.

Next: build → `07-build-log.md`.