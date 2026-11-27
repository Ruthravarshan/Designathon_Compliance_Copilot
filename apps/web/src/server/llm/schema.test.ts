import { describe, expect, it } from "vitest";
import {
  candidateExtractionSchema,
  GEMINI_RESPONSE_SCHEMA,
  normalizeCandidate,
  OBLIGATION_TYPES,
} from "./schema";

const valid = {
  title: "Circular",
  issuer: "RBI",
  reference: "RBI/2026/1",
  summary: "A circular",
  publishedAt: "2026-01-02T00:00:00Z",
  effectiveAt: null,
  obligations: [
    {
      type: "SECURITY_TESTING",
      plainLanguage: "Run a test",
      actionRequired: "Run it",
      applicableTo: "CISO",
      quotes: [
        {
          quote: "The bank shall complete a vulnerability assessment every six months.",
          pageNumber: 1,
        },
      ],
    },
  ],
  policyAreas: ["security"],
  riskSuggestion: null,
};

describe("Gemini output schema", () => {
  it("accepts a conforming extraction", () => {
    expect(candidateExtractionSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects invented fields, bad page numbers and short quotes", () => {
    expect(candidateExtractionSchema.safeParse({ ...valid, invented: true }).success).toBe(false);
    expect(
      candidateExtractionSchema.safeParse({
        ...valid,
        obligations: [{ ...valid.obligations[0], quotes: [{ quote: "short", pageNumber: 0 }] }],
      }).success,
    ).toBe(false);
    expect(
      candidateExtractionSchema.safeParse({
        ...valid,
        obligations: [{ ...valid.obligations[0], quotes: [] }],
      }).success,
    ).toBe(false);
  });

  it("normalizes unparseable dates to null instead of guessing", () => {
    const candidate = candidateExtractionSchema.parse(valid);
    expect(normalizeCandidate(candidate).publishedAt).toBe("2026-01-02");
    expect(
      normalizeCandidate(candidateExtractionSchema.parse({ ...valid, publishedAt: "not a date" }))
        .publishedAt,
    ).toBeNull();
  });

  it("keeps the response schema aligned with the obligation union", () => {
    const properties = GEMINI_RESPONSE_SCHEMA.properties.obligations.items.properties;
    expect(properties.type.enum).toEqual([...OBLIGATION_TYPES]);
  });
});
