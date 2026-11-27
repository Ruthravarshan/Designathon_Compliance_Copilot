# PolicyPulse — Business Handoff in Plain English

Read this once before the demo. It explains what the product is, what the business asked for,
what is actually built, and what is honestly not built yet. No technical background needed.

---

## 1. The one-paragraph version

PolicyPulse is a compliance workspace for Indian financial regulation. It takes a real regulator
document (RBI, SEBI, IRDAI, DPDP), pulls out every rule the company must follow, compares each rule
with the company's own policy, and shows the gaps with the exact quote and page number. A human
officer approves, edits, or rejects each gap. The app records who decided and when; a rejection
must include why. No policy changes automatically.

**One sentence to remember:** *PolicyPulse turns a regulator PDF into a cited gap, an editable
redline, and a recorded human decision.*

---

## 2. The business problem (tell it as a story)

A compliance officer receives a long IRDAI circular. Today they must:

1. Read the whole document and find every sentence that says "shall".
2. Decide which internal policy or control each sentence touches.
3. Check if the internal policy is stricter or weaker than the new rule.
4. Write a corrected policy paragraph.
5. Email the policy owner and chase them.

This is done in Word, email, and memory. The expensive failure is not "we could not find the
document". The expensive failure is **a decision you cannot defend**: a paraphrase with no clause,
a severity with no reason, and a review with no audit trail.

When an auditor or the board asks "why did you decide this?", the team cannot prove it.

PolicyPulse fixes that specific failure. It keeps the proof.

---

## 3. What the product does, in six steps

| Step | Plain meaning |
| --- | --- |
| 1. Ingest | Store the regulator PDF and its original source URL. |
| 2. Extract | Split the document into clauses and turn each "shall" into a single obligation: what, who, when, threshold. |
| 3. Verify | Check that the quoted sentence is an exact substring of the stored clause. If not, flag it. |
| 4. Map | Match the obligation to the closest internal policy or control, with a score. |
| 5. Assess | Apply a typed rule to set gap status, severity, deadline, and a draft redline. |
| 6. Review | An authorized officer approves, approves with edits, or rejects with a written reason. The decision and audit row commit together; the email is queued through the outbox. |

The important part is step 3 and step 6. The app never hides an uncertain quote, and it never
publishes a policy by itself.

---

## 4. What the business asked for, and what is actually built

The original brief asked for an AI regulatory change and compliance copilot. This table maps each
requirement to the real product. Status words are honest: **Built**, **Partly built**, **Roadmap**.

| # | Business requirement | Status | What is real in the app |
| --- | --- | --- | --- |
| 1 | Ingest 3–5 Indian circulars with clause, page, and section kept | Built | Two real, full-length regulator PDFs are seeded: IRDAI Cyber Security Guidelines 2023 and SEBI CSCRF 2024. They produce roughly 1,000 clauses. The ingest screen also accepts a PDF upload or a link. We chose two real documents over five representative excerpts. |
| 2 | Extract atomic obligations: what, who, when, threshold or SLA | Built | Deterministic rules read each clause into an obligation with type, audience, SLA, and an exact quote. |
| 3 | Map each obligation to an internal policy or control | Built | Policy and control registers are scored by tag, term, and attribute overlap. The mapping and its score are shown on the finding. |
| 4 | Detect gaps with severity and a deadline | Built | Typed gap rules produce status, CRITICAL/HIGH/MEDIUM/LOW, and a due date. Example: 72-hour internal policy vs 6-hour regulator rule = CRITICAL. |
| 5 | Draft remediation: before/after redline plus an owner task | Built | A word-level redline is generated. The finding records the task owner, notify address, and target date. |
| 6 | An officer approves, edits, or rejects every finding | Built | Approve draft, approve with edits, or reject. Rejection needs a reason of at least 10 characters. |
| 7 | Every finding cites a verified clause; confidence is exposed | Built | The quote must be an exact substring (minimum 12 characters). Confidence is a published formula: 40% citation, 35% mapping, 25% rule certainty. |
| 8 | Immutable audit trail for every decision | Built | Review events and audit rows are append-only. The UI has no edit or delete for them. Owners and admins can export CSV. |
| 9 | Bonus: grounded policy Q&A and DPDP data discovery | Built | Q&A answers only from stored clauses and policies, with citations, and refuses when it cannot ground an answer. The DPDP scan checks 12 catalogued fields for sensitivity, encryption, and consent. |
| 10 | Deployable with real identity (v2) | Partly built | The app is live on Vercel with Supabase Postgres. SSO entry points are shown, but the production OAuth redirect is not wired in this build. The judged path is the clearly labelled demo role sign-in. |
| 11 | Owner controls roles, permissions, and settings (v2) | Partly built | Email and storage settings are real pages. The role matrix is enforced in code but is not yet owner-editable, and per-person overrides are roadmap. |
| 12 | Email at every step (v2) | Partly built | The decision email, welcome email, and test email go through a durable outbox. Assignment reminders and overdue digests are roadmap. |
| 13 | Tenant isolation and server-side RBAC | Built | Two workspaces are seeded. Every query filters by the signed-in workspace. A guessed ID returns 404. Roles are checked on the server, not only in the UI. |
| 14 | No hardcoded product data; honest empty states | Mostly built | Counts, findings, policies, and settings come from the database. Demo personas and the second tenant are explicitly demo data. When something is not configured, the app says so instead of faking it. |
| 15 | Clean, responsive, dark mode, accessible UI | Built | Light and dark themes, 320–1440px layouts, keyboard focus, contrast checks, reduced motion, and loading, empty, error, and unauthorized states. |

