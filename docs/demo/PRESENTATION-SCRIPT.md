# PolicyPulse — Presentation Script

Read this on stage. Every **SAY (required)** line is written exactly as you can speak it. Lines
marked optional can be dropped if time is tight. Stage directions are in *italics*.

The full business explanation is in [BUSINESS-BRIEF.md](BUSINESS-BRIEF.md).

---

## Part 0 — Before you start (T-15 and T-5)

### T-15 minutes

- [ ] Open `https://policypulse-sage.vercel.app/api/health` and confirm `status: ok` and
      `database: ok`. On the free tier the database pauses when idle; this wakes it.
- [ ] Open the same URL on a big screen at 110–125% zoom. Light theme is the default and reads
      better on projectors.
- [ ] Sign in once as **Rajeshwari** to warm `/app`, the findings list, one finding, the audit page,
      and circulars. Then sign out so the live demo starts from the landing page.
- [ ] Open `/signin` in a second tab. Confirm **Quick role sign-in** is expanded and the six personas
      are visible.
- [ ] Open `/app/findings?review=pending` in a third tab as the owner. Note the **second** CRITICAL
      finding as your backup in case the first one was already approved.
- [ ] Open `/app/audit`, `/app/assistant`, and `/app/watch` once so they compile and cache.
- [ ] If Gmail is connected: send one test email from `/app/settings/email`, confirm it arrives,
      and keep that inbox tab open. If it is not connected: keep `/app/settings/email` open and
      plan to say the email is queued.
- [ ] Silent notifications, close chat apps, hide the bookmarks bar.
- [ ] Have the fallback recording ready in a local player.
- [ ] Optional local fallback: `npm run db:up`, `npm run db:seed`, `npm run dev`, then open
      `http://localhost:3000`. Use this only if the hosted URL is unreachable.
- [ ] **Do not run `db:seed` during the demo.** It resets review states.

### T-5 minutes

- [ ] Say the opening line out loud once.
- [ ] Confirm the IRDAI critical finding is still **pending**. If it is approved, switch your plan
      to the backup finding.
- [ ] Check the **Notify** address on the finding's remediation task. If it is the CISO's real inbox
      and Gmail is connected, you can show the inbox. If it is a demo address, show the outbox state
      instead. Never promise an inbox you have not checked.
- [ ] Put the phone on silent. Breathe. You know this flow.

---

## Part 1 — The 30-second opening (no slides, just talk)

**SAY (required):**

> "Indian regulators publish long, dense circulars. Compliance teams still read them by hand, guess
> which policy is affected, and email the owner. The expensive failure is not a missing document.
> It is a decision you cannot defend. PolicyPulse turns that circular into a cited gap, an editable
> redline, and a recorded human decision. This is regulatory change, with receipts."

---

## Part 2 — The 5-minute live walkthrough

### 0:00–0:25 · Landing page

**Do:** Open `/` on the deployed URL. Point to the hero card.

**SAY (required):**

> "This is the promise: regulatory change, with receipts. The card on the right shows the IRDAI
> six-hour rule. The company policy says 72 hours. That is a critical gap, and you can already see
> the quote, the source reference, and the policy it touches."

**Optional:**

> "The page below lets you inspect a redline, the four-stage pipeline, and the role matrix before
> signing in."

### 0:25–1:00 · Sign in and Overview

**Do:** Click **Open workbench** → `/signin`. Under **Quick role sign-in**, choose **Rajeshwari ·
Head of Compliance · OWNER**. You land on `/app`.

**SAY (required):**

> "I'll sign in as the Head of Compliance. Every account is role-scoped. The same app shows a
> different surface to an owner, an analyst, and a read-only auditor."

**SAY (required):**

> "This is the whole workspace in one screen: what needs sign-off, the compliance posture, the
> urgent queue, and the circular coverage. The queue is ordered by severity and deadline. Nothing
> here can publish itself."

**Optional:** Point at the posture score.

> "Posture only counts items still waiting for an officer. Once a decision is recorded, the item
> stops lowering the score."

**If SSO is not wired:** do not click Google or Microsoft. If asked, say: "The SSO entry points
are shown as the enterprise path. This build uses the labelled demo role access for the
walkthrough; the production OAuth redirect is a roadmap item."

### 1:00–2:15 · The finding with proof

