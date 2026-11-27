# Antigravity lane — complete PolicyPulse UI specification

> You own every human-facing surface: root router, sign-in, app shell, all pages, admin, settings,
> dark mode, responsive behavior, component tests, and UI e2e specs. Read [README](README.md),
> [05](../discovery/05-solution-design.md), [06](../discovery/06-visual-direction.md), and
> [BRAND.md](../BRAND.md). You do **not** edit `prisma/**`, `src/server/**`, `src/app/api/**`,
> `src/middleware.ts`, `src/lib/contracts/**`, package files, or `playwright.config.ts`/
> `e2e/global-setup.ts`. You build only against the frozen contracts and real APIs. No mock data.

## Design bar

- Audience: owner, admin, compliance manager, department manager, employee, auditor, guest in one
  tenant. The interface answers "what changed, does it apply to me, what do I do?" — not a marketing
  pitch.
- Register: calm editorial operations; evidence-first; dense but airy; one accent (Hexaware blue);
  Manrope only; Geist Mono for IDs, dates, counts. Confident, specific, no hype.
- No proof/landing page, no fake screenshot or metric, no invented logo, no testimonial, no lorem,
  no dead button, no placeholder link. Empty states are designed and honest.
- Brand: official Hexaware lockup when the owner supplies it; until then `BrandLockup` renders the
  **PolicyPulse** wordmark (Manrope 600, brand blue) with "by Hexaware" in muted. Never recolor the
  scaffold hexagon or call it the logo.
- Every value visible to a user comes from `ActorContext`, settings, or an API response — never a
  hardcoded role name, option list, issuer, count, or color outside tokens.

## App map (real routes; replace v1 pages, no dead links)

| Route | Page | Permission |
| --- | --- | --- |
| `/` | Server router: actor → `/app`, else `/signin` | none |
| `/signin` | SSO + gated demo + gated guest | public |
| `/app` | Overview, role- and scope-aware | session |
| `/app/circulars` | Circular register | `circular:read` |
| `/app/circulars/ingest` | Upload PDF or URL, live run | `circular:ingest` |
| `/app/circulars/[id]` | Evidence, citations, findings, changes, activity | `circular:read` + scope |
| `/app/policies` | Policy changes list | `policy:read` + scope |
| `/app/policies/[id]` | Change detail, before/after, citation, publish | `policy:read` |
| `/app/assignments` | My work (ack/reject) | `assignment:read` |
| `/app/assignments/[id]` | Assignment detail + decision | `assignment:read` |
| `/app/compliance` | Compliance register | `compliance:view_*` |
| `/app/compliance/[id]` | Finding + review | `finding:read` (+ `finding:review`) |
| `/app/notifications` | In-app inbox | session |
| `/app/settings` | Personal profile, theme, email preferences | session |
| `/app/audit` | Audit trail | `audit:read` + scope |
| `/app/admin/team` | Members, guests, invites | `member:manage` |
| `/app/admin/team/[userId]` | Member role, department, overrides, revoke | `member:manage` |
| `/app/admin/roles` | Role × capability matrix | `role:manage` |
| `/app/admin/departments` | Departments + managers | `member:manage` |
| `/app/admin/ingestion` | Sources, schedules, runs, test/run now | `source:manage` |
| `/app/admin/connections` | Storage, AI, email configuration cards | `storage:manage`/`settings:manage` |
| `/app/admin/settings` | Branding, identity, SSO, demo, guest, defaults | `settings:manage` |

Unauthorized direct URL: render a 403 card with the reason and a safe next action; do not redirect
silently except on no session. No permission → no nav item, no CTA, no fetch.

## Frozen UI contracts

- `GET /api/v1/me` → `{ actor, permissions, scope, workspace, settings, theme }`. `actor` includes
  user `{id,name,email|null,avatarUrl,isDemo,isGuest,title}`, membership `{role,department,status}`,
  workspace `{id,name,slug,appName,logoUrl,isDemo}`. Navigation and affordances derive from
  `permissions`, never `role === "…"`.
- `GET /api/public/branding` → `{ appName, logoUrl?, theme, supportEmail?, providers:{google,microsoft},
  demo:{enabled, personas[]}, guest:{enabled, href?} }`. Personas are seeded DB rows; no emails.
  Without a configured provider, do not render its button. Without demo enabled, do not render the
  demo disclosure. Without guest enabled, do not render guest access.
