# Security / scalability / compliance audit — remediation record

> Date: 2026-11-28 · Scope: `apps/web` (API routes, server services, Prisma schema,
> auth/session, ingestion/watch, email, UI data boundaries). Read-only audits were
> run across three areas, then fixes were applied and verified. No new runtime
> dependency was added; the only new files are idempotent SQL migrations and this
> report. The pre-existing uncommitted UI work in `components/settings/*`,
> `components/shell/workbench-shell.tsx` and the landing page was left untouched.

## Verification evidence

| Gate | Command | Result |
| ---- | ------- | ------ |
| Lint | `npm run lint` | PASS, no findings |
| Types | `npm run typecheck` | PASS (strict, no `any`) |
| Unit | `npm run test` | 469 tests, 54 files, 0 failed/skipped |
| Coverage | `npm run test:coverage` | 99.88% stmts / 98.09% branches / 100% funcs / 99.88% lines; all tested modules ≥ 95% |
| Dependencies | `npm run security:audit` | 0 vulnerabilities at `high` |
| Build | `NEXT_DIST_DIR=.next-audit npm run build` | PASS; 41 routes; largest first-load JS 143 kB (< 250 kB target) |

The default `.next` build intermittently fails in this workspace with transient
`ENOENT` errors during page-data collection because more than one dev server
shares the checkout. An isolated `NEXT_DIST_DIR` builds cleanly; no source
change was required. `tsconfig.json` was restored after Next auto-edited it.

## Fixed — security

| ID | Severity | Fix | Evidence |
| -- | -------- | --- | -------- |
| F-01 | High | Demo personas can no longer mint an OWNER session in production. `DEMO_MODE` is ignored unless `ALLOW_DEMO_MODE_IN_PRODUCTION=true`; `signInWithPersona` re-checks defence-in-depth. | `src/lib/env.ts`, `src/server/auth/sign-in.ts`, `.env.example` |
| SSRF-1 | High | Watchdog fetch now resolves DNS once, rejects any private/loopback/link-local address, and connects to the **pinned IP** (TLS SNI keeps the original host). Re-pinned on every redirect; absolute timeout replaces socket-inactivity timeout. | `src/server/watch/fetch.ts` (`resolvePublicAddress`, `pinnedRequest`) |
| SSRF-2 | High | `/api/watch/ingest` requires a `sourceId`; the host allowlist is loaded from that workspace's `RegulatorySource` registry. The old self-referential `[parsed.hostname]` allowlist is gone. UI now selects a tracked source. | `src/app/api/watch/ingest/route.ts`, `src/server/watch/service.ts`, `src/components/watch/watch-controls.tsx`, `src/app/app/watch/page.tsx` |
| SSRF-3 | Medium | IPv6 private detection now strips brackets and blocks IPv4-compatible/NAT64/6to4/multicast forms; only global unicast `2000::/3` is public. Non-default ports are rejected. | `src/lib/watch/urls.ts`, `src/lib/watch/urls.test.ts` |
| AUTH-1 | Medium | Signed sessions now carry a `version` checked against `User.sessionVersion` on every request; sign-out increments it, so copied cookies stop working immediately. | `src/lib/session.ts`, `src/server/auth/{session,actor,sign-in}.ts`, `src/app/api/auth/signout/route.ts`, `prisma/sql/hardening-session-version.sql` |
| RL-1 | Medium | Rate-limit keys ignore client-supplied forwarding headers in production unless a trusted proxy/platform is configured; authenticated Gmail endpoints key by `actor.userId`. | `src/server/rate-limits.ts`, `src/app/api/integrations/gmail/{connect,disconnect,test}/route.ts` |
| RL-2 | Low | 429 responses now include `Retry-After` and `RateLimit-*` headers; all errors include `cache-control: no-store` and request id. | `src/lib/{errors,http}.ts`, `src/server/rate-limits.ts`, `src/lib/errors.test.ts` |
| EMAIL-1 | Medium | Product/marketing email resolves the recipient to a user by email when no `userId` was passed, so preference checks can no longer be bypassed via tenant-editable addresses. | `src/server/email/service.ts` |
| EMAIL-2 | Low | Gmail sender lookup no longer falls back to an arbitrary connected mailbox from another tenant; a `workspaceId` is mandatory. | `src/server/email/gmail.ts` |
| EMAIL-3 | Low | "Send test email" only accepts the signed-in user's own address — the connected mailbox cannot be used as an open relay. | `src/app/api/integrations/gmail/test/route.ts` |
| ERR-1 | Low | `/api/watch/run` uses `readJson`+Zod, so invalid JSON is a 400 `AppError`, not a masked 500. | `src/app/api/watch/run/route.ts` |
| OPS-1 | Low | SMTP delivery has a 15 s hard deadline; `/api/health` database probe has a 500 ms deadline and reports degraded instead of hanging. | `src/server/email/provider.ts`, `src/app/api/health/route.ts` |

