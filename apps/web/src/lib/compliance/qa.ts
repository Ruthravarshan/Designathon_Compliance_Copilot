export interface QaSource {
  id: string;
  label: string;
  kind: "policy" | "control" | "clause";
  text: string;
}

export interface QaCitation {
  id: string;
  label: string;
  quote: string;
}

export interface QaAnswer {
  answer: string;
  citations: QaCitation[];
  confidence: number;
  matched: boolean;
}

const QUESTION_STOPWORDS = new Set([
  "what",
  "which",
  "where",
  "when",
  "why",
  "how",
  "does",
  "our",
  "your",
  "the",
  "and",
  "for",
  "with",
  "that",
  "this",
  "from",
  "are",
  "is",
  "we",
  "us",
  "do",
  "should",
  "must",
  "can",
  "please",
  "tell",
  "about",
  "policy",
  "policies",
  "require",
  "requires",
  "required",
  "requirement",
  "under",
  "current",
  "currently",
]);

const MAX_CITATIONS = 3;
const MAX_QUOTE_LENGTH = 240;

const KIND_RANK: Record<QaSource["kind"], number> = {
  policy: 3,
  control: 2,
  clause: 1,
};

function tokenize(text: string): Set<string> {
  const words = text.toLowerCase().match(/[a-z][a-z-]{2,}/g) ?? [];
  return new Set(words.filter((word) => !QUESTION_STOPWORDS.has(word)));
}

function firstSentence(text: string): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  const sentence = normalized.split(/(?<=[.!?])\s/, 1).join("");
  return sentence.length > MAX_QUOTE_LENGTH
    ? `${sentence.slice(0, MAX_QUOTE_LENGTH - 3)}...`
    : sentence;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Retrieve a grounded answer from the internal register and ingested clauses.
 * No generation: the answer quotes the best-matching passage and lists its
 * citations. If nothing matches, it escalates instead of guessing.
 */
export function answerQuestion(question: string, sources: readonly QaSource[]): QaAnswer {
  const questionTokens = tokenize(question);

  if (questionTokens.size === 0) {
    return {
      answer:
        "The question did not contain searchable terms. Ask about a policy, control, or obligation.",
      citations: [],
      confidence: 0,
      matched: false,
    };
  }

  const scored = sources
    .map((source) => {
      const sourceTokens = tokenize(`${source.label} ${source.text}`);
      let overlap = 0;
      for (const token of questionTokens) {
        if (sourceTokens.has(token)) {
          overlap += 1;
        }
      }
      return { source, overlap };
    })
    .filter((candidate) => candidate.overlap > 0)
    .sort((a, b) =>
      b.overlap === a.overlap
        ? KIND_RANK[b.source.kind] - KIND_RANK[a.source.kind] ||
          a.source.label.localeCompare(b.source.label)
        : b.overlap - a.overlap,
    );

  if (scored.length === 0) {
    return {
      answer:
        "No internal policy, control, or circular passage matched this question. Escalate to the compliance office before acting.",
      citations: [],
      confidence: 0,
      matched: false,
    };
  }

  const top = scored.slice(0, MAX_CITATIONS);
  const best = top[0]!;
  const bestQuote = firstSentence(best.source.text);
  const supporting = top
    .slice(1)
    .map((candidate) => candidate.source.label)
    .join("; ");

  const answer =
    supporting.length > 0
      ? `${best.source.label} states: "${bestQuote}" Related passages: ${supporting}.`
      : `${best.source.label} states: "${bestQuote}"`;

  return {
    answer,
    citations: top.map((candidate) => ({
      id: candidate.source.id,
      label: candidate.source.label,
      quote: firstSentence(candidate.source.text),
    })),
    confidence: round2(Math.min(0.95, 0.45 + best.overlap * 0.1)),
    matched: true,
  };
}
