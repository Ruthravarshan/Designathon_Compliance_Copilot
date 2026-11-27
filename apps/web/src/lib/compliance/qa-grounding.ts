import { z } from "zod";
import { REFUSAL_ANSWER, type QaCitation } from "./qa";

/** The only accepted shape for a grounded answer. Unknown fields are rejected. */
export const groundedCandidateSchema = z
  .object({
    decision: z.enum(["answer", "insufficient"]),
    answer: z.string().trim().min(1).max(1_200),
    citations: z
      .array(
        z
          .object({
            passage: z.number().int().min(1).max(50),
            quote: z.string().trim().min(12).max(400),
          })
          .strict(),
      )
      .max(6),
  })
  .strict();

export type GroundedCandidate = z.infer<typeof groundedCandidateSchema>;

export interface GroundedPassage {
  id: string;
  label: string;
  text: string;
}

export interface VerifiedGroundedAnswer {
  answer: string;
  citations: QaCitation[];
  confidence: number;
  matched: boolean;
}

export const MAX_VERIFIED_CITATIONS = 3;

/**
 * Gemini's OpenAPI-schema subset; kept in sync with the Zod schema above.
 * `additionalProperties` is rejected by the provider (400) and is unnecessary:
 * the Zod `.strict()` parse after generation rejects unknown fields.
 */
export const GROUNDED_ANSWER_SCHEMA = {
  type: "OBJECT",
  properties: {
    decision: { type: "STRING", enum: ["answer", "insufficient"] },
    answer: { type: "STRING" },
    citations: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          passage: { type: "INTEGER" },
          quote: { type: "STRING" },
        },
        required: ["passage", "quote"],
      },
    },
  },
  required: ["decision", "answer", "citations"],
} as const;

/**
 * Unicode and whitespace normalization applied identically to passage and quote,
 * so formatting noise cannot reject a genuinely verbatim citation.
 */
export function normalizeQuote(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/[\u200B-\u200F\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function confidenceFor(count: number): number {
  return round2(Math.min(0.95, 0.7 + 0.08 * count));
}

/**
 * Enforces the answer contract: every citation must point at a retrieved
 * passage and quote a verbatim substring of it. Unverifiable citations are
 * dropped; if none survive, the answer is refused rather than shown ungrounded.
 */
export function verifyGroundedAnswer(
  candidate: GroundedCandidate,
  passages: readonly GroundedPassage[],
): VerifiedGroundedAnswer {
  if (candidate.decision === "insufficient") {
    return {
      answer: candidate.answer,
      citations: [],
      confidence: 0,
      matched: false,
    };
  }

  const verified: QaCitation[] = [];
  const seen = new Set<string>();

  for (const citation of candidate.citations) {
    if (verified.length >= MAX_VERIFIED_CITATIONS) {
      break;
    }
    const passage = passages[citation.passage - 1];
    if (!passage || seen.has(passage.id)) {
      continue;
    }
    const normalizedQuote = normalizeQuote(citation.quote);
    if (!normalizeQuote(passage.text).toLowerCase().includes(normalizedQuote.toLowerCase())) {
      continue;
    }
    seen.add(passage.id);
    verified.push({ id: passage.id, label: passage.label, quote: normalizedQuote });
  }

  if (verified.length === 0) {
    return {
      answer: REFUSAL_ANSWER,
      citations: [],
      confidence: 0,
      matched: false,
    };
  }

  return {
    answer: candidate.answer,
    citations: verified,
    confidence: confidenceFor(verified.length),
    matched: true,
  };
}
