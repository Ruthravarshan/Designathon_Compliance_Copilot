# Website delivery gate — status record

> **Scope:** this record verifies the v1 local demo. PolicyPulse v2 (SSO, ingestion, storage, Gemini,
> DB RBAC, dark UI, deployment) is not yet built or deployed; re-verify every item after the lanes
> merge. Public-launch items remain blocked as listed.

> Source: `docs/WEBSITE-DELIVERY-CHECKLIST.md`. Updated at every phase boundary. An item is `Done`
> only with evidence below. This is a **demo build**, not a public launch.

## Gate state

- Profile: **Both** — public landing surface plus an authenticated, workspace-scoped product.
- Class: web app (Next.js), single region, demo data only.
- State: **In progress — demo verified locally; public-launch items blocked**.
- Last verified: 2026-11-27.
- Owner sign-off: **pending** (the operator must sign; an agent cannot mark this Passed).
- Blocking for a public launch (not for the demo): deployment not yet executed (Supabase/Vercel
  config is ready), no support/contact route, no privacy policy or terms, no cross-browser pass
  (Chromium only), no axe screen-reader scan.

## Section status

Counts are `Done + N/A` only where evidence exists; everything else is `Pending` or `Blocked`.

| Section | Applies | Items | Verified | Status | Notes |
| --- | --- | ---: | ---: | --- | --- |
| A1 Product clarity & content | Yes | 6 | 4 | Partial | Value prop, CTAs, nav, copy Done; favicon/social image and support route Blocked |
| A2 Core pages & trust | Yes | 7 | 4 | Partial | 404, error, about/product, copyright Done; contact, privacy, terms Blocked |
| A3 Forms, feedback & states | Yes | 5 | 5 | Done | Field errors, pending/success, empty/error/unauthorized; no destructive actions; outbox + idempotency |
| A4 Accessibility | Yes | 6 | 4 | Partial | Landmarks, focus, color+text, reduced motion Done; 200% zoom and axe scan Blocked |
| A5 Responsive & devices | Yes | 4 | 2 | Partial | Mobile + desktop Playwright Done; cross-browser and slow-network Blocked |
| A6 Performance & reliability | Yes | 5 | 2 | Partial | 404s Done; health/Pino Done; load timing, caching strategy, monitoring Blocked |
| A7 Security baseline | Yes | 6 | 5 | Done locally | Headers, session, validation, audit, dependency scan; HTTPS is deployment-blocked |
| A8 Privacy & data | Yes | 5 | 5 | Done | Inventory in phase 05; no analytics/trackers/third-party scripts; demo-only data |
| A9 SEO & discoverability | Yes | 4 | 2 | Partial | `noindex` intentional; title/description present; sitemap/OG/canonical Blocked |
| A10 Release & operations | Yes | 4 | 2 | Partial | Supabase/Vercel config prepared (`DEPLOYMENT.md`, `apps/web/vercel.json`, `DIRECT_URL`); actual deploy, DNS/HTTPS smoke, rollback run, and production sender verification Blocked |
| B1 Public trust | Conditional | 5 | 5 | N/A | No age-restricted/UGC/pricing/testimonials; no dark patterns |
| B2 Support & safety | Conditional | 4 | 2 | Partial | Rate limits Done; support channel, status page, deletion path Blocked/N/A |
| B3 Regional readiness | Conditional | 4 | 4 | N/A | Single-region India demo; en-GB UTC dates; no payments/currency |
| C1 Identity & governance | Yes | 4 | 2 | Partial | RBAC + session expiry/sign-out Done; SSO and deprovisioning N/A for demo |
| C2 Security evidence | Yes | 4 | 2 | Partial | Architecture + audit Done; pen test Blocked |
| C3 Enterprise operations | Yes | 4 | 1 | Partial | Tenant isolation Done; SLA/DPA/change policy Blocked |
| C4 Enterprise UX | Yes | 3 | 2 | Partial | No public indexing; safe, audited actions; supported browser matrix Blocked |
| D Conditional modules | Per brief | 9 | 3 | Partial | Auth (demo), notifications, multi-tenant Done; payments/upload/UGC/PWA N/A; AI is deterministic; legal-advice disclaimer Blocked |
| E Sign-off | Yes | 4 | 1 | Pending | Profile selected; remaining items depend on the blockers above and owner sign-off |

