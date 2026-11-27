import { extractObligations } from "@/lib/compliance/extract";
import type {
  ExtractedObligation,
  PdfPage,
  VerifiedExtraction,
  VerifiedQuote,
} from "@/server/ingestion/types";
import { normalizeForQuote } from "./verify";

export interface FallbackResult {
  extraction: VerifiedExtraction;
  verifiedQuotes: number;
  unverifiedQuotes: number;
}

/**
 * Deterministic extraction over the exact same pages. It is labelled FALLBACK
 * by the caller; no Gemini claim is ever made for this output.
 */
export function deterministicExtraction(pages: readonly PdfPage[]): FallbackResult {
  const normalizedPages = pages.map((page) => ({
    pageNumber: page.pageNumber,
    text: normalizeForQuote(page.text),
  }));

  const obligations: ExtractedObligation[] = [];
  let verifiedQuotes = 0;
  let unverifiedQuotes = 0;

  for (const page of pages) {
    const extracted = extractObligations({
      sectionLabel: "",
      pageNumber: page.pageNumber,
      text: page.text,
    });
    for (const item of extracted) {
      const matches = normalizedPages.filter((candidate) =>
        candidate.text.includes(normalizeForQuote(item.quote)),
      );
      const quotes: VerifiedQuote[] = matches.map((match) => ({
        quote: item.quote,
        pageNumber: match.pageNumber,
        citationVerified: true,
      }));
      if (matches.length > 0) {
        verifiedQuotes += matches.length;
      } else {
        unverifiedQuotes += 1;
      }
      obligations.push({
        type: item.type,
        plainLanguage: item.plainLanguage,
        actionRequired: item.actionRequired,
        applicableTo: item.applicableTo,
        quotes,
        citationVerified: quotes.length > 0,
      });
    }
  }

  const citationVerified =
    obligations.length > 0 && obligations.every((obligation) => obligation.citationVerified);
  const extraction: VerifiedExtraction = {
    // Metadata is unknown to the deterministic engine; never guess it.
    title: null,
    issuer: null,
    reference: null,
    summary: null,
    publishedAt: null,
    effectiveAt: null,
    obligations,
    policyAreas: [],
    riskSuggestion: null,
    citationVerified,
    needsReview: true,
  };

  return { extraction, verifiedQuotes, unverifiedQuotes };
}
