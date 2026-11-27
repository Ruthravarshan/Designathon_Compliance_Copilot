# Qoder lane — contracts, identity, RBAC, APIs, worker, deploy, integration

> You are the contract owner and integration owner. You land the shared shape first, keep the other
> lanes unblocked, then build the server. Read [README](README.md), [05](../discovery/05-solution-design.md),
> [06](../discovery/06-visual-direction.md), ADRs 0003–0006. You do not write product UI except
> minimal route shells and error boundaries needed to compile. No commit/push to `main`; merge only
> when the operator asks.

## Mission

Make PolicyPulse's data, identity, permissions, APIs, email, worker, and deployment real. Every value
the user sees comes from the DB; every read/write is workspace-scoped and server-authorized; every
long call is queued; the other two lanes compile against frozen contracts and never touch your files.

## Deliverable 0 — contracts and environment (first, blocks everyone)

Write `apps/web/src/lib/contracts/`:

- `permissions.ts` — the exact capability strings and role names from README; a `Capability` union and
  `COMPLIANCE_SCOPE` union (`all|team|own|none`).
- `api.ts` — `ApiSuccess<T>`, `ApiError`, `Page<T>` (`items`, `nextCursor`), `ActorContext` (user,
  workspace incl. `isDemo`, membership, permissions, scope), `Theme = "light"|"dark"|"system"`.
- `domain.ts` — DTOs the UI renders: circular list/detail, file, policy change, assignment, audit,
  member, department, source, run, settings, integration status. Types only; no runtime secrets.
- `schemas.ts` — Zod request/response schemas where the UI needs to parse (optional if server-only).

Install only the agreed deps (`@supabase/ssr`, `@supabase/supabase-js`, `unpdf`,
`node-html-parser`) at the root
workspace; run `npm run check`; announce the commit. Add env names to `.env.example` with placeholders
only. Never write a real key to `.env.example`, docs, tests, or logs. The operator inserts the dev
Gemini key into gitignored `apps/web/.env`; the prod key lives only in Vercel.

Add `Workspace.isDemo Boolean @default(false)` and include `isDemo` in `ActorContext`; the UI badge
depends on it. Announce this addition so 05/README stay accurate.

## Deliverable 1 — schema, migration, seed

Extend [schema.prisma](../../apps/web/prisma/schema.prisma) per 05: User (`supabaseId?`, `isDemo`,
`isGuest`, `status`, `title?`, `lastSeenAt`, `avatarUrl?`; make `email` nullable-unique for
anonymous guests), Role enum, Department, Membership (`departmentId?`, `status`, `expiresAt?`),
RolePermission, UserPermissionOverride, WorkspaceSettings, StorageConnection, IngestionSource,
IngestionRun, IngestionJob, LlmCall, RegulatoryDocument extensions, DocumentFile, PolicyVersion,
PolicyChange, Assignment, AssignmentEvent, Notification, AuditLog.requestId, EmailMessage
extensions.

Rules:

- Every workspace-owned model: `workspaceId`, index starting with it, FK, cascade as appropriate.
- Unique: `RolePermission(workspaceId, role, permission)`,
  `UserPermissionOverride(workspaceId, userId, permission)`, `Department(workspaceId, slug)`,
  `RegulatoryDocument(workspaceId, reference, version)`, `DocumentFile(documentId, checksum)`,
  `StorageConnection(workspaceId, provider)` unless multiple connections are intended.
- Role migration is real SQL, not `db push`: add the new enum values, preserve rows
  (`MEMBER→EMPLOYEE`, `VIEWER→AUDITOR`), then remove the old values. Test on a copy of seeded data.
- Migration backfills one `WorkspaceSettings` per workspace, a "General" department, and the default
  role matrix. No owner lockout: existing OWNER rows stay OWNER.
- `IngestionJob` needs `status`, `attempts`, `maxAttempts`, `lockedAt`, `nextAttemptAt`, `lastErrorCode`,
  payload fields (`mode`, `url?`, `storageItemId?`, `storageConnectionId?`, `checksum?`), `runId`,
  `workspaceId`, timestamps, and indexes for claim (`status`, `nextAttemptAt`, `lockedAt`). No raw
  provider error text. `IngestionRun.steps` is JSON with five truthful step states for the UI.
- `DocumentFile` carries `workspaceId` and `storageConnectionId`; unique `(workspaceId, checksum)`;
  the file proxy reads through the connection that stored it, not the current default.
- `StorageConnection.config` is non-secret JSON; secrets stay in env. `status` is
  `UNCONFIGURED|CONNECTED|ERROR` with a safe code and `lastCheckedAt`.
- `LlmCall` stores model, promptVersion, status, latency, token counts, safe code — never prompt text,
  document text, or key.

Seed (`prisma/seed.ts`, idempotent upserts, guarded by `DEMO_MODE` for demo content):

