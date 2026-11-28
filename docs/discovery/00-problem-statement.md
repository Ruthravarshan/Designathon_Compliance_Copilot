# 00 — Problem statement

> Phase 00 · intake. The raw brief is stored verbatim at `docs/problem_statement.md` (source of
> truth); this artifact records the intake reading, not a second copy.

## Intake

- Event: Hexa Designathon (10-hour build)
- Date: 2026-11-27
- Team: solo build with an agent operator
- Time budget: 10 hours, demo is the deliverable
- Brief: _AI Regulatory Change & Compliance Copilot_ — agentic RegTech for RBI, SEBI, IRDAI, and
  the DPDP Act 2023.
- Judging: repo with clean history, slide deck, 3–5 minute demo video, ≤1000-word architecture
  abstract; product must show business value, architecture, differentiation, and roadmap.

## Explicit requirements

1. Ingest 3–5 Indian regulatory circulars with clause, page, and section preserved.
2. Extract atomic obligations: what, who, when, threshold/SLA.
3. Map each obligation to an internal policy/control register.
4. Detect gaps with severity (CRITICAL/HIGH/MEDIUM/LOW) and a deadline.
5. Draft remediation: a before/after policy redline plus an owner task.
6. A compliance officer approves, edits, or rejects every finding.
7. Every finding cites a verified verbatim clause; confidence is exposed and calibrated.
8. Immutable audit trail for every decision.
9. Bonus: grounded policy Q&A and DPDP personal-data discovery.

## Implicit requirements

- Demo must not depend on a live PDF parser, a vector DB, or an LLM API key.
- A regulated reader must be able to defend every line, so provenance beats fluency.
- Tenant isolation and server-side RBAC are table stakes for a GRC buyer.
- The review action must be attributable, timestamped, and irreversible in the UI.

## Constraints

- Platform: Next.js 15 App Router, Postgres 16, Prisma 6, Tailwind 4; one container-friendly app.
- Data: demo-only seeded corpus and internal registers; no customer data, no live regulator fetch.
- Regulatory: RBI/IRDAI/SEBI/CERT-In/DPDP source text represented by bundled clause excerpts with a
  source URL per document.
- Scale target: tenant-scoped cursor lists, bounded payloads; load-balancer and rate-limit units
  tested, not claimed at production volume.
- Team: one operator, no parallel workstreams.

## Unknowns

- Whether judges weight the literal multi-agent LLM architecture above deterministic traceability.
- Whether a public deployment URL is required or a local demo recording is accepted.
- Real PDF layout extraction quality; not solved in this build.

## Assumptions

- A deterministic rule engine satisfies MVP 1–4 with higher demo reliability than an LLM pipeline.
- Seeded clause text is representative enough to prove the workflow; not legal advice.
- The judge values an honest scope boundary over a mocked "AI" label.

## Red flags

- The brief calls for a multi-agent orchestrator; the submission must explain the deterministic
  substitute rather than pretend to run one.
- "Autonomous" conflicts with "human-in-the-loop"; the zero-autonomous-publish rule wins.

## One-sentence restatement

> Turn Indian regulatory text into clause-cited, severity-scored policy gaps, hand an officer an
> editable redline and owner task, and record every decision in an append-only audit trail.

## Gate

- [x] The brief is captured and linked.
- [x] Explicit and implicit requirements are separated.
- [x] Constraints are named.
- [x] Unknowns and assumptions are listed.
- [x] No product code was written from this artifact alone; phase 05/06 gate the build.

Next: `01-opportunity-map.md`

## Revision 2 — PolicyPulse (2026-11-27)

The original brief above is unchanged. The owner has tightened the product into **PolicyPulse**, a
deployable compliance workbench built on the existing app. This revision supersedes the v1 "demo
only" scope. The deterministic engine stays as the citation verifier and safe fallback; it is no
longer the whole product.

### Product

- Name: **PolicyPulse** (working lockup: PolicyPulse by Hexaware).
- Audience: compliance owner, compliance manager, department manager, employee, auditor, guest.
- Promise: a circular is ingested from a public source or PDF, stored in managed storage, extracted
  with a real LLM, cited to both the source page and the stored PDF, mapped to policy, and driven to
  an acknowledged or rejected assignment with email at every step.

### New explicit requirements

1. **Deploy-ready**: hosted on Supabase + Vercel, with real auth, storage, email worker, migrations,
   health check, and a smoke-tested URL. Local demo remains the fallback.
2. **Real identity**: Google SSO (plus Microsoft Entra SSO when configured) alongside a clearly
   labelled demo login for the judged walkthrough. Guest access is allowed only when the owner
   enables it, is sample-scoped, and can be revoked by the owner or an admin.
3. **Owner control**: the owner can see and change which roles can see compliance, manage role
   permissions, per-person overrides, departments, members, SSO providers, guest access, branding,
   storage provider/location, ingestion sources, AI settings, and email settings. Every change is
   audited.
