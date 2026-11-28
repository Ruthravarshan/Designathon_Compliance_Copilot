# 06 — Visual direction (PolicyPulse v2)

> Phase 06. Supersedes the v1 direction. The product is **PolicyPulse**, a role-scoped compliance
> workspace. There is no marketing proof page and no illustrative product render: every surface is a
> real, data-backed screen. Reference assets are the live build plus the official Hexaware pack, which
> is still pending. No generated reference image was produced in this runtime; nothing synthetic was
> created to avoid inventing UI. `docs/DESIGN-SYSTEM.md` + `docs/BRAND.md` govern the visuals, stated
> in the gate.

## Design read

- **Audience:** an owner/administrator, a compliance manager, a department manager, an employee, a
  read-only auditor, and a gated guest — all inside one tenant. They read to answer "what changed,
  does it apply to me, what do I do next?"
- **Job of the interface:** make provenance and authority obvious, keep the login and identity
  presentation clean, and let the owner control access, providers, and visibility without reading
  code or SQL.
- **Register:** calm editorial operations. Evidence-first, dense but airy, one saturated accent.
  Confident, not decorative.
- **Rejected:** a public "proof" or hero page, fake screenshots, testimonial and metric walls,
  chatbot-first canvases, gradient text, glassmorphism, emoji status, five accent colors,
  dark-mode-only, and invented dashboards.

## Brand, logo, and theme

- **Logo:** ship the official Hexaware lockup once the owner supplies the pack, in blue, white, or
  black only. Until then use the **PolicyPulse wordmark** (Manrope 600, `brand` blue) with "by
  Hexaware" in `muted` at 0.8× size. Do not recolor the scaffold hexagon, do not invent a mark, and
  do not present the placeholder as official. Record the fallback in the build log.
- **One theme per page.** Both themes are designed; light is the default; dark is a persisted choice
  (cookie + `color-scheme`) with no first-paint flash. The PDF document area is third-party content,
  not a light section, and is labelled as the source document.
- **One accent per page.** Brand blue leads. Electric blue is reserved for live job indicators on
  dark; Honey/Canary only on dark, never body text; Error only for error and destructive states.

## Tokens (source of truth: `apps/web/src/app/globals.css`)

| Token         | Light     | Dark                              | Role                                  |
| ------------- | --------- | --------------------------------- | ------------------------------------- |
| `canvas`      | `#F8F8F9` | `#040D43`                         | Page field                            |
| `surface`     | `#FFFFFF` | `#07125E`                         | Cards, sheets, panels                 |
| `surface-2`   | `#EEEFF2` | `color-mix(#535983 18%, #040D43)` | Insets, table headers, skeletons      |
| `line`        | `#CBD0E5` | `#535983`                         | Hairlines and borders                 |
| `fg`          | `#040D43` | `#EEEFF2`                         | Primary text                          |
| `muted`       | `#535983` | `#8088A7`                         | Secondary text, metadata              |
| `brand`       | `#3C2CDA` | `#3C2CDA`                         | Primary action, links, focus, fills   |
| `brand-hover` | `#3224BD` | `#3224BD`                         | Hover and pressed                     |
| `brand-ink`   | `#FFFFFF` | `#FFFFFF`                         | Text and icons on brand fill          |
| `accent`      | —         | `#14CBDE`                         | Live job/queue state on dark only     |
| `danger`      | `#DA2D2C` | `#DA2D2C`                         | Error and destructive fills/icons     |

Rules: no component hard-codes a hex; tables use tokens only. On dark, small error copy uses `fg`
with a `danger` icon and the word "Error", never `danger` as small text (#DA2D2C is 3.5:1 on
`#07125E`). Status never relies on color: badge label + icon. Verified pairs: `brand-ink` on `brand`
8.1:1; `fg` on `surface` 18.4:1 light, 16:1 dark; `muted` on dark canvas 5.3:1; `accent` on dark
surface 8.4:1.

## Type and identity

- **Manrope** only (300/400/500/600, never 700+). **Geist Mono** for IDs, references, dates, counts,
  and tabular figures — the "evidence" voice.
- Scale: page title 28–32px/600 tight; section 18–20px/600; body 14–15px/1.6; table 13–14px;
  labels 11px mono uppercase `0.12em`; login name 18px/600 with role beneath at 12px `muted`.
- The signed-in person is presented once, cleanly: sidebar footer (avatar initials, full name, role
  badge) and a compact top-bar avatar menu on narrow screens. No duplicate name chips or greeting
  walls.

## Layout

- **Root `/` is a router, not a page:** authenticated → `/app`, otherwise → `/signin`. No landing,
  proof, or illustrative section exists.
- **Sign-in:** two panes at ≥ 900px — left brand field with wordmark and one factual sentence; right
  a 400px form sheet. SSO buttons first (Google, Microsoft, whichever is enabled in settings), then
  a divider, then a collapsed "Demo access" disclosure only when demo mode is on, then "Continue as
  guest" only when guest access is enabled. A visible `Demo` badge when demo mode is active. Mobile:
  single column, wordmark on top, form directly below.
- **App shell:** 64px top bar (wordmark, workspace switcher, theme toggle, avatar), 232px sidebar on
  `lg`, grouped nav — Overview · Policies (Circulars, Policy changes) · My work · Compliance ·
  Admin (Team & access, Ingestion sources, Storage, Email, Audit, Settings). Items render from the
  resolved permission set; no role-string conditionals in components.
- **Page header:** breadcrumb-free, one `h1`, a 1-line factual subtitle, at most one primary action
  on the right. No KPI card walls.