**Do:** Click **Open findings**. Click the **CRITICAL** and **Pending** filters. Open the IRDAI
incident-reporting finding (the row whose text mentions six hours or incident reporting). If the
filtered list is still long, use Ctrl+F and search "incident" or "six". Scroll slowly in the order
below.

**SAY (required):**

> "This is one finding. It has the four things an auditor will ask for: the exact clause, the
> internal policy, the gap, and the decision history."

**1. Header.** Point at CRITICAL, Pending, Citation verified.

**SAY (required):**

> "The citation is not a summary. It is an exact substring of the stored source clause, at least
> twelve characters. If it does not match, the app flags it instead of showing it as evidence."

**2. Source clause card.** Point at the page number, the quote, and the **Source** link.

**SAY (required):**

> "Here is the clause, the page number, and a link to the original regulator page. The clause is
> stored, and the source link opens the original website."

**Optional:** If an **Open archived PDF** button is visible, open it.

> "This is the stored original, served through an authorized proxy. The source link and the stored
> file are both here; the reader chooses."

**3. Mapping and gap.** Point at POL-SEC-02 and the gap description.

**SAY (required):**

> "The rule engine mapped this to policy POL-SEC-02, the incident response policy. The policy
> promises 72 hours. The regulator says six. That is a critical gap, with a deadline."

**4. Redline.** Point at the struck-through 72-hour text and the added six-hour text.

**SAY (required):**

> "The redline is a draft, not a published policy. The old wording is struck through; the new
> wording is proposed. Approving it records the decision and assigns the remediation. It does not
> edit the policy register."

**5. Confidence.** Point at the three bars.

**SAY (required):**

> "Confidence is a published formula, not a model's opinion: 40 percent citation, 35 percent
> mapping, 25 percent rule certainty. You can see each component."

**Optional:** Point at the task card.

> "The task owner, the notify address, and the target date are on the right. The email is queued
> only after approval."

### 2:15–3:00 · The human decision and the audit trail

**Do:** In **Record a review decision**, select **Approve draft**. Optionally type a short note.
Click **Approve draft**. Wait for **Decision recorded**. Show the header badge, **Decision on
record**, and the new entry in **Review history**. Then open `/app/audit`.

**SAY (required):**

> "I'm the Head of Compliance, so I can decide. I'll approve the draft. One action writes three
> things: the finding status, an immutable review event, and an audit row. It also queues one
> email to the mapped owner."

**SAY (required):**

> "The decision is locked. The history is append-only. There is no edit or delete anywhere for
> these rows."

**Email moment — choose one:**

- **If Gmail is connected and the notify address is a real inbox:**

  **Do:** Drain the outbox if needed, then open the inbox tab.

  **SAY (required):**

  > "The approval queued one outbox row. The worker sent it. Here is the message in the mapped
  > owner's real inbox."

- **If email is not connected:**

  **Do:** Open `/app/settings/email` and show the provider/outbox state.

  **SAY (required):**

  > "The approval queued one outbox row. Delivery is a provider setting. I won't fake an inbox.
  > The decision and the audit row are already committed."

- **If email fails during the demo:**

  **SAY (required):**

  > "Email failure never rolls back the decision. The message stays in the outbox and the worker
  > retries."

### 3:00–3:30 · Bonus: grounded policy Q&A

**Do:** Open `/app/assistant`. Ask exactly:

> "What are the incident reporting timelines for cyber security incidents?"

**SAY (required):**

> "This is the bonus flow. The assistant answers only from this workspace's stored clauses and
> policies. Every answer must quote a source. If it cannot, it refuses and tells you to escalate.
> Here it found the IRDAI clause and the policy."

**Optional:** If the badge says "Extractive answers" instead of "Grounded generation":

> "The model is not configured in this environment, so it is using the deterministic extractive
> fallback. The citations are the same either way."

### 3:30–4:20 · Role boundary and tenant isolation

**Do:** Sign out. On `/signin`, choose **Nikhil Rao · Board Audit Committee · VIEWER**. Open any
**pending** finding. Then type `/app/audit` directly in the address bar.

**SAY (required):**

> "Same app, different role. As the auditor, the review form is gone. The server would return 403
> even if I called the API directly. The audit trail is restricted too."

**Do:** Sign out. Choose **Tara Singh · Compliance Lead, Northwind · OWNER**. Open Findings.

**SAY (required):**

> "Now a second company. Tara Singh is an owner, but of Northwind Assurance. Her workspace is
> empty. No record from the first company is visible. Tenant isolation is enforced on the server,
> not hidden in the UI."

