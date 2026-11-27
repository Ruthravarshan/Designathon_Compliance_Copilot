import { z } from "zod";
import type { ObligationType } from "@/lib/compliance/types";

export const OBLIGATION_TYPES = [
  "SECURITY_TESTING",
  "INCIDENT_REPORTING",
  "DATA_LOCALIZATION",
  "CONSENT",
  "DATA_RETENTION",
  "THIRD_PARTY_AUDIT",
  "CRYPTOGRAPHY",
  "RESILIENCE",
  "LOGGING",
  "GOVERNANCE",
  "GRIEVANCE",
  "OTHER",
] as const satisfies readonly ObligationType[];

const nullableText = (max: number): z.ZodNullable<z.ZodString> => z.string().trim().max(max).nullable();

export const candidateQuoteSchema = z
  .object({
    quote: z.string().trim().min(12).max(1_200),
    pageNumber: z.number().int().min(1).max(500),
    sectionLabel: nullableText(120).optional(),
  })
  .strict();

export const candidateObligationSchema = z
  .object({
    type: z.enum(OBLIGATION_TYPES).nullable(),
    plainLanguage: z.string().trim().min(1).max(1_000),
    actionRequired: z.string().trim().min(1).max(1_000),
    applicableTo: nullableText(200),
    quotes: z.array(candidateQuoteSchema).min(1).max(8),
  })
  .strict();

/** The only accepted Gemini output. Unknown fields are rejected, not guessed. */
export const candidateExtractionSchema = z
  .object({
    title: nullableText(300),
    issuer: nullableText(200),
    reference: nullableText(200),
    summary: nullableText(2_000),
    publishedAt: nullableText(40),
    effectiveAt: nullableText(40),
    obligations: z.array(candidateObligationSchema).max(60),
    policyAreas: z.array(z.string().trim().min(1).max(80)).max(20),
    riskSuggestion: nullableText(1_000),
  })
  .strict();

export type CandidateExtraction = z.infer<typeof candidateExtractionSchema>;
export type CandidateObligation = z.infer<typeof candidateObligationSchema>;
export type CandidateQuote = z.infer<typeof candidateQuoteSchema>;

function isoDate(value: string | null): string | null {
  if (value === null) {
    return null;
  }
  const match = /^(\d{4}-\d{2}-\d{2})(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?)?$/.exec(
    value.trim(),
  );
  const day = match?.[1];
  if (!day) {
    return null;
  }
  const date = new Date(`${day}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : day;
}

/** Dates are normalized to YYYY-MM-DD; an unparseable value becomes null, never invented. */
export function normalizeCandidate(candidate: CandidateExtraction): CandidateExtraction {
  return {
    ...candidate,
    publishedAt: isoDate(candidate.publishedAt),
    effectiveAt: isoDate(candidate.effectiveAt),
  };
}

/** Gemini's OpenAPI-schema subset. Kept in sync with the Zod schema above. */
export const GEMINI_RESPONSE_SCHEMA = {
  type: "OBJECT",
  additionalProperties: false,
  properties: {
    title: { type: "STRING", nullable: true },
    issuer: { type: "STRING", nullable: true },
    reference: { type: "STRING", nullable: true },
    summary: { type: "STRING", nullable: true },
    publishedAt: { type: "STRING", nullable: true },
    effectiveAt: { type: "STRING", nullable: true },
    obligations: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        additionalProperties: false,
        properties: {
          type: { type: "STRING", nullable: true, enum: [...OBLIGATION_TYPES] },
          plainLanguage: { type: "STRING" },
          actionRequired: { type: "STRING" },
          applicableTo: { type: "STRING", nullable: true },
          quotes: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              additionalProperties: false,
              properties: {
                quote: { type: "STRING" },
                pageNumber: { type: "INTEGER" },
                sectionLabel: { type: "STRING", nullable: true },
              },
              required: ["quote", "pageNumber"],
            },
          },
        },
        required: ["type", "plainLanguage", "actionRequired", "applicableTo", "quotes"],
      },
    },
    policyAreas: { type: "ARRAY", items: { type: "STRING" } },
    riskSuggestion: { type: "STRING", nullable: true },
  },
  required: [
    "title",
    "issuer",
    "reference",
    "summary",
    "publishedAt",
    "effectiveAt",
    "obligations",
    "policyAreas",
    "riskSuggestion",
  ],
} as const;
