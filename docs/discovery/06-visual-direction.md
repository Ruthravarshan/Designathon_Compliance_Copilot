# 06 — Visual direction

> Phase 06. The locked Hexaware system applied to a compliance workbench. Reference assets: none
> generated — the shipped screens are the reference (see fallback note).

## Design read

- **Audience:** a compliance officer, CISO, and board auditor. They read for evidence, not delight.
- **Job of the interface:** make provenance obvious and decisions feel consequential without drama.
- **Register:** precise, editorial, calm. Dense tables and monospace metadata; one saturated accent.
- **Anti-patterns rejected:** chatbot-first layout, gradient hero text, glassmorphism, fake dashboards,
  emoji status, dark-mode-only, purple-on-white "AI" clichés beyond the fixed Hexaware blue.

## Tokens (source of truth: `apps/web/src/app/globals.css`)

| Token | Value | Role |
| ----- | ----- | ---- |
| `--color-canvas` | `#f8f8f9` | Page field |
| `--color-surface` | `#ffffff` | Cards, panels |
| `--color-surface-2` | `#eeeff2` | Inset blocks, table header |
| `--color-line` | `#cbd0e5` | Hairlines and borders |
| `--color-fg` | `#040d43` | Primary text |
| `--color-muted` | `#535983` | Secondary text |
| `--color-brand` | `#3c2cda` | Hexaware blue; links, accents, focus |
| `--color-brand-hover` | `#3224bd` | Primary hover |
| `--color-brand-ink` | `#ffffff` | Text on brand |
| `--color-danger` | `#da2d2c` | Critical severity, destructive validation |

No component may hard-code a hex. Severity uses tokens: CRITICAL danger, HIGH brand, MEDIUM
surface-2, LOW muted.

## Type

- **Manrope Variable** for UI and headings; **Geist Mono** for metadata, references, counts, and
  dates. Mono is the "evidence" voice.
- Scale: `clamp` display headings on marketing surfaces; `text-3xl/4xl` page titles; 13–15px body in
  the workbench; 9–11px uppercase mono labels with `0.14em` tracking.
- Numbers are tabular via mono; no custom numerals.

## Layout

- Marketing: 1200px max width, asymmetric hero (copy + seeded finding render), proof cards, 5-step
  route, guardrail grid. A faint fixed grid field sits behind the hero.
- Workbench: sticky top bar, vertical nav on `lg`, horizontal scroll nav on mobile; content max width
  with 5-unit spacing rhythm; tables collapse to stacked cards under `xl`.
- Finding detail: two columns — evidence and redline left, confidence, remediation, review right.
- Empty, loading, error, and unauthorized states are designed, not incidental.

## Motion

- One entrance: `.rise` / `.rise-2` translate-and-fade on marketing sections.
- Transitions limited to color, border, and shadow (150–200ms). No layout animation in the
  workbench.
- `prefers-reduced-motion` removes entrance animation and smooth scrolling.
- Spinners only inside buttons with pending copy ("Recording decision").

## Interaction and accessibility

- Visible focus: 2px brand outline with 3px offset on every interactive element.
- Skip link to `#main`; landmarks (`header`, `main`, `nav`, `footer`); one `h1` per page.
- Severity never relies on color alone: text badge plus label.
- Redline uses `<del>/<ins>` with an `sr-only` legend and a visible removed/added key.
- Contrast: fg on canvas, muted on surface, white on brand meet WCAG AA at body sizes.
- Keyboard: forms are native controls; review options are buttons with `aria-pressed`.

## States inventory

| Surface | Loading | Empty | Error | Unauthorized |
| ------- | ------- | ----- | ----- | ------------ |
| App shell | `app/loading.tsx` skeleton | — | `error.tsx` with reset | redirect to `/signin` |
| Findings | route loading | "No findings yet." + clear filters | error boundary | 403 card with persona switch |
| Circulars | route loading | "No circulars ingested yet." | error boundary | read-only badge for non-ingest roles |
| Finding detail | route loading | not applicable | 404 "not in this workspace" | read-only review state |
| Audit | route loading | "No audit events yet." | error boundary | "The audit trail is restricted." |
| Data / Q&A | route loading | empty catalog / escalation answer | error boundary | 403 card |

## Reference assets and fallback

`docs/discovery/assets/` is empty. The image-generation phase skill was not run; per the runtime
fallback rule, the implementation follows `docs/DESIGN-SYSTEM.md` directly and the live seeded
screens serve as the reference. The landing hero contains an explicitly labelled illustrative
finding render; it is not presented as a screenshot.

## Gate

- [x] Design read names audience, tone, and rejected patterns.
- [x] Tokens match `globals.css` and the brand contract.
- [x] Motion and reduced-motion behaviour defined.
- [x] All data surfaces have loading/empty/error/unauthorized states.
- [x] Fallback for reference assets stated.

Next: `07-build-log.md`
