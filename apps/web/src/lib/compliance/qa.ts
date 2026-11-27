export interface QaSource {
  id: string;
  label: string;
  kind: "policy" | "control" | "clause";
  text: string;
  documentId?: string;
  pageNumber?: number;
  webUrl?: string;
  pdfUrl?: string;
  workspaceUrl?: string;
}

export interface QaCitation {
  id: string;
  label: string;
  quote: string;
  kind?: QaSource["kind"];
  documentId?: string;
  pageNumber?: number;
  webUrl?: string;
  pdfUrl?: string;
  workspaceUrl?: string;
}

export interface QaAnswer {
  answer: string;
  citations: QaCitation[];
  confidence: number;
  matched: boolean;
  /** "grounded" used the model with verbatim checks; "retrieval" is the deterministic fallback. */
  mode?: "grounded" | "retrieval";
  model?: string;
  latencyMs?: number;
}

export interface QaPassage {
  source: QaSource;
  score: number;
}

export interface VectorHit {
  id: string;
  similarity: number;
}

export const REFUSAL_ANSWER =
  "No internal policy, control, or circular passage matched this question. Escalate to the compliance office before acting.";

export const UNSEARCHABLE_ANSWER =
  "The question did not contain searchable terms. Ask about a policy, control, or obligation.";

const MAX_CITATIONS = 3;
const MAX_QUOTE_LENGTH = 240;
const MAX_PASSAGES = 24;
const DEFAULT_PASSAGE_LIMIT = 6;
/** Below this BM25 score a passage is not evidence, just a shared word. */
const MIN_PASSAGE_SCORE = 0.5;
const MIN_VECTOR_SIMILARITY = 0.32;
const VECTOR_WEIGHT = 2.5;
const PHRASE_BONUS = 0.6;
const LABEL_BOOST = 0.5;
const BM25_K1 = 1.2;
const BM25_B = 0.75;

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
  "could",
  "would",
  "will",
  "may",
  "might",
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
  "any",
  "all",
  "also",
  "there",
  "their",
  "them",
  "these",
  "those",
  "have",
  "has",
  "been",
  "was",
  "were",
  "than",
  "then",
  "into",
  "over",
  "such",
]);

/**
 * Compliance questions use different words for the same concept ("withdrawn",
 * "revoked", "opt-out"). Collapsing each concept to one id gives recall without
 * fuzzy matching, so every hit stays explainable.
 */
const SYNONYM_GROUPS: readonly (readonly string[])[] = [
  [
    "report",
    "reports",
    "reported",
    "reporting",
    "notify",
    "notifies",
    "notified",
    "notification",
    "escalate",
    "escalates",
    "escalated",
    "escalation",
    "inform",
    "informs",
    "informed",
  ],
  [
    "store",
    "stores",
    "stored",
    "storing",
    "storage",
    "host",
    "hosts",
    "hosted",
    "hosting",
    "reside",
    "resides",
    "resided",
    "locate",
    "located",
    "location",
    "locations",
    "localize",
    "localized",
    "localise",
    "localised",
    "localization",
    "localisation",
  ],
  ["retain", "retains", "retained", "retaining", "retention", "archive", "archived"],
  [
    "withdraw",
    "withdraws",
    "withdrawn",
    "withdrawing",
    "withdrawal",
    "withdrawals",
    "revoke",
    "revoked",
    "revocation",
    "optout",
  ],
  ["consent", "consents", "consented", "permission", "permissions"],
  ["incident", "incidents", "breach", "breaches", "attack", "attacks"],
  [
    "audit",
    "audits",
    "audited",
    "auditing",
    "assess",
    "assessed",
    "assessment",
    "assessments",
    "inspect",
    "inspected",
    "inspection",
    "inspections",
  ],
  [
    "frequency",
    "frequencies",
    "cadence",
    "cadences",
    "interval",
    "intervals",
    "periodic",
    "periodically",
    "often",
  ],
  [
    "deadline",
    "deadlines",
    "window",
    "windows",
    "timeframe",
    "timeframes",
    "hour",
    "hours",
    "day",
    "days",
    "week",
    "weeks",
    "month",
    "months",
    "year",
    "years",
  ],
  [
    "vendor",
    "vendors",
    "provider",
    "providers",
    "supplier",
    "suppliers",
    "outsource",
    "outsourced",
    "outsourcing",
  ],
  ["encrypt", "encrypts", "encrypted", "encrypting", "encryption"],
  ["grievance", "grievances", "complaint", "complaints", "complain", "complains"],
  ["board", "boards", "committee", "committees"],
];

const SYNONYM_LOOKUP = new Map<string, string>();
for (const group of SYNONYM_GROUPS) {
  const concept = group[0]!;
  for (const word of group) {
    SYNONYM_LOOKUP.set(word, concept);
  }
}

const KIND_RANK: Record<QaSource["kind"], number> = {
  policy: 3,
  control: 2,
  clause: 1,
};

