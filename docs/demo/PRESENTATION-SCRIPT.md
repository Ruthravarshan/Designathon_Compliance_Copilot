# PolicyPulse — 7-Minute Page-by-Page Demo Script

One page per stop. Say the quoted lines. Move on. The tour covers every product screen. Times are
targets: click while you finish the previous sentence, because the pages are server-rendered.

**Before you start:** open `https://policypulse-sage.vercel.app/api/health` once, then the live URL at
110–125% zoom. Sign in as Rajeshwari and open every screen below once, then sign out. Do not run
`db:seed` during the demo.

---

## 1 · 0:00–0:30 · `/` — Home

**Click:** nothing. Stay at the top.

**Say:**

> "Every compliance team has one expensive failure: a decision they cannot defend."
>
> "PolicyPulse reads the regulator PDF, extracts every obligation, maps it to our own policy, and
> gives the officer a cited gap, a drafted redline, and one mandatory human sign-off."
>
> "This card: IRDAI says six hours, our policy says 72. Critical gap — exact quote, mapped policy,
> 88 percent deterministic confidence, human sign-off required."

## 2 · 0:30–0:50 · `/` — Capabilities

**Click:** Capabilities.

**Say:**

> "Three guarantees. Clause-grounded: every obligation carries a verbatim quote back to its section.
> Tenant-isolated: the server decides which company's data a request can see. Human-gated: the
> machine reads, matches, scores, and drafts — a person signs."
>
> "We removed the human from the search, not from the decision."

## 3 · 0:50–1:15 · `/` — Workbench and Workflow

**Click:** Workbench, click RBI and DPDP, then Workflow → **02 Extract**.

**Say:**

> "Three real clause patterns — IRDAI, RBI, DPDP — and the same shape every time: exact quote,
> mapped policy, delta, drafted redline, and confidence: 40 quote, 35 mapping, plus rule certainty."
>
> "Extract is where trust is won. The model proposes; the verifier disposes. Every quote must be an
> exact substring of the page it cites, or it is flagged. If the model fails, a deterministic
> extractor takes over and the run is labelled fallback."

## 4 · 1:15–1:30 · `/signin` — Sign in

**Click:** Open workbench → **Rajeshwari · Head of Compliance · OWNER**.

**Say:**

> "OAuth 2.0 and SAML are the enterprise path; Gmail OAuth is implemented; user-login SSO is labelled
> roadmap. For this demo, labelled role access: six personas across two companies."

## 5 · 1:30–1:45 · `/app` — Overview

**Click:** Open findings.

**Say:**

> "The whole workspace in one screen: pending review, reviewed, circulars analysed, DPDP risk fields,
> the posture score, and overdue alerts. Ordered by severity and deadline. Only unapproved items
> lower the posture; nothing here publishes itself."

## 6 · 1:45–1:55 · `/app/findings` — Findings list

**Click:** Pending, CRITICAL. Ctrl+F "incident". Open the IRDAI row.

**Say:**

> "One row per obligation with a gap. Filter by review status or severity; owners can export CSV.
> Every row carries a citation, a mapping, and a human review state."

## 7 · 1:55–2:55 · `/app/findings/[id]` — Finding detail, approval, email

**Click:** scroll to "Record a review decision", then **Approve draft**. Wait for the decision to
record.

**Say:**

> "Four things an auditor asks for: the clause, the policy, the gap, and the history."
>
> "The quote is an exact substring of the stored clause, with the page number and a link to the
> original regulator page. POL-SEC-02 promises 72 hours; the regulator says six. Critical, with a
> deadline. The redline is a draft — old struck, new proposed. Confidence is the same published
> formula."
>
> "Now the human gate. I approve. One action writes the finding status, an immutable review event,
> an audit row, and one email into the outbox. The policy register itself is not rewritten."
>
> "Decision on record. This is locked and append-only. The email is queued now; sending is the next
> stop."

**If cut to 3:00:** say the closing line from section 20 and stop.

## 8 · 2:55–3:10 · `/app/circulars` — Circular register

**Click:** the IRDAI circular.

**Say:**

> "The circular register. Each entry keeps its source URL, effective date, checksum, clause count,
> and finding count."

## 9 · 3:10–3:25 · `/app/circulars/[id]` — Circular detail

**Click:** Open archived PDF in a new tab, close it. Back.

**Say:**

> "The stored original, served through an authorised proxy, plus the regulator's own source link.
> Pages, clauses, obligations, and the checksum are all here. Below, the clause explorer shows each
> obligation and the finding it produced, with revision history for republished circulars."

## 10 · 3:25–3:35 · `/app/circulars/new` — Ingest

**Click:** Ingest circular. Back.

**Say:**

> "Owners and admins ingest here: paste text, a URL, or a stored file. Content is checksummed, split
> into clauses, and analysed immediately; findings enter the review queue."

## 11 · 3:35–3:45 · `/app/watch` — Regulatory watch

**Click:** nothing.

**Say:**

