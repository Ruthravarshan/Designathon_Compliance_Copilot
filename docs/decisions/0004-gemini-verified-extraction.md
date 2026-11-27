# ADR 0004: Gemini extraction with deterministic verification

- Status: Accepted
- Date: 2026-11-27
- Deciders: Owner, OpenCode ingestion, Qoder backend

## Context

The owner requires the free Gemini API for LLM calls. The v1 product deliberately used a deterministic
engine for offline reliability, but the new brief includes live PDF ingestion and real extraction. A
compliance product cannot publish a model paraphrase without provenance. The source key format is not
the classic `AIza…` form, so the exact endpoint/mode must be verified before implementation.

## Decision

1. **Gemini is used server-side only** through a small REST adapter. The key is never in the client
   bundle, logs, docs, or error messages. The model name, prompt version, and enable/disable flag come
   from workspace settings; the key comes from env/Vercel secrets.
2. **The LLM produces structured JSON only** (title, issuer, reference, dates, summary, obligations,
   exact quote, page, section, applicability, confidence). A versioned prompt treats the document as
   untrusted and forbids tool use or instruction-following from the document.
3. **Every quote is verified** against extracted source text (whitespace-normalized exact substring).
   Invalid JSON, missing fields, or unverified quotes mark the document `NEEDS_REVIEW`; they are never
   silently accepted or auto-published.
4. **The deterministic engine remains the verifier and fallback.** Mapping, gap severity, redline,
   citation checks, and review rules stay explainable. If Gemini is unavailable or over quota, the
   deterministic path runs and the document records that AI was unavailable.
5. **LLM work runs in the ingestion worker, never in a page or request path.** Jobs are queued,
   retried with bounded backoff, and observably logged (model, prompt version, latency, tokens, safe
   error).
6. **Data boundary:** only public regulatory circulars go to the free tier by default. Internal policy
   Q&A is opt-in and disabled if the owner does not accept the free-tier data-use terms. No customer
   data or secrets are sent.

## Consequences

Positive:

- Real extraction and summaries with a hard citation gate.
- Quota/outage resilience; the demo can still ingest and show verified deterministic output.
- Auditable model/prompt/version and safe failure states.

Negative:

- Free-tier quotas, rate limits, data-use terms, and key restrictions can change.
- PDF text extraction quality affects verification; scanned PDFs may need a later OCR/vision path.
- A model response can still be incomplete; the UI must expose `NEEDS_REVIEW` and confidence.

Mitigations:

- Verify the provided key/mode with a real smoke test before the demo.
- Queue one document at a time per run; cap documents per run; back off on 429.
- Keep an owner-visible AI status and a deterministic fallback.
- For production, use a paid Gemini or Vertex AI tier with appropriate data terms.

## Alternatives considered

- **Deterministic only:** rejected; the owner explicitly requires Gemini.
- **Paid GPT/Claude:** rejected for now on cost; the owner chose Gemini free tier.
- **Local model:** too heavy for the deploy target and timebox.
- **Unverified LLM output:** rejected; violates the citation-fidelity guardrail.

## Follow-up

- Record the real key mode, model, quota behavior, and smoke result in the build log.
- Revisit OCR/vision for scanned PDFs.
- Revisit the provider/tier before any production or customer-data use.