4. **RBAC is role + person + department**: a normal employee must not see company-wide compliance; a
   manager may see their team; an auditor may see all read-only; the owner controls the matrix. A
   user-level grant or deny must be possible without changing the role. Tenant isolation still holds.
5. **Ingestion agent**: public listing page → scrape file links → download with safety limits →
   upload to SharePoint (or the owner-configured provider) → store metadata and source URL → the app
   cites the stored PDF. The ingest screen must accept **both** a PDF upload and a link (listing or
   direct PDF). Only roles with ingest permission can add circulars. Sources and documents must be
   actual public sources; never synthesize a circular or present a representative excerpt as fetched
   evidence.
6. **LLM**: use the owner-provided Gemini API key for extraction/summarisation; do not fabricate a
   result. Every quote is verified against extracted source text and every failure is visible.
7. **Citations**: each obligation/change exposes both the stored PDF and the original website link;
   the reader chooses which to open. No source link means the UI says so.
8. **Rejection notes are mandatory** for finding, circular, policy-change, and assignment rejection.
9. **Email at every meaningful step**: circular received, ingestion failed, assignment created,
   acknowledged, rejected, overdue, policy change published, role/access change. Outbox only; no
   inline sends.
10. **No hardcoded values**: app data, personas, roles' permissions, departments, issuers, sources,
    storage config, SSO settings, branding, and metrics come from the database/API. The one exception
    is the **actual source URL input**: the owner supplies it only through `INGESTION_SOURCE_URLS`
    (env), a one-time bootstrap writes DB `IngestionSource` rows, and no URL is hardcoded or guessed.
    Empty states are used when data is absent; no fake rows, counts, screenshots, or proof pages.
11. **UI**: clean and minimal; the signed-in person's name/role/avatar are placed deliberately;
    responsive at 320–1440px; light and dark themes; no "proof" or illustrative marketing page
    instead of the real workbench; perceived and measured performance matter.
12. **Brand**: official Hexaware logo only; the owner will supply the asset. Until then use the
    approved Manrope wordmark fallback, never a fabricated logo.
13. **Policy change visibility**: every logged-in person with the appropriate permission can see what
    changed in a policy (version, diff, source circular, approval), not just a proof of concept.

### Constraints

- Keep the existing Next.js 15/React 19/Prisma/Postgres app; extend it, do not rebuild it.
- Supabase Postgres, Vercel hosting, Supabase Auth/SSO, Prisma migrations.
- Gemini free-tier key; quota, data-use terms, and the exact key mode must be verified before the
  demo. The key is server-only.
- SharePoint via Microsoft Graph app-only credentials; the owner has not supplied the Azure/Graph
  details yet. Storage is provider-abstracted so a real Supabase Storage bucket can keep the demo
  working until SharePoint is configured. Never fake an upload.
- Email: Mailpit locally; Resend/SMTP in production. A schedule that runs at least once a minute is
  required for demo-visible acknowledgements (Supabase pg_cron or Vercel Pro).
- Three parallel workstreams (backend, UI, ingestion) with file ownership and an integration owner.
  Contract freeze is mandatory before parallel edits.

### Unknowns and owner-provided blockers

- Supabase project URL, publishable key, secret key, and pooler URLs.
- Google OAuth client (and Microsoft Entra app if Microsoft SSO is required).
- Azure app registration for Graph (tenant, client, secret), site/drive IDs, folder, and consent.
- Official Hexaware logo asset and lockup rules; whether "PolicyPulse" sits beside or below it.
- Resend key and verified sender domain (or SMTP details), and the target Vercel domain.
- Actual public source listing/direct-PDF URLs, supplied only through `INGESTION_SOURCE_URLS`; no URL
  is hardcoded or guessed, and listing selectors must be confirmed against the real pages.
- Gemini key mode/endpoint (the key format is not the classic `AIza…` form) and free-tier limits.
- Whether Google Drive is required in addition to SharePoint in this build.
- Guest policy: expiry, what sample content is visible, and whether guest sign-in is on for the demo.

### Revised one-sentence restatement

> PolicyPulse ingests a circular from a public page or PDF, stores the original in owner-configured
> managed storage, extracts and verifies obligations with Gemini, shows the cited policy change to
> everyone with authority, drives acknowledgement or a noted rejection by email, and lets the owner
> control identity, roles, storage, sources, and settings from the database.

### Revision 2 gate

- [x] New requirements, constraints, blockers, and scope are captured.
- [x] The original brief is preserved.
- [x] Phases 05 and 06 are updated before v2 product code.
- [x] Three workstreams are defined in `05-solution-design.md` with file ownership and acceptance checks.
- [x] Actual source URLs enter only through `INGESTION_SOURCE_URLS`; no invented source or document.

Next: `05-solution-design.md` (v2) → `06-visual-direction.md` (v2) → build in lanes.