- **Circular detail:** evidence rail left (title, issuer, reference, dates, excerpts) and document
  panel right with a `PDF | Source` segmented toggle; the user chooses which to open. Embedded PDF
  at ≥ 1024px, "Open PDF" primary below that. Actions and decision history sit in the rail.
- **Ingest:** two explicit modes, `Upload PDF` and `From URL`, as a segmented control; dropzone or
  URL field, then a real progress stepper (fetch → store → extract → verify → publish) with live
  status. Result shows stored file link, source link, checksum, and any `Needs review` reason.
- **Lists:** find/filter above the table; sticky header; 44px rows; actions in a row menu; stacked
  cards under 1024px. Pagination is cursor-based with a "Load more" that states it.
- **Admin:** section tabs, not one mega-page. Each integration card shows a real state — Connected,
  Not configured, or Error with the provider message — and a Test action. No green check without a
  real check.

## Responsive

- Breakpoints: 320, 360, 390, 768, 1024, 1440. No horizontal page scroll at 320px.
- Sidebar becomes a drawer under `lg`; tables become cards under 1024px; login single column under
  900px; PDF embeds give way to a document link under 768px. Touch targets ≥ 44px.

## Motion and performance

- 150–200ms color/border/shadow transitions; skeletons instead of spinners for page data; one
  button spinner for mutations; job progress uses `accent` and `aria-live="polite"`.
- No entrance animation inside the app. `prefers-reduced-motion` removes transitions, smooth scroll,
  and progress shimmer.
- Budgets: LCP < 2.5s, INP < 200ms, CLS < 0.1, route JS < 250kB first load, API p95 < 500ms.
  Server components by default; PDF viewer, admin, and ingestion panels are route-level lazy; no
  chart or component library; prefetch visible nav only; polling backs off and stops on unmount.

## Accessibility

- 2px `brand` focus ring, 3px offset, on every interactive element; skip link to `#main`; landmarks;
  one `h1` per page; table captions; labelled inputs with inline error text + icon.
- Severity/status = text + icon + color; forms never rely on placeholder as label; dialogs trap focus
  and restore it; the theme toggle and PDF/source toggle are real buttons with `aria-pressed`.
- Target WCAG 2.2 AA; reduced motion, 200% zoom, and 390px are release checks.

## States inventory

| Surface          | Loading             | Empty                                   | Error                              | Unauthorized                            |
| ---------------- | ------------------- | --------------------------------------- | ---------------------------------- | --------------------------------------- |
| Sign-in          | provider skeleton   | "No sign-in method is enabled" + owner hint | inline provider error, retry   | guest disabled: note, no dead button    |
| Overview         | route skeleton      | role-specific: "No circulars yet."      | boundary with request id + retry   | redirect to `/signin`                   |
| Circulars        | skeleton rows       | "No circulars yet." + ingest CTA if allowed | boundary + retry               | list if permitted, no ingest action     |
| Ingest           | job stepper         | idle form                               | per-step reason; no partial success | 403 card: "You cannot add circulars."  |
| Circular detail  | skeleton rail       | n/a                                     | 404 "not in this workspace"; missing file shows source only | read-only, actions hidden, note shown |
| Policy changes   | skeleton            | "No published changes yet."             | boundary                           | visible only with permission            |
| My work          | skeleton            | "Nothing assigned to you."              | boundary                           | redirect to `/signin`                   |
| Compliance       | skeleton            | "No findings yet."                      | boundary                           | 403 card with role explanation          |
| Team & access    | skeleton            | "No members yet." + invite              | boundary                           | 403 card, audit event written           |
| Integrations     | card skeleton       | "Not configured" with setup CTA         | "Error" + provider message, retry  | owner/admin only                         |
| Audit            | skeleton            | "No audit events yet."                  | boundary                           | "The audit trail is restricted."        |
| Settings         | skeleton            | defaults with explicit unset values     | boundary                           | owner only                              |

## Content and no-mock rules

- No invented person, issuer, number, date, count, testimonial, logo, or screenshot. Demo seed data is
  allowed only behind `DEMO_MODE`, marked by a persistent `Demo` badge, and never mixed with real
  tenant rows. Empty is designed; empty is honest.
- Policy content comes from **actual public sources** or an upload. Actual source URLs enter only via
  `INGESTION_SOURCE_URLS` (owner-supplied) and the DB source registry; never hardcode or invent one.
  The v1 representative excerpts are not shown as fetched v2 evidence.
- Quotes shown in the UI must exist verbatim in the stored document; a missing file shows the source
  link, not a fabricated preview. An integration without credentials says "Not configured".

## Reference assets and fallback

No reference image was generated. `docs/discovery/assets/` stays empty until the owner supplies the
official logo; the wordmark fallback above applies. Screenshots are captured from the running build
after the routes exist, never mocked. `DESIGN-SYSTEM.md` + `BRAND.md` govern; no synthetic product UI
was generated because it would violate the real-pages rule.

## Gate

- [x] Design read names audience, job, tone, and rejected patterns.
- [x] Light and dark tokens match `BRAND.md`; no invented values.
- [x] Login, identity placement, SSO/demo/guest, and admin control surfaces specified.
- [x] Real pages only; no proof surface; no mock content rule recorded.
- [x] Responsive, motion, performance, and accessibility budgets set.
- [x] Every data surface has loading/empty/error/unauthorized states.
- [x] Logo fallback and reference-image fallback stated.

Next: `07-build-log.md` (build may begin: 05 + 06 exist)