## Fixed — scalability

| ID | Severity | Fix | Evidence |
| -- | -------- | --- | -------- |
| DB-1 | Medium | Added composite indexes for circular, finding, policy, data-scan, source and watch-run list filters/sorts. Idempotent SQL provided for existing databases. | `prisma/schema.prisma`, `prisma/sql/init.sql`, `prisma/sql/hardening-indexes.sql` |
| LIST-1 | High | `listDocuments` is now cursor-paginated, capped at 50, with `nextCursor`; nested per-document finding arrays replaced by one bounded `groupBy`. API accepts `?cursor=`; circulars page renders "Older circulars". | `src/server/compliance/service.ts`, `src/app/api/documents/route.ts`, `src/app/app/circulars/page.tsx` |
| DASH-1 | High | Dashboard counts and watch posture now use `groupBy` aggregates instead of loading the whole finding/scan tables into memory twice. New `postureFromCounts` preserves the existing scoring exactly (regression test added). | `src/server/compliance/service.ts`, `src/server/watch/service.ts`, `src/lib/watch/posture.ts`, `src/lib/watch/posture.test.ts` |

## Residual risks (accepted, with conditions)

| Risk | Why it is not fixed here | Condition to close |
| ---- | ------------------------ | ------------------ |
| CSP is report-only with `unsafe-inline`/`unsafe-eval` | An enforcing nonce-based policy needs per-request nonce plumbing across Next's dev runtime; changing it blind can break the demo. | Public launch — add nonce plumbing, verify console + deployed headers, then flip to enforcing. |
| Rate limiter is in-process and fail-open | Adding Redis would add a runtime dependency and a new failure mode; the demo runs one instance. | Multi-instance deployment — inject a Redis `RateLimitStore` and fail closed/degrade with alerting. |
| RBAC escalation guards (`assertCanAssignRole`, last-owner) are pure functions with no member-management endpoint | There is no role/ownership mutation surface in the product today, so no exploitable IDOR. Claims must not say these controls are wired. | When member management ships, wire the guards and audit every role change. |
| State-changing GETs (`/api/export/findings`, Gmail `status?check=1`) | Responses are not readable cross-origin; impact is an audit row/token refresh. Converting to POST needs UI changes. | Before public launch — convert to POST with `assertSameOrigin` + limiter. |
| Robots.txt not checked for watch listing crawls; ingestion timeout is socket-inactivity based | Both are hardening improvements on already-pinned/bounded fetches; changing crawl policy can break regulator sources. | Next hardening pass, with a per-origin robots cache and wall-clock deadline. |
| Remaining unbounded low-traffic lists (policies, data scans, revisions, sources) and per-clause ingestion creates | Bounded by workspace settings and demo data; not on the judge's hot path. | When a tenant exceeds ~200 rows — add cursors and `createMany` batching. |
| Full approve→audit deployed click-through, real email delivery, recording, deck | Operator artifacts, not build defects; see `09-release-report.md`. | Operator sign-off. |

## Deployment steps for an existing database

1. Apply `apps/web/prisma/sql/hardening-session-version.sql` (required before the
   new session code can read `User.sessionVersion`).
2. Apply `apps/web/prisma/sql/hardening-indexes.sql`.
3. Set `ALLOW_DEMO_MODE_IN_PRODUCTION=true` **only** if the deployment is a
   hosted judged demo; otherwise leave it unset so persona sign-in stays off.
4. Set `TRUST_PROXY_HEADERS=true` only behind a proxy that overwrites forwarding
   headers (Vercel is auto-detected).
5. Remove all pre-existing session cookies by signing out/in once; tokens minted
   before the version field was added are intentionally rejected.

## Gate

- [x] No high or critical finding from the three audits remains open.
- [x] Every fix keeps the golden path intact; no unused dependency was added.
- [x] Lint, typecheck, 469 tests, coverage gate, dependency audit and isolated build are green.
- [x] Residual mediums are documented with blast radius and a closing condition.