---

## 5. Who uses it (the roles you will show)

The app currently has four roles. They are enforced on the server.

| Role | Demo person | Can do | Cannot do |
| --- | --- | --- | --- |
| OWNER | Rajeshwari, Head of Compliance | Everything: ingest, review, audit, Q&A, data scan, email and storage settings, CSV export | — |
| ADMIN | Ruthravarshan, CISO | Ingest, review, audit, Q&A, data scan, email and storage settings | Delete the workspace or manage billing |
| MEMBER | Sana Iqbal, Compliance Analyst; Ananya Rao, HR Policy Owner | Read circulars, findings, and policies; ask Q&A; run a policy check; read the watch page | Review, ingest, read the audit trail, run the DPDP scan |
| VIEWER | Nikhil Rao, Board Audit Committee | Read-only circulars, findings, policies, and watch | Review, ingest, Q&A, audit trail, data scan |

A second company, **Northwind Assurance**, is seeded with **Tara Singh** as its owner. Her workspace
is empty. This proves tenant isolation instead of just claiming it.

---

## 6. The rules the product never breaks

These are the promises you can make on stage.

1. **Human sign-off.** No finding, policy change, or redline publishes itself. A person decides.
   Even an approval records the decision and a remediation task; it does not rewrite the policy
   register.
2. **Proof over fluency.** A quote that is not an exact substring of the stored clause is flagged
   for review, not shown as evidence.
3. **A rejection needs a reason.** At least 10 characters. The reason is stored, audited, and
   visible in the history.
4. **Decisions are append-only.** The app has no edit or delete for review events or audit rows.
5. **Tenant isolation is server-side.** The browser never sends a trusted workspace ID. A guessed
   ID returns 404.
6. **Email is queued, not sent inside the request.** If email fails, the decision still commits and
   the message stays in the outbox.
7. **Long work is queued.** Ingestion and sending do not block the page.
8. **No fake data.** Empty states are real. A missing integration shows "not configured", never a
   fake success.

---

## 7. What is real, what is demo, what is not built

This is the honesty section. Use it if a judge asks "what is actually real?"

| Area | Reality |
| --- | --- |
| Regulator documents | **Real.** The IRDAI 2023 and SEBI 2024 PDFs are checked into the repo, parsed by the same extractor as live ingestion, and archived for the PDF viewer. Page numbers and source URLs are real. |
| Internal policies and controls | **Seeded demo data** for a fictional company ("Hexa Demo"). Five policies, four controls. |
| Findings and redlines | **Generated** by the deterministic engine from the real PDFs and the seeded register. The count is computed in the app, so read the screen, not a number from this document. |
| Demo people | **Seeded personas**, clearly labelled as demo access. The owner and CISO inboxes are real, monitored addresses so the approval email can be shown. |
| Second tenant | **Seeded** Northwind Assurance, empty by design. |
| AI | **Gemini** is used for grounded policy Q&A with verified citations, and falls back to deterministic extractive answers when it is unavailable. Document extraction and gap logic are deterministic and run offline. |
| Email | **Real outbox.** Provider is configurable: Mailpit locally, SMTP/Resend/Gmail in deployment. If the provider is not connected, messages stay visibly queued. |
| Storage | Archived PDFs are served through an authorized proxy. SharePoint, Google Drive, and Supabase Storage are configurable; when not configured, the app shows an honest state. |
| Watch | Real regulator listing sources with safe fetch, allowlists, and checksums. One source can be paused on purpose. A live run depends on the regulator site and the network. |
| Not built | Automatic policy publishing, legal advice, OCR of scanned pages, Jira/ServiceNow tickets, production SSO/OAuth wiring, owner-editable role matrix, per-person overrides, assignment inbox and reminders. These are roadmap, not hidden features. |

---

## 8. Why a company would pay for this

Do not invent ROI numbers. Say the workflow value instead.

- **Faster first pass.** The app reads and matches; the officer spends time deciding, not searching.
- **Defensible decisions.** Every severity, quote, and redline has a visible reason and a source.
- **Consistency.** The same rule produces the same severity every time, instead of depending on who
  read the circular.
