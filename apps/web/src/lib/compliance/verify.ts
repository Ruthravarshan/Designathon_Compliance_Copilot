export interface CitationCheck {
  verified: boolean;
  reason: string;
}

/**
 * A citation is credible only when the quote is a character-for-character
 * substring of the ingested clause. No fuzzy matching is allowed here.
 */
export function verifyCitation(sourceText: string, quote: string): CitationCheck {
  const normalizedSource = sourceText.trim();
  const normalizedQuote = quote.trim();

  if (normalizedQuote.length < 12) {
    return { verified: false, reason: "Quote is too short to verify." };
  }

  if (normalizedSource.includes(normalizedQuote)) {
    return { verified: true, reason: "Quote is an exact substring of the source clause." };
  }

  return {
    verified: false,
    reason: "Quote is not an exact substring of the source clause. Route to manual review.",
  };
}

export function criticNotes(check: CitationCheck, mapped: boolean): string {
  const mappingNote = mapped
    ? "Internal mapping found."
    : "No internal mapping met the threshold; a control owner is assigned.";
  return `${check.reason} ${mappingNote}`;
}
