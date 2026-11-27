# 08 — Hardening report

> Phase 08. What was checked, with the evidence that exists, and the residual mediums that are
> documented rather than hidden.

## Verified controls

| Area | Control | Evidence |
| ---- | ------- | -------- |
| Authorization | Every app page and API route resolves the actor server-side; review requires `finding:review` | `apps/web/src/server/auth/actor.ts`, `e2e/golden-path.spec.ts` 403 assertion |
| Tenancy | Every query filters `workspaceId`; unknown ids 404 | `apps/web/src/server/compliance/service.ts`, Northwind e2e test |
| Input validation | Zod at every route boundary; route params regex-checked | `apps/web/src/app/api/**/route.ts` |
| Errors | `AppError` + `fail(error, requestId)`; no stack or SQL leaked | `src/lib/http.ts`, `src/lib/errors.ts` |
| Session | HMAC-SHA256 signed cookie, httpOnly, SameSite=Lax, secure in prod, 8h | `src/server/auth/session.ts`, `src/lib/session.test.ts` |
| CSRF | Same-origin check on mutations; SameSite cookie | `src/server/rate-limits.ts` |
| Rate limits | Auth 10/min, review 20/min, Q&A 15/min, scan 10/min, ingest 5/5min | `src/lib/rate-limit.test.ts`, route handlers |
| Secrets | `.env` ignored; cron worker requires bearer `CRON_SECRET` with constant-time compare | `api/cron/email/route.ts` |
| Email safety | HTML-escaped variables, CRLF-stripped subjects, http(s)-only links, suppression and preference checks, idempotency | `src/server/email/render.ts`, `render.test.ts` |
| Audit | Access/status/data-ownership writes create `AuditLog`; review events are immutable and have no edit/delete UI | `src/server/audit.ts`, audit page |
| Headers | nosniff, frame DENY, referrer policy, permissions policy, COOP/CORP, CSP report-only, HSTS in prod | `apps/web/next.config.ts` |
| Logging | Pino redaction of auth headers, cookies, emails, and reset links | `src/lib/logger.ts` |
| Dependencies | Production audit clean | `npm run security:audit` → "found 0 vulnerabilities" |
| Coverage | 223 unit tests; 99.86% statements, 98.19% branches; every tested module ≥95% | `npm run test:coverage` |

## Data and privacy

- Demo data only: reserved `*.example` addresses, masked samples, no customer records.
- Data catalog stores masked samples, not raw PII.
- Audit metadata stores ids and references; recipient addresses and reset links are excluded.
- Retention: seeded corpus is disposable; `db:seed` reseeds the demo deterministically.

## Findings triage

| Severity | Finding | Status |
| -------- | ------- | ------ |
| High | None open | — |
| Critical | None open | — |
| Medium | Persona sign-in has no password by design; gated by `DEMO_MODE_ENABLED` and documented as non-production | Accepted for demo; must not ship |
| Medium | Rate limiter is in-process; counters reset on restart and do not coordinate across instances | Accepted; interface allows Redis |
| Medium | CSP is report-only and permits inline/eval to support the Next dev runtime | Accepted in demo; tighten before public launch |
| Medium | CSRF relies on same-origin + SameSite rather than a per-form token | Accepted for a cookie-auth demo with no cross-site forms |
| Low | Deterministic extraction recall is limited to typed patterns | Documented fallback to `manual_review` |
| Low | Source documents are representative excerpts, not full legal texts | Labelled illustrative; source URLs shown |

No high or critical finding remains. Mediums are documented with their blast radius and the condition
under which they must be fixed (production auth, multi-instance deploy, public launch).

## Accessibility pass

- Keyboard: skip link, native controls, visible focus ring, `aria-pressed` review options.
- Screen reader: one `h1` per page, landmarks, `sr-only` redline legend, labelled fields.
- Contrast: token pairs verified visually; brand on white and white on brand meet AA at body size.
- Motion: `prefers-reduced-motion` disables entrance transitions and smooth scroll.
- Responsive: mobile nav becomes a horizontal list; tables stack; Playwright mobile-chrome runs the
  non-stateful flows.

## Residual risk

The demo's integrity rests on the officer action and the audit row, not on model behaviour. The main
external risk is reviewer trust in deterministic rules; the UI mitigates it by showing the exact
quote, the mapping, the rule certainty, and an explicit manual-review fallback.

Next: `09-release-report.md`
