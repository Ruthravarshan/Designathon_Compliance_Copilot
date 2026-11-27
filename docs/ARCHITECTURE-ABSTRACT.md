# Compliance Copilot — architecture abstract

> **Status:** v1 abstract. PolicyPulse v2 adds real SSO/guests, DB-driven RBAC, SharePoint/Supabase
> storage, live actual-source ingestion, Gemini-verified extraction, assignments, and a worker. See
> [05](discovery/05-solution-design.md) and [handoffs](handoffs/README.md); the limits below are v1.

**Problem.** Indian financial and data-protection regulation changes continuously, while compliance
teams still translate circulars into obligations by hand, search spreadsheets for the affected
policy, judge the gap informally, and chase owners by email. The expensive failure is not a missing
document search; it is an indefensible decision: a paraphrase with no clause, a severity with no
rationale, and a review with no audit trail. The Compliance Copilot turns a circular into
clause-cited obligations, scored policy gaps, an editable redline, and a remediation task, then
requires an authorized officer to decide. It never publishes policy on its own.

**Architecture.** The product is a single Next.js 15 App Router application (React 19 server
components, TypeScript strict) backed by PostgreSQL 16 through Prisma 6. Server components render the
workbench; route handlers serve JSON. Every request crosses the same pipeline: same-origin check for
mutations, Zod validation of the body, actor resolution from an HMAC-signed session cookie, server-side
RBAC, rate limiting, then a tenant-scoped service call. Success returns `{ data }`; failure returns a
closed error envelope with a request id and no stack, SQL, or provider message. The email outbox is a
table drained by an authenticated worker, never an inline send.

The compliance engine is deterministic and runs offline. A parser turns labelled regulatory text into
clauses with page and section metadata. An extractor uses modal-verb rules and a number-word lexicon
to produce atomic obligations: type, action, audience, threshold or SLA, and the exact quote. A
verifier confirms the quote is a character-for-character substring of the source clause; an unverified
quote is flagged in the UI and cannot masquerade as evidence. A mapper scores tag, term, and attribute
overlap against the internal policy and control registers and records the rationale. A typed gap rule
compares obligation and control attributes to set status (compliant, partial, gap), severity
(CRITICAL/HIGH/MEDIUM/LOW), deadline, and a word-level redline. Confidence is a published weighted
formula — 40% citation verification, 35% mapping score, 25% rule certainty — shown with its
components on every finding. Where a rule does not match, the output is an explicit `manual_review`
obligation rather than a guess.

**Data and tenancy.** Fifteen Prisma models cover identity (User, Workspace, Membership), regulation
(RegulatoryDocument, DocumentClause), the internal register (InternalPolicy, InternalControl),
outputs (Obligation, Finding, ReviewEvent, DataFieldScan), governance (AuditLog), and email
(EmailMessage, EmailPreference, EmailSuppression). Every tenant-owned table carries `workspaceId`;
every read and write filters by the actor's workspace, so a guessed id returns 404 without disclosing
existence. Lists are cursor-paginated with bounded page sizes and indexed by review status, severity,
and due date. Two seeded workspaces exist so isolation is demonstrated, not asserted.

**Human-in-the-loop.** A finding can be approved, approved with edits, or rejected by OWNER or ADMIN.
The decision updates the finding, writes an immutable review event with previous and updated state,
and writes a workspace audit row in one transaction. A second submission is rejected with 409.
Rejections require a reason; edited wording is length-bounded. Approval queues a remediation email to
the mapped owner with an idempotency key; if the queue fails, the review still commits and the failure
is logged. There is no edit or delete affordance for audit rows, and no endpoint that changes the
policy register. The UI mirrors permissions for affordances, but the server enforces them.

**Security.** The session cookie is HMAC-SHA256 signed, httpOnly, SameSite=Lax, secure in production,
and expires in eight hours. Persona sign-in exists only behind an explicit demo flag and is documented
as non-production. Mutations check same-origin and are rate-limited by IP or user (auth 10/min, review
20/min, ingest 5 per 5 minutes, and similar). Security headers include nosniff, frame denial, referrer
and permissions policies, COOP/CORP, a report-only CSP, and HSTS in production. Pino logs are
structured and redact cookies, authorization headers, emails, and reset links. Email rendering escapes
variables, strips CRLF from subjects, allows only http(s) links, and honours preferences and
suppression. The production dependency audit reports zero vulnerabilities.

**Secondary flows.** Policy Q&A answers only from the internal register and ingested clauses, returns
its citations, and escalates when the sources do not cover the question. DPDP data discovery scans
catalogued fields for category, encryption, and consent, assigns a rule-based risk level, and cites
the DPDP section it applies. Both are permission-gated and tenant-scoped.

**Verification.** The unit suite covers extraction, verification, mapping, gap rules, redline, Q&A,
data scanning, RBAC, email rendering, rate limiting, load balancing, and session signing: 223 tests,
99.86% statements and 98.19% branches, with every tested module at or above 95%. Playwright runs a
seeded golden path (owner signs in, opens a critical finding, approves, sees the decision and the audit
row), a viewer 403 at the UI and API, an anonymous redirect, and a second-tenant empty-workspace test
on desktop and mobile. The seed is reset before the suite so review states are deterministic.

**Deliberate limits.** There is no live regulator scraper, no PDF layout parser, no vector store, and
no LLM in the demo path. Those are roadmap items, not hidden substitutions: the brief's multi-agent
framing is implemented as deterministic stages behind a verifier so that every output is reproducible
and every citation is provable. Production work would add SSO, a Redis-backed limiter, a stricter CSP,
real source ingestion, and ticket integrations — all behind the same review and audit contract.