- All mutations: same-origin `fetch` to `/api/v1/*` with JSON, parse `{ data }` / `{ error }`; show
  inline error + `requestId` (mono, small). Buttons have pending/success/failure; no optimistic state
  that the server can reject without rollback.
- Theme: cookie `pp_theme` (`light|dark|system`) + `color-scheme`; read server-side in root layout,
  set `data-theme`/`class` on `<html>`, inline pre-paint script only if needed; default from
  `settings.defaultTheme`. No DB round-trip for the toggle. One theme per page.
- Personal preferences: `GET/PATCH /api/v1/me/preferences` for email categories; profile fields
  read-only except display name/title if the API allows. Never invent an editable field the API lacks.

## Design tokens and type

Copy the light and dark tokens from [06 §Tokens](../discovery/06-visual-direction.md#tokens-source-of-truth-appswebsrcappglobalscss)
into `globals.css` as `:root` + `[data-theme="dark"]`; expose them through `@theme` so classes like
`bg-canvas`, `text-muted`, `border-line`, and `bg-brand` work. Add `--color-accent` only for dark live
states. Remove `grid-field` from product surfaces (it reads as a marketing texture); keep it out of
the app. Never hard-code a hex in a component. On dark, small error copy is `fg` + danger icon + the
word "Error"; `#DA2D2C` is not body text on dark.

Scale: page title 28/32px 600 tight; section 18/20px 600; body 14–15px/1.6; table 13–14px; labels
11px mono uppercase 0.12em; h1 max two lines. Buttons: 40px default, 44px on touch; radius full for
primary, 12px for inputs, 16px for cards. One card elevation, no glows. Illustrations: none.

## Shell and identity

- **Top bar (64px):** brand lockup left; workspace name + slug (from actor) next; right: `Demo` badge
  when `workspace.isDemo`, notification bell with unread count, theme toggle (sun/moon, `aria-pressed`
  or labelled menu), avatar menu. Avatar menu: full name, role + department, "Personal settings",
  "Sign out". No duplicated name in the page header.
- **Sidebar (232px, `lg+`):** workspace switcher only if `/me` returns multiple memberships (otherwise
  static workspace label); grouped nav: Overview · Policies (Circulars, Policy changes) · My work ·
  Compliance (only with compliance permission) · Admin (Team, Roles, Departments, Ingestion,
  Connections, Settings — each by permission) · Audit. Footer: avatar initials, full name, role badge,
  "Personal settings". Active item: brand fill, white text, no index numbers.
- **Mobile (<1024):** top bar + menu button; drawer with the same nav and identity footer; closes on
  navigation, traps focus, Escape closes. Tables become cards. No horizontal page scroll at 320px.
- Signed-in person appears once: top bar avatar/name (≥md) and sidebar footer. The page `h1` is the
  page name, not a greeting.
- `Demo` badge in shell and a one-line note in personal settings; guest shows `Guest · sample access`
  and a "Request access" link to `supportEmail` when present.

## Page blueprints

### `/signin`

Two panes ≥900px: left 46% brand field (surface, lockup, one sentence: "Regulatory change, reviewed
and on record.", support line only if real); right 54% max-440px form, vertically centred. Mobile:
single column, lockup then form. No "back to product" link (there is no proof page), no marketing
cards, no fake security badges.

Order: error banner (role=alert) → SSO buttons (Google/Microsoft from branding, official marks only
if assets exist, otherwise text + arrow) → divider "or" → demo disclosure (only when enabled) →
guest link (only when enabled) → footer line "Access is controlled by your workspace owner." and
support email if set. SSO pending disables all; error is inline with a retry. Demo disclosure expands
to sorted persona rows (name, role, title, workspace; no email), each a real button hitting
`POST /api/auth/demo`; pending row spinner; failure text; demo label visible. Guest link goes to the
Qoder-provided href; if no href, show disabled explanation, never a dead button. If no method is
enabled, show "No sign-in method is enabled" + support email.

### `/app` Overview

Header: `h1 Overview`, one factual subtitle including workspace name and the resolved scope. Primary
action only if `circular:ingest`: "Add circular". Four compact real stats max (Circulars, Policy
changes published, Awaiting your action, Overdue assignments) from `/api/v1/...`; no charts. Then a
2/3 + 1/3 grid: "Latest policy changes" (title, change type, effective date, severity/status, link)
and "Your work" (assignment rows, due, status, ack/reject affordance). Owner/admin also get "Recent
ingestion" with real run status; employee sees assigned-only content; manager sees team scope label;
auditor sees read-only badge; guest sees sample-scope note. Empty states per section with a next
action that permission allows.

### `/app/circulars`

Header + `Add circular` (permission). Filter bar: search (reference/title), issuer (DB list), status
(DB enum), date range; reset. Table columns: reference/title, issuer, published/effective, status,
files (PDF/source indicators), your action. Rows 44px, row menu; link to detail. Under 1024: cards
with the same fields. Cursor "Load more" with real count. Empty: "No circulars yet." + ingest CTA if
allowed; unauthorized read: 403 card. No fake row skeletons after load.

### `/app/circulars/ingest`

Header `Add a circular`, back link. Segmented `Upload PDF` / `From URL`. Upload: labelled dropzone
(PDF only, max size from settings; drag/keyboard), file name/size, optional source selector (DB), then
"Queue ingestion". URL: URL input + helper "Direct PDF or a listing page; the ingestion source
allowlist applies", optional source. Validation inline. Submit → 202 → replace form with a run panel:
five steps Fetch · Store · Extract · Verify · Publish, each real status from
`GET /api/v1/ingestion/runs/:id` (poll with backoff, stop when terminal), timings, safe error code,
duplicate → "Already ingested" + link, failure → retry if permitted. Result shows PDF link, source
link, checksum (mono), "Needs review" reason if any; "Circular received email queued" only if the API
returns that truth. Unauthorized: 403 card, no form.

### `/app/circulars/[id]`

Header: title, issuer/reference/date/status badges; actions from permissions (review, assign,
acknowledge; no button without API). Two columns ≥1024: evidence rail 360px (source, published/
effective dates, AI status + model, checksum, policy changes, assignments, activity) and document
panel. Document panel uses a segmented `PDF | Source` control; PDF is an `<iframe>` to
`/api/v1/files/:id` (lazy, title, loading/error fallback with "Open PDF"), source opens the original
URL in a new tab with `rel="noopener noreferrer"`; if one is missing, it is disabled with a reason.
The user chooses; never auto-fake a PDF. Below: tabs Evidence · Obligations · Findings · Policy
changes · Activity. Quote blocks show exact text + page + "Open PDF"; missing verification shows
`Needs review`, not an invented citation. Rejection (finding or assignment) opens a dialog with a
required note (min 10, max 2000, counter), reason list from API, pending/success/failure.

### `/app/policies` and `/app/policies/[id]`

List: policy, change type, from→to version, effective date, audience/departments, status, citation;
filter by status/department/date. "New since your last visit" marker from real `lastSeenAt`.
Detail: summary, before/after diff (red/green with text labels, not color only), circular citation
(PDF + source), affected departments, approver, publish action only with `policy:publish`; publish
confirm states it notifies permitted roles and writes audit. Empty: "No published changes yet."

### `/app/assignments` and `[id]`

List: title, entity, due, status, assigned by; filters Open/Overdue/Done; manager sees team scope,
employee own. Detail: what to read (PDF/source), required action, history; Acknowledge (confirm,
pending, success) and Reject (dialog, note mandatory, min/max, reason; 422 handled inline). Reassign
only with `assignment:manage`; emails are stated as queued, never shown recipients. Empty: "Nothing
assigned to you." Auditor/guest: read-only or 403 per permission.

### `/app/compliance` and `[id]`

Visible only with `compliance:view_all|team`; **EMPLOYEE has no compliance by default** (owner may
grant an override). Header states scope: "All departments" / "Your team" / "Read-only oversight".
Table: finding, severity, policy/circular, owner, due, review status, updated. Filters. Detail:
evidence/quote, gap, remediation, redline, review history; review approve/reject only with
`finding:review`; reject note mandatory. No compliance nav or data for employee/guest. Read-only
banner for auditor. 403 card for direct URLs.

### `/app/notifications` (and bell panel)

Bell: unread count (real), panel latest 5, "View all"; page list with type icon, title, body, time,
read/unread, link, "Mark all read" (pending/error). Empty: "No notifications yet." No fake items.

### `/app/settings`

Sections: Profile (avatar initials, name, email, role, department; edit only API-supported fields);
Appearance (System/Light/Dark radio cards, immediate, persisted cookie); Email (product categories
from `/me/preferences`; transactional always-on note; pending/success; suppression notice if API
returns it); Session (sign out; "Signed in with Google/demo/guest" from actor). No password UI for
SSO users. Basic, one column 640px.

### `/app/audit`

Table: time, actor, action, entity, entity id, request ID (mono, copy), scope badge. Filters by
action/entity/date; cursor. No metadata secrets. Empty: "No audit events yet." Unauthorized card.

### Admin

Shared: `h1`, section tabs/side nav, one primary save per section, unsaved-changes guard, audit note.
All reads/writes go through admin APIs; every save shows pending, success, and safe error with
requestId. Destructive actions use a confirm dialog that names the target and consequence.

- **Team:** invite (email, role from API, department), search/filter status/role; table name, email,
  role, department, status, last seen; guest filter and `Guest` badge. Member detail: role select,
  department, status, guest expiry/revoke, per-user permission overrides (Allow/Deny/Inherit per
  capability, grouped, search), last-owner guard message, remove member. Admin cannot offer role
  options the API would reject.
- **Roles:** grid of capabilities (rows, grouped Read/Review/Manage/Admin) × roles (columns), sticky
  header/first column; checkboxes disabled for OWNER (always all) and owner-only capabilities; scope
  selectors for compliance (None/Team/All); save + discard; "Reset to defaults" confirm. Show the
  resolved default for reference only from API.
- **Departments:** list name, manager, member count, created; create/edit drawer; cannot delete a
  department with members without reassignment; manager select from members.
- **Ingestion:** sources table (name, issuer, listing URL, schedule, enabled, last run/status); add/
  edit; "Test source" (real fetch result, no fake success), "Run now" (202 + link to run), run history
  with safe errors and timings; empty "No sources yet." Sources feed the ingest page selector.
- **Connections:** Storage card per provider (SharePoint, Supabase Storage, Google Drive): status
  Connected/Not configured/Error, non-secret fields (site/drive/folder/bucket), "Test connection",
  "Set default"; secrets shown only as "Configured in environment" with the env name. AI: enabled,
  model selector from API allowlist, prompt version, key configured, "Run test" (safe result, no prompt
  echo). Email: provider, from, reply-to, suppression count, "Queue test email". No green state
  without a real test; no credential input fields (secrets are env).
- **Settings:** Branding (app name, logo URL, support email, default theme — logo must be the official
  asset URL); Identity (Google/Microsoft toggles, allowed domains chips, auto-provision role, pending
  approval, demo login, guest access + expiry); Ingestion defaults (schedule, max docs); Save with
  audit. Danger zone only for actions the API supports.

## Component inventory (build these, no giant abstraction)

`BrandLockup`, `ThemeToggle`, `ThemeScript`, `Avatar`, `UserMenu`, `SidebarNav`, `MobileNav`,
`WorkspaceLabel`, `NotificationBell`, `PageHeader`, `Toolbar`, `FilterBar`, `SearchField`, `DataTable`,
`Pagination`, `StatusBadge`, `SeverityBadge`, `RoleBadge`, `ScopeBadge`, `EmptyState`, `ErrorState`,
`UnauthorizedState`, `Skeletons`, `ConfirmDialog`, `Sheet`, `Toast`, `SegmentedControl`, `Tabs`,
`Field`, `Input`, `Select`, `Textarea`, `Switch`, `Checkbox`, `Button`, `IconButton`, `CopyButton`,
`PdfPanel`, `SourceLink`, `JobStepper`, `UploadDropzone`, `PolicyDiff`, `RejectionDialog`,
`RoleMatrix`, `PermissionOverrideGrid`, `IntegrationCard`, `RunTable`, `MemberTable`,
`PolicyChangeRow`. Reuse existing `Card`, `Badge`, `SeverityBadge`, `format` where they still fit.

## States, motion, accessibility, speed

- Every async surface: skeleton (layout-preserving), empty, error with retry + requestId,
  unauthorized; every mutation: pending copy, success feedback, failure inline; no dead control.
- Motion 150–200ms color/border/shadow only; no entrance animation in app; skeletons, not spinners,
  for data; one spinner inside a pending button; job progress `aria-live="polite"`; reduced motion
  removes transitions/shimmer.
- 2px brand focus ring; skip link; landmarks; one h1; table caption; labelled fields; errors text +
  icon; 44px touch; dialogs trap/restore focus; segmented controls real buttons with `aria-pressed`;
  PDF panel has a labelled iframe + open-in-new-tab fallback; contrast AA; no color-only status.
- Budgets: LCP <2.5s, INP <200ms, CLS <0.1, route JS <250kB first load. Server components by
  default; client islands for menus, filters, forms, theme, notification panel; lazy PDF/admin
  tables; no chart/UI kit; prefetch visible nav only; polling backs off and stops.
- 320px no horizontal scroll; 390px, 768px, 1024px, 1440px checked. Dark and light both checked on
  every route; no mixed sections. PDF is third-party content and labelled.

## Copy deck (use; do not invent claims)

- Sign-in: "Regulatory change, reviewed and on record." / "Continue with Google" / "Continue with
  Microsoft" / "Demo access" / "Continue as guest" / "Access is controlled by your workspace owner."
- Core: "Add a circular", "Upload PDF", "From URL", "Queue ingestion", "Needs review", "View PDF",
  "View source", "Acknowledge", "Reject with a note", "Publish policy change", "Save changes",
  "Not configured", "Configured in environment", "Read-only oversight".
- Errors: "That didn't save. Try again." + request id; "You do not have access to this workspace
  area."; "This file is not in your workspace."; "The note must be at least 10 characters."
- Empty: "No circulars yet.", "No published changes yet.", "Nothing assigned to you.", "No findings
  yet.", "No audit events yet.", "No sources yet." — each with a permitted next action or none.

## Data and no-mock rules

- Never render a row, name, count, issuer, date, role, option, integration state, PDF, citation, or
  email status that did not come from the DB/API. Demo workspace rows are `isDemo` and badged. Actual
  source URLs are owner-supplied via env and imported into `IngestionSource`; never hardcode or invent
  a regulator URL or selector. If no source exists, show "No sources yet." and an owner CTA only where
  permitted.
- Do not present the v1 representative-excerpt corpus as fetched v2 evidence. Documents shown in v2
  come from a real stored PDF (or the source link); if neither exists, show the honest missing state.
- If the API is down, show error/retry; if a feature is unconfigured, show "Not configured" and the
  env name — never a fake success. During development, use the seeded demo workspace, not fixtures in
  runtime. Component tests may use fixtures only inside tests.
- Do not call Prisma from a client component. Server components may call Qoder's read functions; all
  writes go through `/api/v1`. Do not build a page around an endpoint that does not exist.

## Testing and delivery

- Component tests: permission-driven nav, role/scope badges, rejection-note validation, theme toggle,
  empty/error/unauthorized, copy and a11y roles.
- E2E (real local DB, demo login): sign-in clean layout; owner dashboard; circular detail PDF/source
  toggle (stub only the remote file in test fixture, never in the app); ingest rejection guard; reject
  requires note; manager sees team, employee has no compliance nav and gets 403 at URL; guest has no
  audit/compliance; dark mode persists; 390px and 768px; keyboard path.
- Run `npm run lint`, `npm run typecheck`, `npm run test`; do not edit Qoder's `global-setup` or
  config. Capture real screenshots of each route in light and dark into `docs/discovery/assets/ui/`
  after the pages exist; no synthetic screenshots.
- Done: every route above exists, real, permission-aware, complete states, responsive, dark, keyboard,
  no horizontal scroll at 320, no hardcoded brand values, no mock content, e2e green, screenshots
  evidence. If official logo or provider marks are missing, use the recorded wordmark/text fallback.

## File plan

`src/app/{layout,page,globals.css,loading,error,not-found}.tsx`, `src/app/signin/page.tsx`,
`src/app/app/layout.tsx`, `src/app/app/**` pages, `src/components/{shell,auth,ui,policy,ingest,
admin,settings}/**`, `e2e/ui-*.spec.ts`, component tests beside components. Remove the v1 marketing
sections, `/platform` link, role hardcoding, and legacy `/app/findings|data|assistant` routes (redirect
or delete and update tests; no dead links).

Next: wait for `contracts/v2` + `/api/public/branding` + `/me`; build shell and sign-in first, then
route skeletons, then data states.