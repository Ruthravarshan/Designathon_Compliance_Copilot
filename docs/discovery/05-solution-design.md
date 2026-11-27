# 05 — Solution design

> Phase 05. The architecture as built in `apps/web`; ADR-worthy choices are listed with the reason
> they were taken inside the 10-hour budget.

## System diagram

```text
Browser (React 19 server components + client forms)
  → Next.js 15 App Router
    ├── Server pages  → getActor() → requireActor/actorCan → compliance service → Prisma → Postgres
    └── Route handlers → same-origin check → Zod readJson → requireActor(permission)
                      → rate limit → compliance service → { data } | fail(error, requestId)
  → Outbox (EmailMessage) → /api/cron/email worker → SMTP / Mailpit
  → Pino logs with request id; /api/health checks DB

Deterministic engine (no network): parse → extract → verify → map → gap → redline → confidence
```

Redis is available in the scaffold but the demo uses an in-process limiter; the limiter type is
abstracted so a Redis-backed store can replace it without touching routes.

## Stack decisions

| Decision | Choice | Alternative rejected | Why |
| -------- | ------ | -------------------- | --- |
| Framework | Next.js 15 App Router | Separate SPA + API | One deployable, server-rendered RBAC and states |
| Extraction | Deterministic rules + number words | LLM structured output | Offline demo, reproducible tests, exact citations |
| Mapping | Tag/term/attribute scoring | Vector + BM25 | 14 records; explainable and unit-testable |
| Auth | HMAC-signed demo session | Production SSO/passwords | Persona switching is the demo; flag-gated |
| Tenancy | `workspaceId` on every tenant table | Schema-per-tenant | Simple isolation with testable 404s |
| Email | Transactional outbox | Inline send | Durable, retryable, never inside a review transaction |
| Rate limit | In-memory fixed window | Redis token bucket | Zero extra service for the demo; interface ready |
| Styling | Tailwind 4 tokens from `globals.css` | Ad-hoc hex | Brand contract; one source of truth |
| Hosting | Supabase Postgres + Vercel | Docker-only local demo | Judged demo needs a URL; pooler + direct URLs, Vercel Cron |
| Identity provider | Demo HMAC cookie | Supabase Auth | Auth is flag-gated for the demo; RBAC is server-side either way |

No ADR was required for scaffold-reused choices; the deterministic engine and demo auth are recorded
here and in phase 04. Supabase/Vercel is recorded in
[ADR 0002](../decisions/0002-supabase-vercel.md).

## Data model (Prisma)

| Entity | Key fields | Tenant-owned | Indexes / delete |
| ------ | ---------- | ------------ | ---------------- |
| User | email, name | no | unique email |
| Workspace | slug, name | root | unique slug |
| Membership | userId, workspaceId, role | yes | unique (userId, workspaceId); cascade |
| RegulatoryDocument | regulator, reference, checksum, status | yes | unique (workspaceId, reference) |
| DocumentClause | documentId, pageNumber, sectionLabel, text | yes | (workspaceId, documentId, orderIndex) |
| InternalPolicy / InternalControl | code, title, attributes JSON | yes | unique (workspaceId, code) |
| Obligation | requirement JSON, quote-derived plain language, SLA, citationVerified | yes | cascade from clause |
| Finding | severity, gap, dueDate, redlineBefore/After, reviewStatus, task fields | yes | (workspaceId, reviewStatus, severity), (workspaceId, dueDate) |
| ReviewEvent | action, actor, previous/updated JSON, comments | yes | cascade from finding |
| DataFieldScan | dataset, field, category, riskLevel, citation | yes | unique (workspaceId, dataset, field) |
| AuditLog | action, entity, entityId, metadata | yes | (workspaceId, createdAt) |
| EmailMessage / Preference / Suppression | outbox state, idempotency key | optional | unique idempotency key |

## API contract

| Method | Route | Auth | Permission | Notes |
| ------ | ----- | ---- | ---------- | ----- |
| POST | `/api/auth/signin` | none | demo flag | Persona key → signed cookie + audit row; rate limited |
| POST | `/api/auth/signout` | session | — | Clears cookie; audited |
| GET | `/api/documents` | session | `document:read` | Tenant-scoped list |
| POST | `/api/documents` | session | `document:ingest` | Zod body; duplicate reference 409; runs full pipeline in one transaction |
| POST | `/api/findings/:id/review` | session | `finding:review` | Approve / edit / reject; 409 if not pending; queues outbox email |
| POST | `/api/assistant/ask` | session | `assistant:ask` | Grounded Q&A over policies, controls, clauses |
| GET / POST | `/api/data-scan` | session | `document:read` / `data:scan` | List scans / create scan |
| POST | `/api/cron/email` | token | worker | Drains the outbox |
| GET | `/api/health` | none | — | DB check, service id, request id |