- Workspaces `hexa-demo` (`isDemo: true`) and `northwind-assurance`; mark demo rows visible.
- Settings: app name `PolicyPulse` (seed value, editable), support email, default theme `system`,
  demo login enabled only for demo, guest disabled by default, SSO toggles, allowed domains,
  auto-provision role `EMPLOYEE`, ingestion schedule, AI enabled + allowlisted model.
- Role matrix defaults exactly matching 05's table. Owner row all. **EMPLOYEE sees no compliance**,
  MANAGER team, AUDITOR read-only all, GUEST none; the owner may grant `own`/`team` by override.
- Departments (Compliance, Operations, Finance), managers; existing personas flagged `isDemo` and
  assigned roles/departments. Do not invent real people; demo rows are labelled.
- Storage connection row with `UNCONFIGURED` (honest) or the real provider once env exists.
- **Actual sources only:** read `INGESTION_SOURCE_URLS` (comma-separated, owner-supplied) and upsert
  `IngestionSource` rows with a host-derived label, `allowedDomains` from the host, and `enabled:false`
  until the owner reviews. Never hardcode a regulator URL, selector, or document; if the env value is
  empty, create no sources (the UI says "No sources yet."). Runtime/UI read the DB registry.
- Do not seed the v1 representative-excerpt circulars as v2 evidence. Demo documents must come from a
  real source URL or an upload; tests use fixtures only. The URL is the only actual value that enters
  through env; the DB remains owner-editable at runtime.
- A second empty workspace proves the empty states and tenant isolation.

Run migrations against local Postgres; verify `\d` constraints and re-run seed twice with no
duplicates.

## Deliverable 2 — identity, sessions, RBAC

- Supabase Auth via `@supabase/ssr`: browser helper at `src/lib/supabase/client.ts` for Antigravity's
  SSO buttons; server client + middleware refresh; `/auth/callback` exchanges the code, validates
  the user server-side, upserts `User` by `supabaseId`/email, resolves membership.
- Allowed-domain check; `autoProvisionRole` or pending membership; never auto-grant compliance access
  wider than settings allow. SSO provider buttons come from `GET /api/public/branding`; a provider with
  no credentials returns `configured:false`; never render a fake login.
- Demo login: `POST /api/auth/demo` accepts only a seeded demo user id; enabled only when
  `DEMO_MODE=true` **and** `WorkspaceSettings.demoLoginEnabled`; rate-limited and audited. HMAC session
  remains the demo mechanism, `httpOnly`, `SameSite=Lax`, `secure` in prod, short TTL.
- Guest: anonymous Supabase session, then workspace-scoped gate. The workspace must be carried by a
  DB-authorized guest link/slug (never a hardcoded id); `guestAccessEnabled` and `expiresAt` are
  checked on **every request**, and revoking a guest or disabling the setting blocks the next request.
  A guest has `GUEST`, sample-scope, no compliance data, no ingest/review. Owner/admin can revoke and
  audit. Display name is "Guest", email may be null; no email is sent to guests.
- `getActor()` resolves session → user → membership → effective permissions → scope once per request
  (React `cache`). `requirePermission(actor, capability)` and `assertScope` are used by every page/API.
  Parameters, bodies, query, and cursors are Zod-validated; `workspaceId` never comes from the body.
- RBAC resolver: owner all; user DENY beats user GRANT beats role row; missing denies; compliance
  scope all/team/own/none. Owner-only capabilities (`role:manage`, `settings:manage`, `storage:manage`,
  `guest:manage`) cannot be granted by override to a non-owner. Last owner cannot be removed or
  demoted; a user cannot self-escalate. Tests for every cell in the 05 matrix + both workspaces.

## Deliverable 3 — settings and admin APIs

Implement 05's admin surface: `GET/PATCH /api/v1/admin/settings`, roles matrix, members (role,
department, status, per-user overrides), departments, storage connections, test endpoints, AI smoke,
email test. Rules: only the permission allows it; every mutation writes `AuditLog` with before/after,
actor, requestId; no secret is ever returned; provider test returns a real result or a safe error;
a "Connected" badge requires a successful live check. Branding/settings reads are cached with tag
invalidation; authorization is never cached.

## Deliverable 4 — core APIs and email

Implement the 05 routes, in this order: `/me` + `/me/preferences`, `/public/branding`, circulars
list/detail, file proxy, policies (+ publish), compliance (+ review), assignments, notifications,
audit, ingestion runs/sources, then admin. Public branding includes enabled SSO providers, demo
personas without emails only when demo is enabled, and the guest gate. Shape:
`{ data }` / `{ error: { code, message, requestId, details? } }`; cursor pagination with stable
tiebreaker; select only rendered fields; parallelize independent queries; no N+1.

- **File proxy** `GET /api/v1/files/:fileId`: resolve file → document → workspace; check permission
  and scope; 404 on cross-tenant; stream through OpenCode's `StorageProvider.read` with Range support;
  `Content-Type: application/pdf`, `Content-Disposition: inline`, `Cache-Control: private, no-store`;
  never expose storage credentials or raw provider errors.
