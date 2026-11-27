import type {
  ExtractedObligation,
  PdfPage,
  VerifiedExtraction,
  VerifiedQuote,
} from "@/server/ingestion/types";
import type { CandidateExtraction } from "./schema";

const MIN_QUOTE_LENGTH = 12;

/** Unicode + whitespace normalization applied identically to source and quote. */
export function normalizeForQuote(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/[\u200B-\u200F\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export interface VerificationOptions {
  minQuoteLength?: number;
  /** PDF quality signal from the parser; a low-text-layer document is always review-only. */
  documentNeedsReview?: boolean;
}

export interface VerificationSummary {
  extraction: VerifiedExtraction;
  verifiedQuotes: number;
  unverifiedQuotes: number;
  needsReview: boolean;
}

/**
 * Every quote must be an exact substring of its own cited page. No fuzzy
 * matching, no whole-document fallback, and no publishing of invented quotes.
 */
export function verifyExtraction(
  candidate: CandidateExtraction,
  pages: readonly PdfPage[],
  options: VerificationOptions = {},
): VerificationSummary {
  const minLength = options.minQuoteLength ?? MIN_QUOTE_LENGTH;
  const pageTexts = new Map<number, string>();
  for (const page of pages) {
    pageTexts.set(page.pageNumber, normalizeForQuote(page.text));
  }

  let verifiedQuotes = 0;
  let unverifiedQuotes = 0;

  const verifyQuote = (quote: {
    quote: string;
    pageNumber: number;
    sectionLabel?: string | null;
  }): VerifiedQuote => {
    const pageText = pageTexts.get(quote.pageNumber);
    const normalized = normalizeForQuote(quote.quote);
    const verified =
      pageText !== undefined && normalized.length >= minLength && pageText.includes(normalized);
    if (verified) {
      verifiedQuotes += 1;
    } else {
      unverifiedQuotes += 1;
    }
    return {
      quote: quote.quote,
      pageNumber: quote.pageNumber,
      ...(quote.sectionLabel ? { sectionLabel: quote.sectionLabel } : {}),
      citationVerified: verified,
    };
  };

  const obligations: ExtractedObligation[] = candidate.obligations.map((obligation) => {
    const quotes = obligation.quotes.map(verifyQuote);
    return {
      type: obligation.type,
      plainLanguage: obligation.plainLanguage,
      actionRequired: obligation.actionRequired,
      applicableTo: obligation.applicableTo,
      quotes,
      citationVerified:
        quotes.length > 0 && quotes.some((quote) => quote.citationVerified) && quotes.every((quote) => quote.citationVerified),
    };
  });

  const allQuotesVerified = unverifiedQuotes === 0;
  const everyObligationCited = obligations.every((obligation) => obligation.citationVerified);
  const citationVerified =
    obligations.length > 0 && allQuotesVerified && everyObligationCited;
  const needsReview =
    options.documentNeedsReview === true ||
    !citationVerified ||
    candidate.title === null ||
    candidate.issuer === null;

  return {
    extraction: {
      title: candidate.title,
      issuer: candidate.issuer,
      reference: candidate.reference,
      summary: candidate.summary,
      publishedAt: candidate.publishedAt,
      effectiveAt: candidate.effectiveAt,
      obligations,
      policyAreas: candidate.policyAreas,
      riskSuggestion: candidate.riskSuggestion,
      citationVerified,
      needsReview,
    },
    verifiedQuotes,
    unverifiedQuotes,
    needsReview,
  };
}
