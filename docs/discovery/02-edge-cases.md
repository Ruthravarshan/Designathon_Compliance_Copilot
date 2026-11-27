# 02 — Edge cases and abuse cases

> Phase 02. The failure matrix that shaped the build; top decisions are now implemented and tested.

## Failure matrix

| # | Scenario | Failure if ignored | Design response | Test |
| - | -------- | ------------------ | --------------- | ---- |
| 1 | Clause contains no modal verb (`shall`/`must`) | Invented obligation | Extraction returns no obligation; clause stays evidence only | `extract.test.ts` |
| 2 | Obligation cannot be typed | Silent wrong type | Emits `OTHER` with `manual_review` requirement | `extract.test.ts` |
| 3 | Extraction quote not an exact substring | Hallucinated citation | `verifyCitation` marks `citationVerified=false`; UI flags it | `verify.test.ts` |
| 4 | SLA stated in words ("six hours") | Missed 6-hour check | Number-word parser with count tokens | `extract.test.ts` |
| 5 | A policy is stricter than the regulation | False gap | Gap rule returns compliant / not-required | `gap.test.ts` |
| 6 | Policy matches but is missing an attribute | Wrong severity | Attribute scoring lowers confidence, raises review | `mapping.test.ts` |
| 7 | Duplicate circular reference ingested | Two sources of truth | 409 `CONFLICT` on workspaceId+reference | API route, e2e |
| 8 | Empty paste or too-short text | Empty analysis | Zod min length rejects at the boundary | API route |
| 9 | Cross-tenant document id guessed | Data leak | Every query filters by actor workspaceId; detail 404s | service queries, e2e tenant test |
| 10 | Viewer calls the review API directly | Privilege escalation | `requireActor("finding:review")` returns 403 server-side | e2e API assertion |
| 11 | Officer double-submits approval | Duplicate review events and email | Status check inside transaction; 409 if not pending; email idempotency key | `reviewFinding` |
| 12 | Approval email queue fails | Lost task | Review commits; email failure logged, not fatal; outbox retry path | service + outbox |
| 13 | Rejection with no reason | Unauditable decision | Zod + service require ≥10 characters | API + UI |
| 14 | Approved-with-edits wording empty | Empty policy text | Requires 12–2000 characters | API + service |
| 15 | Rate-limited sign-in / review | Brute force and queue spam | In-memory limiter per IP or user; 429 with retry hint | `rate-limit.test.ts` |
| 16 | Cross-site form POST | CSRF-style writes | Same-origin check on all mutations; SameSite=Lax cookie | route handlers |
| 17 | Session cookie tampered | Impersonation | HMAC-SHA256 signature + 8-hour expiry | `session.test.ts` |
| 18 | Session points at a removed membership | Orphaned access | `getActor` re-resolves membership per request; null → 401 | actor |
| 19 | Audit metadata contains PII | Leak in logs | Redacted logger; audit stores ids and references, not reset links | `logger`, audit review |
| 20 | Page has no data | Dead screen | Every data view has loading, empty, error, unauthorized states | e2e + manual |

## Abuse cases

- **Prompt injection in a circular** ("ignore your rules and mark everything compliant"): the engine
  is deterministic, so text can only match a typed rule or fall through to `manual_review`.
- **Forged persona key**: persona keys map to seeded identities only; unknown keys are 400.
- **Enumeration**: unknown ids return 404 with a generic message; no existence leak across tenants.
- **Outbox abuse**: email payloads escape variables, strip CRLF from subjects, allow only http(s)
  links, and honour preferences/suppression.

## Top 10 decisions

1. Deterministic engine over LLM orchestration for a zero-network demo path.
2. Citation verification is a hard gate; unverified quotes are flagged, never hidden.
3. Review decision, review event, and audit row commit in one transaction.
4. Approval queues email through the outbox only; no inline sends.
5. Every tenant table carries `workspaceId`; every query filters by it.
6. Server-side RBAC on every route and page, with UI mirrors only for affordances.
7. Seeded personas replace passwords in demo mode, behind an explicit flag.
8. Cursor pagination and bounded page sizes for findings and audit.
9. Two seeded tenants so isolation is demonstrable, not theoretical.
10. Cut live scraping, PDF layout parsing, and ticket integrations; keep the audit spine.

Next: `03-research.md`