### 4:20–4:40 · Optional depth: data discovery or policy check

Choose one, only if time allows.

**Do:** As the owner, open `/app/data`.

> "This is the DPDP scan: twelve catalogued fields, checked for sensitivity, encryption, and
> consent. These are observed facts, not guesses. These fields are unencrypted or have no consent
> basis, so they carry a finding and a citation."

**Or:** Open `/app/policies/POL-SEC-02` and point at the check history.

> "A policy check re-scores every finding mapped to this policy, writes an immutable check row,
> and alerts the owner when gaps remain open. It never edits the policy text."

### 4:40–5:00 · Close

**SAY (required):**

> "PolicyPulse turns a regulator PDF into a cited, severity-scored gap, gives an officer an
> editable redline, and records the decision. The core engine runs offline, so the demo cannot
> fail on a model call. The model is used only where it is grounded and replaceable. Regulatory
> change, with receipts. Thank you."

**Optional ask:**

> "We'd like a pilot with one compliance team and one real circular."

---

## Part 3 — The 3-minute cut

Keep these beats. Drop Q&A, data discovery, policies, and the email moment if the room is tight.

| Time | Beat | Required line to say |
| --- | --- | --- |
| 0:00–0:20 | Landing | "The expensive failure is a decision you cannot defend." |
| 0:20–0:35 | Sign in + Overview | "Every account is role-scoped. Nothing here can publish itself." |
| 0:35–1:40 | Finding | "The citation is an exact substring of the stored source clause." Then: "72 hours versus six. That is a critical gap." |
| 1:40–2:15 | Approve + audit | "One action writes the status, an immutable review event, an audit row, and one queued email." |
| 2:15–2:40 | Auditor + tenant | "Same app, different role." Then: "A second company sees an empty workspace." |
| 2:40–3:00 | Close | "Regulatory change, with receipts." |

---

## Part 4 — The 60-second version (if judges interrupt)

**SAY (required):**

> "PolicyPulse reads a real regulator PDF, pulls out every rule the company must follow, compares
> each rule with the company's own policy, and shows the gaps with the exact quote and page. A
> human officer approves or rejects each gap. The app records who decided and when; a rejection
> must say why. No policy changes automatically. That is the whole product."

Then open one finding and say:

> "Here is the proof: the clause, the page, the policy, the redline, and the confidence formula.
> The quote is verified as an exact substring before it can be cited."

---

## Part 5 — Slide-by-slide talk track (6 slides)

If you present a deck instead of a live demo, say exactly this per slide.

### Slide 1 — Title

> "PolicyPulse by Hexaware. Regulatory change, with receipts. We turn a regulator circular into a
> cited policy gap and a recorded human decision."

### Slide 2 — Problem

> "A compliance officer gets a long circular. They must find every obligation, find the internal
> policy, judge the gap, and chase the owner. Today this is Word, email, and memory. The failure
> that hurts is an unverifiable decision."

### Slide 3 — Insight

> "The problem is not document search. It is proof and accountability. A paraphrase cannot survive
> an audit. A severity with no rationale cannot survive a board question. A review with no trail
> cannot survive a regulator."

### Slide 4 — Solution

> "One flow: ingest, extract, verify, map, assess, review. The officer sees the exact clause, the
> mapped policy, the redline, and the confidence. They approve, edit, or reject with a reason. One
> transaction writes the decision, the audit row, and the email queue."

### Slide 5 — Under the hood

> "Next.js and Postgres on Vercel and Supabase. Server-side RBAC and tenant isolation on every
> read and write. A deterministic engine with exact-quote verification, so the core demo runs
> offline. Gemini only for grounded Q&A, with a deterministic fallback. Every long job is queued."

### Slide 6 — Proof and roadmap

> "More than 460 automated tests at about 99.9 percent statement coverage, a live deployed URL, and
> a release report with zero high-severity production dependency findings. Next: live feed
> hardening, OCR, owner-editable permissions, reminders, and ticket integrations."

---

## Part 6 — Q&A: exact answers

Use these lines. Keep them short.

**"Why not let an LLM decide?"**

> "The risky parts are the citation and the decision. Extraction and gap rules are deterministic
> and quote-verified. Gemini is used only where it is grounded and replaceable, and a human always
> decides."

**"Is this legal advice?"**

> "No. It drafts evidence for an officer. The officer decides. The app records the decision."

**"What is real and what is seeded?"**

