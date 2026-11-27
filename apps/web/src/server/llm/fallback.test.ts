import { describe, expect, it } from "vitest";
import { deterministicExtraction } from "./fallback";

const text =
  "The bank shall complete a vulnerability assessment every six months. The bank shall report cyber incidents within six hours of detection.";

describe("deterministic fallback", () => {
  it("uses exact quotes from the supplied pages and never claims Gemini metadata", () => {
    const result = deterministicExtraction([
      { pageNumber: 1, text },
      { pageNumber: 2, text: "No obligations are stated on this page." },
    ]);

    expect(result.extraction.obligations.length).toBeGreaterThan(0);
    expect(result.extraction.title).toBeNull();
    expect(result.extraction.issuer).toBeNull();
    expect(result.extraction.needsReview).toBe(true);
    const quote = result.extraction.obligations[0]?.quotes[0];
    expect(quote?.citationVerified).toBe(true);
    expect(text.includes(quote?.quote ?? "")).toBe(true);
    expect(result.verifiedQuotes).toBeGreaterThan(0);
  });

  it("does not publish findings when no obligation is found", () => {
    const result = deterministicExtraction([
      { pageNumber: 1, text: "This page only contains a table of contents." },
    ]);
    expect(result.extraction.obligations).toHaveLength(0);
    expect(result.extraction.citationVerified).toBe(false);
    expect(result.extraction.needsReview).toBe(true);
  });
});