## Evidence ledger (selected)

| Item | Status | Evidence | Date |
| --- | --- | --- | --- |
| Landing value proposition and primary CTA | Done | `apps/web/src/app/page.tsx`; `e2e/smoke.spec.ts` passes | 2026-11-27 |
| Custom 404 and error pages | Done | `src/app/not-found.tsx`, `src/app/error.tsx`, `src/app/app/not-found.tsx` | 2026-11-27 |
| Forms validate and preserve field errors | Done | Zod routes; `review-form.tsx`; e2e approval path | 2026-11-27 |
| Empty/loading/error/unauthorized states | Done | `app/loading.tsx`, `error.tsx`, `not-found.tsx`, `UnauthorizedState` | 2026-11-27 |
| Duplicate submission guard | Done | 409 on re-review; outbox idempotency `finding-task:<id>` | 2026-11-27 |
| Auth/session safety | Done | HMAC cookie, httpOnly, SameSite=Lax, secure in prod, 8h; `session.test.ts` | 2026-11-27 |
| Server-side authorization and audit | Done | `requireActor`/`assertCan`; `AuditLog`; e2e 403 | 2026-11-27 |
| Input validation / injection basics | Done | Zod at every route; Prisma parameterized queries; React escaping | 2026-11-27 |
| Dependency scan | Done | `npm run security:audit` → found 0 vulnerabilities | 2026-11-27 |
| Responsive flows | Done | Playwright `mobile-chrome` project, 6 passing tests | 2026-11-27 |
| Reduced motion and focus | Done | `globals.css` `prefers-reduced-motion`, `:focus-visible` | 2026-11-27 |
| Tenant isolation | Done | `e2e/golden-path.spec.ts` Northwind empty workspace | 2026-11-27 |
| Supabase/Vercel deployment config | Done | `docs/DEPLOYMENT.md`, `docs/decisions/0002-supabase-vercel.md`, `apps/web/vercel.json` (cron), `DIRECT_URL` in Prisma, cron `GET`+`POST` | 2026-11-27 |
| Contact/support route | Blocked | No support page or channel in nav/footer | 2026-11-27 |
| Privacy policy / terms | Blocked | Demo-only data; no legal pages written | 2026-11-27 |
| Favicon / social preview image | Blocked | Not present in app metadata or assets | 2026-11-27 |
| Cross-browser pass (Safari/Firefox) | Blocked | Only Chromium and Pixel 7 emulation run | 2026-11-27 |
| axe / screen-reader scan | Blocked | No automated accessibility scan executed | 2026-11-27 |
| Deployed URL / HTTPS / DNS | Blocked | Local demo only; no deployment requested | 2026-11-27 |

## N/A justifications

- **B1 age gate** — no age-restricted content, UGC, or child-data flow.
- **B1 pricing/testimonials** — no pricing, reviews, or marketing claims on the surface.
- **B1 cookie consent** — no analytics, ad, or tracker scripts are installed.
- **B3 locale/geo** — single-region India demo, en-GB UTC dates, no currency or geo features.
- **C1 SSO/deprovisioning** — demo persona auth is flag-gated; production identity is out of scope.
- **C3 SLA/DPA** — no customer contract or production service in scope.
- **D payments/upload/UGC/PWA** — text paste only; no files, payments, or app shell.
- **D AI disclosure** — no model or third-party AI call exists in the demo path.

## Sign-off

- Profile confirmed: Both (demo; not a public launch).
- Gate: **In progress** — demo verified; public-launch items blocked and listed.
- Release version: `0.1.0-demo`
- Date: 2026-11-27
- Owner: ____________________ (operator signature required)
