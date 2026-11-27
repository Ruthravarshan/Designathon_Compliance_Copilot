# 01 — Opportunity map

> Phase 01 · explore. Who actually feels this pain, what they do today, and what the demo must
> replace.

## Users and jobs

| User | Job to be done | Current workaround | Cost of failure |
| ---- | -------------- | ------------------ | --------------- |
| Head of Compliance (owner persona) | Decide what a new circular changes and sign off the response | Read the PDF, grep the policy wiki, email owners | Missed 6-hour reporting window; supervisory finding |
| CISO / security admin | Keep controls (VAPT, DR, incident reporting) aligned to regulation | Spreadsheet control register, annual audit | Control gap discovered by the regulator first |
| Compliance analyst | Prepare the evidence pack and answer "what does this clause require?" | Manual notes, chat threads, screenshots | Wrong paraphrase in a board note |
| Board audit committee (viewer) | See posture and that decisions are attributable | PDF pack before the meeting | No defensible decision trail |
| DPO / privacy lead | Find unconsented or unencrypted personal data before the DPDP clock starts | Manual data inventory, vendor questionnaires | DPDP penalties and breach-notification exposure |

## Jobs the product owns

1. Turn a clause into an obligation with a citation, an owner, and a deadline.
2. Show where the internal register disagrees, with severity and confidence.
3. Give the officer an editable redline and a one-click decision.
4. Leave an audit trail a regulator or auditor can read.
5. Answer employee policy questions only from approved sources, with citations.

## Alternatives today

| Alternative | Strength | Gap the demo exploits |
| ----------- | -------- | --------------------- |
| Manual PDF review + spreadsheet register | Cheap, familiar | No provenance, no SLA math, no audit spine, no review queue |
| Enterprise GRC suites (e.g. service-line modules) | Deep registers and workflows | Slow to adopt; obligation extraction is often a consulting project |
| RegTech point tools / legal research subscriptions | Strong source coverage | Stop at "what changed"; the internal gap and redline stay manual |
| LLM chat over documents | Fast drafting | No verifiable quote, no calibration, no auditable decision |

## Differentiation

- **Deterministic provenance:** every quote is re-checked as an exact substring of the source clause
  before it can be cited; the engine runs offline.
- **Calibrated confidence:** a published weighted formula, not an opaque model score.
- **Officer, not autopilot:** approve / edit / reject is a server-side RBAC action that writes a
  review event and an audit row; nothing publishes itself.
- **Two-tenant proof:** a second seeded workspace demonstrates isolation instead of asserting it.

## Assumptions to test in the demo

| Assumption | Test |
| ---------- | ---- |
| A clause-level citation is enough for an officer to trust a finding | Every finding page shows the verbatim clause and the mapped policy/control |
| Severity and deadline can be rule-derived | Seeded criticals reproduce the brief's 6h vs 72h and India-residency scenarios |
| Review is fast enough to be usable | Golden path approves a finding in one action and the audit row appears |
| Isolation is provable | Northwind persona sees an empty workspace and no cross-tenant records |

## Non-opportunities (deliberately cut)

- Live regulator scraping and RSS watchdog.
- Real PDF layout parsing (tables, annexures, bounding boxes).
- Jira/ServiceNow pushing (email outbox plus task record instead).
- Legal advice; the product drafts for human sign-off.

## Gate

- [x] Users, jobs, alternatives, and assumptions are named.
- [x] Differentiation is testable in the seeded demo.
- [x] Cuts are explicit, not accidental.

Next: `02-edge-cases.md`
