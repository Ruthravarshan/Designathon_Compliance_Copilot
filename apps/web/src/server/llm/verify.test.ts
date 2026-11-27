import { describe, expect, it } from "vitest";
import type { PdfPage } from "@/server/ingestion/types";
import { normalizeForQuote, verifyExtraction } from "./verify";
import { candidateExtractionSchema } from "./schema";

const pages: PdfPage[] = [
  {
    pageNumber: 1,
    text: "The bank shall complete a vulnerability assessment every six months. Section 4 applies to all banks.",
  },
  {
    pageNumber: 2,
    text: "The bank shall report incidents within six hours of detection. Section 5 applies to all banks.",
  },
];

function candidate(quote: string, pageNumber: number, overrides: Record<string, unknown> = {}) {
  const parsed = candidateExtractionSchema.safeParse({
    title: "Circular",
    issuer: "RBI",
    reference: null,
    summary: null,
    publishedAt: "2026-01-02",
    effectiveAt: null,
    obligations: [
      {
        type: "SECURITY_TESTING",
        plainLanguage: "Run a test",
        actionRequired: "Run it",
        applicableTo: null,
        quotes: [{ quote, pageNumber }],
      },
    ],
    policyAreas: [],
    riskSuggestion: null,
    ...overrides,
  });
  if (!parsed.success) {
    throw new Error("test candidate is invalid");
  }
  return parsed.data;
}

describe("quote verification", () => {
  it("normalizes unicode and whitespace identically", () => {
    expect(normalizeForQuote("Ａ\u00a0bank\tshall\ncomplete")).toBe("A bank shall complete");
  });

  it("verifies an exact quote on its cited page", () => {
    const result = verifyExtraction(
      candidate("bank shall complete a vulnerability assessment", 1),
      pages,
    );
    expect(result.verifiedQuotes).toBe(1);
    expect(result.unverifiedQuotes).toBe(0);
    expect(result.extraction.citationVerified).toBe(true);
    expect(result.extraction.needsReview).toBe(false);
    expect(result.extraction.obligations[0]?.quotes[0]).toMatchObject({
      pageNumber: 1,
      citationVerified: true,
    });
  });

  it("accepts a quote that differs only by normalized whitespace", () => {
    const result = verifyExtraction(candidate("bank  shall\tcomplete a\nvulnerability assessment", 1), pages);
    expect(result.extraction.obligations[0]?.quotes[0]?.citationVerified).toBe(true);
  });

  it("rejects a wrong page, an out-of-range page and an invented quote", () => {
    const quote = "bank shall complete a vulnerability assessment";
    expect(verifyExtraction(candidate(quote, 2), pages).extraction.citationVerified).toBe(false);
    expect(verifyExtraction(candidate(quote, 99), pages).extraction.citationVerified).toBe(false);
    expect(
      verifyExtraction(candidate("The bank shall fund a new data centre.", 1), pages).extraction.citationVerified,
    ).toBe(false);
  });

  it("rejects a quote that spans two pages", () => {
    const spanning = "vulnerability assessment every six months. Section 5 applies";
    const result = verifyExtraction(candidate(spanning, 1), pages);
    expect(result.unverifiedQuotes).toBe(1);
    expect(result.extraction.obligations[0]?.citationVerified).toBe(false);
    expect(result.needsReview).toBe(true);
  });

  it("requires every quote in an obligation to verify", () => {
    const result = verifyExtraction(
      candidate("bank shall complete a vulnerability assessment", 1, {
        obligations: [
          {
            type: "SECURITY_TESTING",
            plainLanguage: "Run a test",
            actionRequired: "Run it",
            applicableTo: null,
            quotes: [
              { quote: "bank shall complete a vulnerability assessment", pageNumber: 1 },
              { quote: "this sentence was invented by the model", pageNumber: 1 },
            ],
          },
        ],
      }),
      pages,
    );
    expect(result.verifiedQuotes).toBe(1);
    expect(result.unverifiedQuotes).toBe(1);
    expect(result.extraction.obligations[0]?.citationVerified).toBe(false);
  });

  it("honours the PDF quality signal and unknown metadata", () => {
    const good = candidate("bank shall complete a vulnerability assessment", 1);
    expect(
      verifyExtraction(good, pages, { documentNeedsReview: true }).extraction.needsReview,
    ).toBe(true);
    expect(
      verifyExtraction(candidate("bank shall complete a vulnerability assessment", 1, { title: null }), pages)
        .extraction.needsReview,
    ).toBe(true);
  });
});