> "The regulator PDFs, page numbers, and source URLs are real. The internal policies, findings,
> and demo people are seeded for the demo and labelled. No fake document is shown as fetched."

**"How do you stop one tenant from seeing another?"**

> "Every row carries a workspace ID. Every query filters by the session workspace. A guessed ID
> returns 404. We seed two tenants to prove it."

**"What if the email provider is down?"**

> "The decision commits, the message stays queued in the outbox, and the worker retries. Email
> failure never rolls back the decision."

**"What if the model is down?"**

> "Q&A falls back to deterministic extractive answers. Document extraction and scoring are
> deterministic and offline, so the core demo does not depend on a model call."

**"How does it scale?"**

> "Cursor pagination, indexed filters, tenant-scoped queries, no N+1 queries, and long work moved
> to a queue. The heavy work is not in the request path."

**"What did you cut, and why?"**

> "We cut automatic publishing, legal advice, OCR, and ticket integrations. The brief's most
> important promise is that a human decides and every decision is defensible. We protected that
> promise."

**"What is next?"**

> "Live feed hardening, OCR for scanned PDFs, owner-editable permissions, assignment reminders,
> and Jira or ServiceNow tickets behind the same review and audit contract."

**"How did you validate the problem?"**

> "We started from the regulatory workflow and the failure mode: unverifiable decisions. Every
> design choice is measured against one question: can an officer defend this line to an auditor?"

---

## Part 7 — If something breaks

Say the fallback line, keep moving, do not debug on stage.

| Failure | **SAY (required)** | Then |
| --- | --- | --- |
| App is cold or slow | "The server components are waking up. The skeleton is the real loading state." | Wait. Do not refresh repeatedly. |
| The first finding is already approved | "This one already has a decision on record. I'll use the next critical item." | Switch to your backup tab. |
| Findings list is empty | "This workspace has no seeded findings. Let me switch to the demo workspace." | Sign in as Rajeshwari. |
| A live watch run fails | "The watch run depends on the regulator site. The app fails visibly instead of faking a document. That is the design." | Show the stored PDF and source link instead. |
| Email is not connected | "The outbox row is queued. Delivery is a provider setting, not a fake step." | Show the decision and audit row. |
| Q&A refuses | "That is the correct behaviour. It refuses when it cannot ground an answer, instead of inventing one." | Ask the incident-reporting question. |
| The whole app is down | "I'll switch to the recorded run so we can keep moving." | Play the fallback recording and narrate. |

---

## Part 8 — One-page cheat sheet (the lines, in order)

1. "The expensive failure is a decision you cannot defend."
2. "PolicyPulse turns that circular into a cited gap, an editable redline, and a recorded human decision."
3. "Every account is role-scoped."
4. "Nothing here can publish itself."
5. "This finding has the exact clause, the policy, the gap, and the history."
6. "The citation is an exact substring of the stored source clause."
7. "The policy says 72 hours. The regulator says six. That is a critical gap."
8. "The redline is a draft. Approval records the decision; it does not rewrite the policy."
9. "Confidence is 40 citation, 35 mapping, 25 rule certainty."
10. "One action writes the status, the review event, the audit row, and the email queue."
11. "The audit trail is append-only. There is no edit or delete."
12. "Same app, different role. The server would return 403."
13. "A second company sees an empty workspace. Isolation is server-side."
14. "Regulatory change, with receipts."

---

## Part 9 — Do not say

- Do not say "the AI decides" or "the AI publishes". A human decides; the engine computes evidence.
- Do not claim SSO is wired; the OAuth redirect is a roadmap item and the demo uses labelled role
  access.
- Do not claim SharePoint uploads are live unless a connection is configured and tested.
- Do not claim assignment acknowledgement, reminders, or overdue digests; they are roadmap.
- Do not claim owner-editable per-person permissions; the role matrix is enforced but static.
- Do not claim live regulator scraping works in the venue; use the stored PDF and source link.
- Do not quote a finding count from memory. Read the screen.
- Do not invent ROI, accuracy, or customer numbers.
- Do not call it legal advice.
- Do not say "nothing can go wrong". Say "the core engine runs offline and fails visibly".

---

## Part 10 — The close, memorized

> "PolicyPulse turns a regulator PDF into a cited, severity-scored gap, gives an officer an
> editable redline, and records the decision forever. The core engine runs offline. The model is
> grounded and replaceable. A human always decides. Regulatory change, with receipts. Thank you."