- **Controlled access.** Owners decide, analysts prepare, auditors read, and nobody else sees
  company-wide compliance.
- **Audit readiness.** The decision history is already written when the auditor asks.
- **Honesty.** The product does not pretend a model made a legal decision. It gives the officer
  evidence and records the call.

---

## 9. Where everything is in the app

| Screen | What it shows |
| --- | --- |
| `/` | Public landing page with the IRDAI six-hour example and an interactive redline preview. |
| `/signin` | SSO buttons and the labelled Quick Role sign-in. |
| `/app` | Overview: pending review, posture score, urgent queue, circular coverage, DPDP summary. |
| `/app/findings` | Filterable queue by review status and severity. |
| `/app/findings/[id]` | The proof page: clause, page, source link, mapping, redline, confidence, task, review form, history. |
| `/app/circulars` | Stored regulator documents with clause and finding counts. |
| `/app/circulars/[id]` | Archived PDF, source URL, clause explorer, revision history. |
| `/app/watch` | Tracked regulator sources, on-demand fetch, run history, posture alerts. |
| `/app/policies` | Internal policies with compliance assessment and last check. |
| `/app/policies/[id]` | Check history, mapped findings, policy text. |
| `/app/assistant` | Grounded policy Q&A with citations and refusal behaviour. |
| `/app/data` | DPDP personal-data scan across 12 catalogued fields. |
| `/app/audit` | Append-only audit trail and CSV export (owner/admin only). |
| `/app/architecture` | Interactive pipeline, session and tenant boundary, active permission set, guardrails. |
| `/app/settings/email`, `/app/settings/storage` | Provider configuration and test actions. |

---

## 10. Words you will hear (say them simply)

- **Obligation** — one thing the regulation says the company must do.
- **Finding** — an obligation compared with an internal policy where a gap exists.
- **Gap** — the difference between the rule and the policy (for example, 6 hours vs 72 hours).
- **Severity** — CRITICAL, HIGH, MEDIUM, LOW, set by a rule, not by a model.
- **Redline** — the proposed policy wording: old text removed, new text added.
- **Citation** — the exact sentence from the stored PDF, with page and section.
- **Confidence** — a published weighted score, not a model's opinion.
- **RBAC** — role-based access control: the server decides what each role can do.
- **Tenant** — one company's workspace. Tenant isolation means companies cannot see each other.
- **Outbox** — the email queue. A request writes a row; a worker sends it.
- **Audit trail** — the append-only record of who did what and when.

---

## 11. Numbers you can safely say

- Two real regulator PDFs are seeded: IRDAI Cyber Security Guidelines 2023 and SEBI CSCRF 2024.
- Roughly 1,000 clauses are extracted from them in the local seed. If the screen shows a different
  count, read the screen.
- Five internal policies, four controls, and twelve data-catalog fields.
- Four roles, six demo personas, and two workspaces.
- More than 460 automated tests, with about 99.9% statement coverage, and zero high-severity
  production dependency findings in the release report.
- Live URL: `https://policypulse-sage.vercel.app`.

Do not quote a finding count from memory. The app computes it from the seeded corpus.

---

## 12. Short answers to the hard questions

| Question | Short answer |
| --- | --- |
| Is this legal advice? | No. It drafts evidence for an officer. The officer decides. The app records the decision. |
| Why not let an LLM decide? | The risky parts are the citation and the decision. Extraction and gap rules are deterministic and quote-verified. Gemini is used only where it is grounded and replaceable, and a human always decides. |
| What is real vs seeded? | The regulator PDFs, pages, and source URLs are real. The internal policies, findings, and demo people are seeded for the demo and labelled. No fake document is presented as fetched. |
| How do you stop one tenant seeing another? | Every row carries a workspace ID; every query filters by the session workspace; a guessed ID returns 404. Two tenants are seeded to prove it. |
| What if email fails? | The decision commits, the email stays queued in the outbox, and the worker retries. Email failure never rolls back the decision. |
| What if the model is down? | Q&A falls back to deterministic extractive answers. Document extraction and scoring are deterministic and offline, so the core demo does not depend on a model call. |
| How does it scale? | Cursor pagination, indexed filters, tenant-scoped queries, no N+1 queries, and long work moved to a queue. |
| What is next? | Live feed hardening, OCR for scanned PDFs, owner-editable permissions, assignment reminders, and Jira/ServiceNow tickets. |

---

## 13. The demo in one breath

1. Open the landing page and name the problem.
2. Sign in as Rajeshwari, the Head of Compliance.
3. Open the IRDAI six-hour finding and show the quote, page, policy, redline, and confidence.
4. Approve it. Show the decision record, the audit row, and the queued email.
5. Sign in as the auditor and show read-only access.
6. Sign in as the second tenant and show the empty workspace.
7. Close with: "Regulatory change, with receipts."

The full click-by-click script is in
[PRESENTATION-SCRIPT.md](PRESENTATION-SCRIPT.md).