> "Tracked regulator sources, weekly cron plus on-demand runs. Fetches are SSRF-guarded — allowlist,
> redirect cap, size limit — and checksum diffs mark republished circulars as revisions. One source
> is paused on purpose, and the run history keeps every attempt visible."

## 12 · 3:45–3:55 · `/app/policies` — Policies

**Click:** POL-SEC-02.

**Say:**

> "The internal policy register with a live assessment: compliant, at risk, or gaps, plus the last
> check. A check re-scores mapped findings and writes an immutable check row; it never edits policy
> text."

## 13 · 3:55–4:05 · `/app/policies/[id]` — Policy detail

**Click:** nothing.

**Say:**

> "POL-SEC-02: open, critical, high, and overdue counts, check history with actor and trigger, mapped
> findings, and the policy text. Check compliance records evidence; it does not change the policy."

## 14 · 4:05–4:40 · `/app/assistant` — Policy Q&A

**Click:** ask: "How fast must we report a cyber incident to IRDAI?"

**Say:**

> "The assistant answers only from this workspace's stored clauses and policies. Hybrid retrieval —
> keyword plus 768-dimension embeddings — finds the passages; the model may only answer from them,
> quoting them verbatim. The passages are treated as data, not instructions."
>
> "If the evidence is missing, it refuses and tells you to escalate. If the model is not configured,
> the badge says Extractive answers and the deterministic fallback returns the same citations."

## 15 · 4:40–4:50 · `/app/data` — Data discovery

**Click:** nothing.

**Say:**

> "The DPDP scan over twelve catalogued fields. Three observed facts per field: sensitivity,
> encryption at rest, and whether consent is recorded. Sensitive and unencrypted or unconsented is
> critical, and each finding cites a clause."

## 16 · 4:50–5:05 · `/app/audit` — Audit trail

**Click:** nothing.

**Say:**

> "Append-only. The approval you just made is here, with actor, entity, and timestamp. Review events
> carry their own immutable history. There is no edit or delete anywhere. Owners and admins can
> export evidence CSV, guarded against formula injection."

## 17 · 5:05–5:20 · `/app/architecture` — Architecture

**Open:** type `/app/architecture` in the address bar.

**Say:**

> "The verification pipeline, the session → RBAC → tenant boundary, and my resolved permission set.
> The session is an HMAC-signed cookie; client-supplied tenant IDs and roles are ignored."
>
> "For scale: long work is queued, every query is tenant-scoped and indexed, and we built and tested
> our own load balancer — round-robin, least-connections, weighted, with health checks — for a
> self-hosted pool. The live URL runs on Vercel's managed platform."

## 18 · 5:20–5:35 · `/app/settings` and `/app/settings/email` — Email

**Click:** user menu → **Personal settings**, then **Open email settings**.

**Say:**

> "Personal settings: identity, role, and theme."
>
> "This is how email actually works. Product email is written to the outbox first; a worker drains
> the queue and retries on failure, so a send never blocks or rolls back a decision. Provider is a
> setting: Gmail OAuth, SMTP/Mailpit, Resend, or log-only. Gmail tokens are encrypted with
> AES-256-GCM and the scope is send-only."
>
> "If the badge says Connected, the approval email can be tested live. If it says Not connected, the
> queued row waits visibly — I will not fake an inbox."

## 19 · 5:35–5:45 · `/app/settings/storage` — Storage

**Open:** type `/app/settings/storage` in the address bar.

**Say:**

> "SharePoint is the primary store, with Drive or Supabase as failover, and failover only fires when
> the primary is unavailable. Uploads are path-scoped per workspace and never overwrite. A failed
> upload shows a safe error, never a fake success."

## 20 · 5:45–6:25 · `/app` — Roles and tenant isolation

**Click:** user menu → Sign out → **Nikhil Rao · Board Audit Committee · VIEWER**. Open Findings,
then type `/app/audit`. Sign out → **Tara Singh · Compliance Lead, Northwind · OWNER**. Open
Findings.

**Say:**

> "Same app, different role. The auditor reads findings but has no review form, and the audit trail
> returns restricted — a server-side 403, not a hidden button."
>
> "Now a second company. Tara Singh is an owner, but of Northwind Assurance. Her workspace is empty;
> no record from the first company is visible. Tenant isolation is enforced on the server, and a
> guessed ID returns 404."

## 21 · 6:25–6:50 · Close

**Click:** nothing.

**Say:**

> "We automated the reading, the matching, and the drafting — not the deciding. Every decision still
> has a name, a timestamp, and a quote behind it."
>
> "PolicyPulse: regulatory change, with receipts."

Then: "Happy to take questions."

---

## Keep it true

- Landing scenarios are fixtures from real clause patterns, not live regulator data.
- User-login SSO is roadmap. Gmail OAuth is implemented.
- The load balancer is a tested module; it is not serving the live URL.
- The model proposes, the verifier checks, a human decides.
- If a finding is already approved, switch to the backup CRITICAL row and say so.
