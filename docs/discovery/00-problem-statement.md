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