- **Rejection everywhere** — assignment reject, finding review reject, policy change reject: body
  `{ note }`, min 10 chars after trim, max 2000; missing/short = 422 and no state change; persist note,
  event, audit, and the right email. Acknowledge is idempotent; reassign is audited.
- **Policy change** visibility is permission + scope filtered, never client-filtered. Review/publish
  require `finding:review`/`policy:publish`; publish enqueues `policy.change_published` and audits.
- **Email**: extend the outbox events/templates; recipients resolved from DB permissions, departments,
  assignments. Escape variables, strip CRLF from subjects, allow only http(s) links, honor preferences
  and suppression, never log recipient addresses/bodies, never send inline. Product mail defaults on
  with a preference; access/invite mail transactional. Add `welcome` and `workspace.invitation` flows.

## Deliverable 5 — worker and speed

- `GET`+`POST /api/cron/worker` with `Authorization: Bearer $CRON_SECRET` compared in constant time;
  401/503 otherwise; bounded batch; returns counts only. Compose OpenCode's `runIngestionJobs`, your
  email drain, and overdue reminders. Idempotent claims/status; retry with backoff; stale-lock recovery.
- After `queueUrlIngest`/`queueUploadedPdf`, call `after(() => runIngestionJobs({ limit: 1 }))` so the
  demo progresses immediately; the route still returns `202` fast. Upload duplicate returns
  `{ documentId, duplicate: true }` with no new run; the route surfaces it instead of a fake queue.
- Provide the persistence seam OpenCode calls after verification:
  `persistIngestedCircular({ workspaceId, userId, runId, sourceId?, sourceUrl, issuer, reference,
  title, publishedAt?, effectiveAt?, pages, extraction, file, storageConnectionId, ai }) →
  { documentId, needsReview, findingCount }`. It writes document/file/clauses/obligations/findings +
  audit and enqueues `circular.received` in one transaction, reusing the existing deterministic engine;
  it never publishes unverified quotes.
- No Gemini, Graph, or PDF parse in a request path. Route-level skeletons, cached settings, pagination,
  server components. Record real LCP/INP/p95 before/after in the build log; no invented numbers.

## Deliverable 6 — deployment and integration

- Supabase: project, pooler/direct URLs, Auth providers + redirect URLs, anonymous guests, RLS /
  PostgREST lockdown for app tables, `pg_cron`+`pg_net` (or documented manual drain), migrations,
  seed. Vercel: root `apps/web`, env secrets, region aligned, cron entry, `maxDuration`, CSP/security
  headers allow Supabase + callback. Health route reports DB and configured integrations without
  secrets.
- Merge lanes in the README order; resolve only in favor of frozen contracts. Run `npm run check`,
  `npm run test:e2e`, `npm run release:check`; fix blockers only after freeze.
- Keep `docs/discovery/07-build-log.md` updated at least hourly; write evidence to
  `09-release-report.md`; update `WEBSITE-DELIVERY-STATUS.md` only from evidence. No waiver to reach
  coverage.

## Tests you own

RBAC resolver and every role cell; last-owner/self-escalation; per-user deny/grant; compliance scope
(manager/team, employee none default, granted own/team, guest none); two-workspace 404s; Zod boundary
rejection; rejection-note 422 with no state change on assignment, finding, and policy change; file
proxy authorization/Range/no-store via the stored connection; email escaping/CRLF/link scheme; outbox
idempotency and preference/suppression; worker secret and retry/claim; rate limits; settings audit;
`/me` + `/me/preferences` shape; publish permission. E2E: demo golden path (ingest or seeded circular
→ PDF/source → ack/reject with note → policy change visible → audit); unauthorized ingest; tenant
isolation; mobile. SSO provider login is a manual check with real credentials; do not fake it in e2e.

## Order of work

1. Contracts + deps + env placeholders → announce.
2. Schema migration + generated client + seed → announce; unblocks OpenCode and Antigravity.
3. Auth/RBAC/`/me`/public branding.
4. Core read APIs + file proxy + settings/admin.
5. Writes: reject/ack, policies, assignments, email events.
6. Worker + after-nudge + deploy config.
7. Integration, release gate, deploy smoke.

## Blockers to raise immediately

Supabase URLs/keys, Google/Microsoft OAuth, Graph app credentials/site/drive, Resend/verified sender,
official logo, actual source URLs via `INGESTION_SOURCE_URLS`, guest policy detail, Gemini key
mode/quota. Build the honest "Not configured" path; never substitute a mock or invent a source URL.

## Done

Contracts compile for all lanes; migrations + seed idempotent; owner changes role/person visibility
and the next request obeys it; SSO/demo/guest paths are real or visibly not configured; rejection note
enforced on every reject; employee has no compliance by default, manager team; PDF and source both
serve through the stored connection; emails observable; worker safe; two-tenant tests pass; full gate
green; deployed smoke with real evidence. No cross-lane file edits.

Next: hand off `contracts/v2` to both lanes, then build in the order above.