const KIND_PRIOR: Record<QaSource["kind"], number> = {
  policy: 0.15,
  control: 0.1,
  clause: 0,
};

/** Crude but predictable suffix stripping; synonyms cover the irregular cases. */
function stem(word: string): string {
  if (word.endsWith("ies") && word.length > 5) {
    return `${word.slice(0, -3)}y`;
  }
  if (word.endsWith("ing") && word.length > 6) {
    return word.slice(0, -3);
  }
  if (word.endsWith("ed") && word.length > 5) {
    return word.slice(0, -2);
  }
  if (word.endsWith("es") && word.length > 5) {
    return word.slice(0, -2);
  }
  if (word.endsWith("s") && !word.endsWith("ss") && word.length > 4) {
    return word.slice(0, -1);
  }
  return word;
}

function canonicalToken(word: string): string {
  return SYNONYM_LOOKUP.get(word) ?? stem(word);
}

/** Lowercase, drop stopwords, collapse synonyms. Shared by query and corpus. */
export function tokenize(text: string): string[] {
  const words = text.toLowerCase().match(/[a-z][a-z0-9]*/g) ?? [];
  return words
    .filter((word) => word.length >= 3 && !QUESTION_STOPWORDS.has(word))
    .map(canonicalToken);
}

function termFrequency(tokens: readonly string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const token of tokens) {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }
  return counts;
}

interface PreparedSource {
  source: QaSource;
  terms: Map<string, number>;
  labelTerms: Set<string>;
  length: number;
  normalized: string;
}

function prepare(sources: readonly QaSource[]): PreparedSource[] {
  return sources.map((source) => {
    const tokens = tokenize(source.text);
    return {
      source,
      terms: termFrequency(tokens),
      // Codes and titles are strong signals, but must not distort length normalization.
      labelTerms: new Set(tokenize(source.label)),
      length: Math.max(tokens.length, 1),
      normalized: source.text.replace(/\s+/g, " ").toLowerCase(),
    };
  });
}

function bigrams(question: string): string[] {
  const words = (question.toLowerCase().match(/[a-z][a-z0-9]*/g) ?? []).filter(
    (word) => word.length >= 3 && !QUESTION_STOPWORDS.has(word),
  );
  const pairs: string[] = [];
  for (let index = 0; index < words.length - 1; index += 1) {
    pairs.push(`${words[index]} ${words[index + 1]}`);
  }
  return pairs;
}

/**
 * BM25 over policy, control, and clause text plus a verbatim bigram bonus.
 * Deterministic and explainable: every ranking decision comes from query terms
 * that literally appear in the passage.
 */
export function retrievePassages(
  question: string,
  sources: readonly QaSource[],
  options: { limit?: number } = {},
): QaPassage[] {
  const queryTerms = [...new Set(tokenize(question))];
  if (queryTerms.length === 0 || sources.length === 0) {
    return [];
  }

  const prepared = prepare(sources);
  const documentFrequency = new Map<string, number>();
  for (const document of prepared) {
    for (const term of document.terms.keys()) {
      documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
    }
  }

  const totalDocuments = prepared.length;
  const averageLength =
    prepared.reduce((total, document) => total + document.length, 0) / totalDocuments;
  const phrases = bigrams(question);

  const scored = prepared.map((document) => {
    let score = 0;
    for (const term of queryTerms) {
      if (document.labelTerms.has(term)) {
        score += LABEL_BOOST;
      }
      const tf = document.terms.get(term);
      if (!tf) {
        continue;
      }
      const df = documentFrequency.get(term) ?? 0;
      const idf = Math.log(1 + (totalDocuments - df + 0.5) / (df + 0.5));
      const saturation =
        (tf * (BM25_K1 + 1)) /
        (tf + BM25_K1 * (1 - BM25_B + (BM25_B * document.length) / averageLength));
      score += idf * saturation;
    }

    if (score > 0) {
      score += KIND_PRIOR[document.source.kind];
      for (const phrase of phrases) {
        if (document.normalized.includes(phrase)) {
          score += PHRASE_BONUS;
        }
      }
    }

    return { source: document.source, score };
  });

  return scored
    .filter((candidate) => candidate.score >= MIN_PASSAGE_SCORE)
    .sort((a, b) =>
      b.score === a.score
        ? KIND_RANK[b.source.kind] - KIND_RANK[a.source.kind] ||
          a.source.label.localeCompare(b.source.label)
        : b.score - a.score,
    )
    .slice(0, Math.min(Math.max(options.limit ?? DEFAULT_PASSAGE_LIMIT, 1), MAX_PASSAGES));
}

/**
 * Weighted fusion of BM25 and semantic hits. Both signals are explainable: the
 * lexical score comes from literal query terms, the semantic score is cosine
 * similarity, and every fused passage still has to exist in the workspace
 * source set.
 */
