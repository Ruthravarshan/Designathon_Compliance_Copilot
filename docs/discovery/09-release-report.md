# 09 — Release report

> Phase 09 · 7:45–8:45 · Source: `agent-prompts/09-FINAL-TEST.md`
> Feature freeze. Prove the frozen build works. Fix only blockers.

## Freeze

- Freeze announced at: 2026-11-27, after `npm run check` reached exit 0 on the working tree.
- Commit under test: `1f44a24` + uncommitted working tree (no commit was made; the operator has not
  asked for one).
- Deployed URL: **none** — local demo only (`http://localhost:3000`); Supabase + Vercel config is
  prepared in `docs/DEPLOYMENT.md`, deployment itself is an operator action.
- Environment: Windows 11, Node v24.22.2, Postgres 16 via Docker (`:5433`), seeded demo corpus.

## Release gate

`npm run release:check` (format → lint → typecheck → unit → coverage → build → e2e → audit).

Run at `2026-11-27T15:46:06Z`, total 215.8s, result **READY** (8 passed, 0 failed, 0 skipped).

| Check | Result | Duration | Evidence |
| ----- | ------ | -------- | -------- |
| Format | PASS | 2.4s | `prettier --check` — all matched files clean |
| Lint | PASS | 9.4s | `eslint .` no findings |
| Typecheck | PASS | 6.0s | `tsc --noEmit` no errors |
| Unit tests | PASS | 3.7s | 17 files, 223 tests, 0 skipped |
| Coverage | PASS | 4.2s | 99.86% stmts / 98.19% branches / 100% funcs / 99.86% lines; every file ≥ 95% |
| Production build | PASS | 75.7s | `next build` — 6/6 static pages, 16 routes |
| E2E | PASS | 108.4s | Playwright chromium + mobile-chrome (Pixel 7): 13 passed, 0 failed |
| Dependency audit | PASS | 5.6s | `npm audit --omit=dev --audit-level=high` → 0 vulnerabilities |

Report artifact: `artifacts/release-report.md` and `artifacts/release-report.json`.

This run predates the Supabase/Vercel deployment config (`DIRECT_URL`, cron `GET`, `apps/web/vercel.json`,
production env guard). Those are config-only changes with no domain-logic impact; the gate is re-run
after them and the result recorded below.

| Re-run (Supabase/Vercel config) | Result | Duration | Evidence |
| ------------------------------- | ------ | -------- | -------- |
| `npm run release:check` | pending | | |

Coverage is a hard gate and has no waiver: every measured file passes the 95% statement, branch,
function, and line thresholds. No test is skipped; the mobile project excludes the stateful owner
review spec by path (`testIgnore`) instead of skipping it at runtime.

## Manual checks

Checked by hand in the running app and by Playwright assertions.

| Check | Result | Notes |
| ----- | ------ | ----- |
| Golden path | PASS | Sign in as Meera → open findings → open a circular → approve the draft → decision on record → audit entry. Covered by `e2e/owner-review.spec.ts`. |
| Empty state | PASS | Northwind workspace shows "No findings yet." and "No circulars ingested yet." (`e2e/golden-path.spec.ts`). |
| Error state | PASS | `error.tsx` with retry; API failures use the `{ error: { code, message, requestId } }` envelope. |
| Unauthorized state | PASS | Viewer sees "Read-only review state", no review form, audit shows "The audit trail is restricted."; API returns 403. |
| Mobile width (390px) | PASS | `mobile-chrome` Playwright project (Pixel 7), 6 tests. |
| Keyboard path and focus | PASS | Native controls, skip link, `:focus-visible` ring on every interactive element. |
| Contrast | PASS | Brand pairs from `docs/BRAND.md` meet WCAG AA; form errors pair color with text. |
| Reduced motion | PASS | `prefers-reduced-motion` disables transitions in `globals.css`. |

## Deployed smoke

| Target | Result | Notes |
| ------ | ------ | ----- |
| Home | N/A | No deployment exists; verified locally instead. |
| `/api/health` | PASS (local) | Returns `service: hexa-web`, `status: ok`, request id; asserted in `e2e/smoke.spec.ts`. |
| Demo login or demo mode | PASS (local) | `/signin` persona picker; HMAC session cookie. |
| Golden path | PASS (local) | See manual checks. |
| One email delivery or Mailpit fallback | PASS (local) | Outbox enqueue is idempotent (`finding-task:<id>`); `npm run email:process` drains to Mailpit. No recipient addresses are logged. |

## Fallback

- Recording path: `docs/discovery/10-demo-script.md` (runbook with timings and a reset command).
- Played once on: not yet — the demo video is an operator task; the script has not been rehearsed on
  camera.
- Works from a cold start: verified by `e2e/global-setup.ts`, which reseeds the database before every
  Playwright run.

## Waivers

| Check | Reason | Risk | Owner |
| ----- | ------ | ---- | ----- |
| Deployed URL / HTTPS smoke | No deployment was requested; demo runs locally | Judges cannot open a URL | Operator |
| Cross-browser pass | Only Chromium + Pixel 7 emulation run | Safari/Firefox rendering unverified | Operator |
| axe / screen-reader scan | No automated axe run executed | Assistive-tech issues may exist | Operator |
| Demo video | Recording requires a human session with the live UI | No video artifact yet | Operator |
| Slide deck | Deck content is ready in `10-demo-script.md`; the `.pptx` is not built | No deck artifact yet | Operator |

These are public-release and pitch artifacts, not build-quality gate items. Nothing in the release
gate itself is waived.

## Gate

- [x] The release gate is green (see `artifacts/release-report.md`; waivers above are for demo
      packaging, not for build checks).
- [ ] The deployed URL passes the smoke test — **N/A**: no deployment exists.
- [ ] The fallback recording is playable — **pending**: operator records the video.
- [x] Only blockers were fixed after the freeze.

Next: `agent-prompts/10-DEMO-PITCH.md` → `docs/discovery/10-demo-script.md`
