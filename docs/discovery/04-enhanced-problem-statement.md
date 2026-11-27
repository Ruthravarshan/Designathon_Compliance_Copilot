# 04 — Enhanced problem statement

> **Status:** v1 scope, kept as history. PolicyPulse v2 supersedes the roles
> (`MEMBER`/`VIEWER` → `EMPLOYEE`/`AUDITOR`), the demo-only data boundary, and the product surface;
> build from [00 revision 2](00-problem-statement.md#revision-2--policypulse-2026-11-27) and
> [05](05-solution-design.md).

> Phase 04. Scoped, testable definition that matches what shipped in `apps/web` (v1).

## Problem

Indian financial and data-protection regulation changes faster than compliance teams can read it.
Teams manually translate a circular into obligations, find the internal policy or control it touches,
judge the gap, and chase owners. The failure mode is not "no document search"; it is an unverifiable
decision: a paraphrase with no clause, a gap with no severity rationale, and a review with no audit
trail.

## Users

| User | Primary job | Success looks like |
| ---- | ----------- | ------------------ |
| Head of Compliance (OWNER) | Sign off findings and own the register | Approves or edits a finding in one action; decision is audited |
| CISO (ADMIN) | Own security findings and remediation | Sees the mapped control, the gap reason, and the owner task |
| Compliance analyst (MEMBER) | Prepare evidence; answer policy questions | Clause-level detail and grounded Q&A, no review rights |
| Board audit committee (VIEWER) | Oversee without mutating | Read-only findings and circulars; audit trail restricted |
| DPO / privacy lead (OWNER in demo) | Find DPDP exposure | Data scan flags unconsented, unencrypted fields with citations |

## Solution thesis

Parse a circular into citable clauses; extract atomic obligations with a verbatim quote; verify the
quote as an exact substring; map to an internal policy or control with an explainable score; apply a
typed gap rule for status, severity, deadline, and redline; then require an authorized officer to
approve, edit, or reject. Every step leaves a record: clause, obligation, finding, review event,
audit row, and queued email.

## Scope in (shipped)

- Seeded corpus: 5 circulars, 4 policies, 4 controls, 13 findings, 12 data-catalog fields.
- Ingestion UI + API for pasted clause text with page/section labels.
- Deterministic extraction, citation verification, mapping, gap rules, and word-level redline.
- Officer review with approve / approve-with-edits / reject and immutable history.
- Remediation task record and outbox email on approval.
- Policy Q&A grounded only in the internal register and ingested clauses, with citations.
- DPDP data-field scan with rule-based risk, encryption, and consent checks.
- Audit trail page for owners/admins; workspace isolation with a second seeded tenant.
- Role-aware navigation and complete loading / empty / error / unauthorized states.

## Scope out

- Live regulator scraping, RSS watchdog, PDF layout parsing, vector search.
- Publishing policy changes automatically; ticket creation in Jira/ServiceNow.
- Production SSO, passwords, billing, member invites by email (scaffold only).
- Legal advice or regulator filings.

## User stories and acceptance criteria

### Story 1 — Extract with provenance

As a compliance analyst, I want each obligation to carry its exact clause, so that I can defend it.
- Given a clause containing "shall", when ingested, then an obligation exists with a quote that is a
  verified substring of the clause.
- Given a clause with no modal verb, when ingested, then no finding is produced for it.
- Given an unsupported phrasing, when typed extraction fails, then the obligation is `OTHER` with a
  `manual_review` requirement, not a guessed gap.

### Story 2 — Decide a gap with an explanation

As a CISO, I want severity and deadline to be rule-derived, so that the queue is reproducible.
- Given the seeded IRDAI clause (6 hours) and `POL-SEC-02` (72 hours), then a CRITICAL finding is
  produced with a redline from 72 to 6 hours.
- Given an RBI India-storage clause and an ap-southeast-1 policy, then a CRITICAL localization gap
  is produced.
- Given a compliant control, then the finding is `NOT_REQUIRED` and no review is requested.

### Story 3 — Review with accountability

As the Head of Compliance, I want to approve, edit, or reject with a reason, so that the decision is
defensible.
- Given a pending finding and an OWNER, when I approve, then status becomes APPROVED, a review event
  is written, an audit row is written, and one remediation email is queued.
- Given a VIEWER, when they call the review API, then the server returns 403.
- Given an already-reviewed finding, when I submit again, then the server returns 409.
- Given a rejection with fewer than 10 characters, then the server returns 400.

### Story 4 — Isolate tenants

As a buyer, I want a second workspace to be invisible, so that I can trust multi-tenancy.
- Given the Northwind persona, then findings and circulars are empty and no Hexa Demo record is
  reachable.

### Story 5 — Answer and scan with citations

As an analyst, I want policy Q&A and DPDP discovery to cite sources, so that answers are checkable.
- Given a question, then the answer lists the policy/control or clause it used and escalates when the
  sources do not cover it.
- Given a catalogued field, then the scan returns risk level, encryption/consent status, a finding,
  and a citation.

## RBAC

| Role | Permissions | Cannot do |
| ---- | ----------- | --------- |
| OWNER | All permissions | — |
| ADMIN | Workspace/member management, ingestion, review, Q&A, scan, audit read | Delete workspace, billing |
| MEMBER | Read workspace, members, documents, findings; ask Q&A | Ingest, review, scan, audit |
| VIEWER | Read workspace, members, documents, findings | Everything else, including audit |

Guards: server-side `assertCan`; role is read from the membership row per request; no client-supplied
role is trusted.

## Email events

| Event | Recipient | Trigger | Category |
| ----- | --------- | ------- | -------- |
| `welcome` | Owner (seeded) | Seed | product |
| `finding.remediation_task` | Mapped control owner | Approval with a task email | product |
| Invitation / role change / removal / password reset | Scaffold members | Scaffold flows | transactional |
| `notification.digest` | Member | Scaffold digest | product |

All sends go through the outbox with an idempotency key; approval email failure does not roll back
the review.

## Success metrics (demo-measured)

| Metric | Target | Evidence |
| ------ | ------ | -------- |
| Citation fidelity on seeded corpus | 100% | Every seeded obligation is `citationVerified`; unverified quotes flag in UI |
| Seeded findings reproducing brief scenarios | 4 of 4 | IRDAI 6h, RBI India, DPDP consent, VA cadence |
| Review decision completeness | 100% | Review event + audit row + email per approval (`e2e/owner-review.spec.ts`) |
| Role and tenant enforcement | 100% denied | `e2e/golden-path.spec.ts` 403 and empty-workspace assertions |
| Unit coverage | ≥95% per file | `npm run test:coverage` |
| Autonomous publishes | 0 | No policy publish endpoint exists |

## Non-goals

- Replace a lawyer; the officer remains the decision-maker.
- Guarantee extraction over arbitrary PDFs; the demo corpus is controlled.
- Production-scale ingestion or regulator monitoring.

## Risks

- Deterministic rules are narrow; the fallback is explicit manual review.
- Demo auth is persona-based; it is gated by `DEMO_MODE` and not a production login.
- Confidence weights are a documented substitute for model entailment.

Next: `05-solution-design.md`
