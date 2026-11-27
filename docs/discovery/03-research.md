# 03 — Research

> Phase 03. Sources, prior art, and build-vs-borrow decisions. Source text in the demo is a
> representative excerpt, not a legal reproduction; the source URL on each document points to the
> regulator site.

## Regulatory sources used

| Regulator | Instrument (as labelled in the demo) | Excerpt focus | Source |
| --------- | ------------------------------------ | ------------- | ------ |
| IRDAI | Information and Cyber Security Guidelines, 2023 (`IRDAI/IT/CYBER/2023`) | Six-hour incident reporting; Board oversight | https://irdai.gov.in/ |
| RBI | Guidelines on Information Security and Data Localisation (`RBI/IT/2023/07`) | Half-yearly VAPT, India storage, right to audit | https://www.rbi.org.in/ |
| CERT-In / MeitY | Directions on Cyber Incident Reporting and Logs (`CERT-IN/2022/01`) | Six-hour reporting; 180-day logs | https://www.cert-in.org.in/ |
| SEBI | Cyber Security and Cyber Resilience Framework (`SEBI/HO/ITD/CSCR/2023`) | Half-yearly DR drills; Risk Management Committee | https://www.sebi.gov.in/ |
| MeitY | Digital Personal Data Protection Act, 2023 (`DPDP/2023/ACT`) | Consent withdrawal, erasure, grievance contact | https://www.meity.gov.in/ |

The demo does not claim PDF-perfect reproduction: it bundles short clause excerpts with page and
section labels, which is enough to exercise extraction, mapping, and citation verification.

## Prior art

| Category | Examples | What we borrow | What we do differently |
| -------- | -------- | -------------- | ---------------------- |
| GRC platforms | Vanta, Drata, service-line GRC modules | Control register, evidence mindset, owner tasks | Clause-first extraction with a visible source quote |
| Legal research | Regulator portals, legal databases | Source authority and citation discipline | Machine-scored gap + redline, not just search |
| LLM document chat | Retrieval-augmented chat over PDFs | Fast drafting and plain language | Verified substrings, published confidence formula, audited decisions |
| Contract redlining | Word/Google Docs compare | Before/after diff affordance | Redline is tied to a regulatory obligation and an owner task |

## Technical research

- **PDF parsing:** Docling/Unstructured/LlamaParse are strong but network- and model-heavy. The demo
  ingests pasted text with `[Page N] Section X` conventions and a deterministic parser, keeping the
  golden path offline.
- **Hybrid retrieval:** vector + BM25 is the right long-term mapper. For 13 seeded obligations, a
  deterministic tag/term/attribute scorer is more explainable and testable.
- **Confidence calibration:** the brief proposes 0.40 quote verification + 0.35 cosine similarity +
  0.25 critic entailment. The build keeps the 40/35/25 weights but substitutes a transparent rule
  certainty term for critic entailment, because there is no model in the loop. Documented on every
  finding.
- **Audit patterns:** append-only review events plus a separate workspace audit log; both carry
  actor, entity, and metadata; no edit/delete affordance in the UI.

## Build vs borrow

| Need | Decision | Why |
| ---- | -------- | --- |
| Document parsing | Build (deterministic) | Offline reliability; PDF layout is out of scope |
| Obligation extraction | Build (rules + number words) | Testable, explainable, no API key |
| Policy mapping | Build (tag/term/attribute scoring) | Small corpus; deterministic tie-breaks |
| Gap severity | Build (typed rules) | Must be reproducible in tests |
| Redline diff | Build (word diff) | No external dependency; renders with `<del>/<ins>` |
| Email delivery | Borrow (outbox + SMTP/Mailpit) | Table stakes; already scaffolded |
| Auth | Build demo sessions (HMAC cookie) | Persona switching for the demo; production SSO out of scope |
| UI system | Borrow scaffold tokens; build product screens | Brand contract is fixed |

## Risks surfaced by research

1. Judges may expect literal multi-agent LLM framing; the submission must state the deviation and
   defend determinism on traceability.
2. Regulatory text is sensitive; the demo uses excerpts and labels them illustrative, not advice.
3. Regex extraction will miss unusual phrasing; the fallback is an explicit `manual_review`
   obligation rather than a guessed one.

Next: `04-enhanced-problem-statement.md`