export function fusePassages(
  question: string,
  sources: readonly QaSource[],
  vectorHits: readonly VectorHit[],
  options: { limit?: number } = {},
): QaPassage[] {
  const limit = Math.min(Math.max(options.limit ?? DEFAULT_PASSAGE_LIMIT, 1), MAX_PASSAGES);

  if (vectorHits.length === 0 || sources.length === 0) {
    return retrievePassages(question, sources, { limit });
  }

  const sourceById = new Map(sources.map((source) => [source.id, source]));
  const lexical = retrievePassages(question, sources, {
    limit: Math.min(MAX_PASSAGES, Math.max(limit * 2, 12)),
  });
  const fused = new Map<string, QaPassage>();

  for (const passage of lexical) {
    fused.set(passage.source.id, passage);
  }

  for (const hit of vectorHits) {
    if (!Number.isFinite(hit.similarity) || hit.similarity < MIN_VECTOR_SIMILARITY) {
      continue;
    }
    const source = sourceById.get(hit.id);
    if (!source) {
      continue;
    }
    const previous = fused.get(hit.id)?.score ?? 0;
    fused.set(hit.id, { source, score: previous + VECTOR_WEIGHT * hit.similarity });
  }

  return [...fused.values()]
    .sort((a, b) =>
      b.score === a.score
        ? KIND_RANK[b.source.kind] - KIND_RANK[a.source.kind] ||
          a.source.label.localeCompare(b.source.label)
        : b.score - a.score,
    )
    .slice(0, limit);
}

export function citationFromSource(source: QaSource, quote: string): QaCitation {
  return {
    id: source.id,
    label: source.label,
    quote,
    kind: source.kind,
    ...(source.documentId ? { documentId: source.documentId } : {}),
    ...(typeof source.pageNumber === "number" ? { pageNumber: source.pageNumber } : {}),
    ...(source.webUrl ? { webUrl: source.webUrl } : {}),
    ...(source.pdfUrl ? { pdfUrl: source.pdfUrl } : {}),
    ...(source.workspaceUrl ? { workspaceUrl: source.workspaceUrl } : {}),
  };
}

function pickQuote(text: string, queryTerms: readonly string[]): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  const sentences = normalized.split(/(?<=[.!?])\s+/).filter((sentence) => sentence.length > 0);
  let best = sentences[0] ?? normalized;
  let bestHits = -1;
  for (const sentence of sentences) {
    const sentenceTerms = new Set(tokenize(sentence));
    let hits = 0;
    for (const term of queryTerms) {
      if (sentenceTerms.has(term)) {
        hits += 1;
      }
    }
    if (hits > bestHits) {
      best = sentence;
      bestHits = hits;
    }
  }
  return best.length > MAX_QUOTE_LENGTH ? `${best.slice(0, MAX_QUOTE_LENGTH - 3)}...` : best;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function confidenceFor(score: number): number {
  if (score <= 0) {
    return 0;
  }
  return round2(Math.min(0.95, 0.5 + 0.45 * (score / (score + 2.5))));
}

/**
 * Deterministic extractive answer over an already-ranked passage list. No
 * generation: the answer quotes the best-matching passage and lists citations,
 * and escalates when nothing clears the evidence threshold.
 */
export function answerFromPassages(question: string, passages: readonly QaPassage[]): QaAnswer {
  const queryTerms = tokenize(question);
  if (queryTerms.length === 0) {
    return { answer: UNSEARCHABLE_ANSWER, citations: [], confidence: 0, matched: false };
  }
  if (passages.length === 0) {
    return { answer: REFUSAL_ANSWER, citations: [], confidence: 0, matched: false };
  }

  const best = passages[0]!;
  const cited = passages.slice(0, MAX_CITATIONS);
  const bestQuote = pickQuote(best.source.text, queryTerms);
  const citations = cited.map((passage) =>
    citationFromSource(passage.source, pickQuote(passage.source.text, queryTerms)),
  );
  const supporting = cited
    .slice(1)
    .map((passage) => passage.source.label)
    .join("; ");

  const answer =
    supporting.length > 0
      ? `${best.source.label} states: "${bestQuote}" Related passages: ${supporting}.`
      : `${best.source.label} states: "${bestQuote}"`;

  return {
    answer,
    citations,
    confidence: confidenceFor(best.score),
    matched: true,
  };
}

/**
 * Deterministic extractive answer. No generation: the answer quotes the
 * best-matching passage and lists its citations, and escalates when nothing
 * clears the evidence threshold.
 */
export function answerQuestion(question: string, sources: readonly QaSource[]): QaAnswer {
  const queryTerms = tokenize(question);
  if (queryTerms.length === 0) {
    return { answer: UNSEARCHABLE_ANSWER, citations: [], confidence: 0, matched: false };
  }

  return answerFromPassages(
    question,
    retrievePassages(question, sources, { limit: MAX_CITATIONS }),
  );
}