Success envelope `{ data }`; failures `{ error: { code, message, requestId, details? } }`. All bodies
are Zod-parsed at the boundary. Idempotency: outbox key `finding-task:<findingId>`.

## RBAC

| Permission | OWNER | ADMIN | MEMBER | VIEWER |
| ---------- | :---: | :---: | :----: | :----: |
| workspace:read | ✓ | ✓ | ✓ | ✓ |
| workspace:update | ✓ | ✓ | — | — |
| workspace:delete | ✓ | — | — | — |
| member management | ✓ | ✓ | — | — |
| document:read | ✓ | ✓ | ✓ | ✓ |
| document:ingest | ✓ | ✓ | — | — |
| finding:read | ✓ | ✓ | ✓ | ✓ |
| finding:review | ✓ | ✓ | — | — |
| assistant:ask | ✓ | ✓ | ✓ | — |
| data:scan | ✓ | ✓ | — | — |
| audit:read | ✓ | ✓ | — | — |

Role is re-read from `Membership` on every request; client input never carries a role or workspaceId.

## Email

| Event | Recipient | Trigger | Preference |
| ----- | --------- | ------- | ---------- |
| `finding.remediation_task` | Finding's task owner email | Approval (non-fatal if enqueue fails) | Product category |
| `welcome` | Seeded owner | Seed | Product |
| Invitation / role change / removal / reset | Scaffold members | Scaffold flows | Transactional |

Variables are escaped, subjects strip CRLF, links must be http(s), suppression and preferences are
checked, and every message carries an idempotency key.

## Failure modes

| Failure | Impact | Detection | Behavior |
| ------- | ------ | --------- | -------- |
| Postgres down | All pages fail | Health endpoint, Pino error | 503 with request id; error boundary |
| Extraction finds nothing | Empty analysis | Clause count check | 400 "no citable clauses", no partial write |
| Email enqueue fails | No owner notification | Logged error | Review still commits; outbox retry is safe |
| Duplicate review | Conflicting decisions | Status check in transaction | 409, no second event or email |
| Rate limit store restarts | Counters reset | — | Acceptable for demo; interface allows Redis |
| Cross-tenant id | Data leak | Query filters | 404, no existence disclosure |

## Observability

- Pino JSON logs with `requestId`, redacted headers and PII; `x-request-id` returned to the client.
- `/api/health` reports service, status, database, and request id.
- Audit actions: `auth.signed_in`, `auth.signed_out`, `document.ingested`, `finding.reviewed`,
  `data.scanned`, `workspace.seeded`.

## Test strategy

| Layer | Protects | Evidence |
| ----- | -------- | -------- |
| Unit (Vitest) | extraction, verification, mapping, gap, redline, Q&A, data scan, RBAC, email rendering, rate limiting, load balancing, session signing | `npm run test:coverage` |
| E2E (Playwright) | sign-in, golden path approval, audit row, 403, tenant isolation, landing and health | `e2e/*.spec.ts`, seeded by `e2e/global-setup.ts` |
| Manual | keyboard, contrast, reduced motion, empty/error states, mobile layout | phase 08/09 notes |

## Vertical slices

| # | Slice | Done when |
| - | ----- | --------- |
| 1 | Corpus + engine | 13 seeded findings, unit tests green |
| 2 | Auth + tenancy | Persona session, second workspace isolation |
| 3 | Read surfaces | Dashboard, circulars, findings, detail with citations |
| 4 | Write path | Ingest, ingest API, duplicate and validation guards |
| 5 | Review + email | Transactional review, audit row, outbox email |
| 6 | Secondary flows | Policy Q&A, data scan, audit trail |
| 7 | E2E + docs | Golden path green, artifacts filled |

## Risks

| Risk | Impact | Mitigation |
| ---- | ------ | ---------- |
| Deterministic extraction misses phrasing | Lower recall | Typed fallback to manual review; tests for each rule |
| Demo auth mistaken for production auth | Security concern | Flag-gated, documented non-goal, HMAC cookie |
| Source excerpts not verbatim law | Credibility | Labelled illustrative; source URLs; no legal advice claim |
| Dev-server compile latency in e2e | Flaky timing | Raised timeouts, seed reset, 2 workers |

Gate: requirements map to routes and services; edge cases designed; tenant tables indexed; RBAC and
outbox explicit. Next: `06-visual-direction.md`
