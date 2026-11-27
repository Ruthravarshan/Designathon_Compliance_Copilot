import type {
  ComplianceRecord,
  ExtractedObligation,
  MappingResult,
  ObligationType,
  Requirement,
} from "./types";

const STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "that",
  "this",
  "from",
  "shall",
  "must",
  "will",
  "have",
  "has",
  "are",
  "was",
  "were",
  "into",
  "within",
  "each",
  "such",
  "any",
  "all",
  "its",
  "her",
  "their",
  "they",
  "not",
  "may",
  "can",
  "required",
  "requirement",
  "regulation",
  "regulatory",
  "internal",
  "policy",
  "control",
  "controls",
  "data",
  "system",
  "systems",
  "which",
  "when",
  "where",
  "under",
  "over",
  "than",
  "then",
  "also",
  "provide",
  "compliance",
]);

const TYPE_TAGS: Record<ObligationType, string[]> = {
  SECURITY_TESTING: ["security-testing", "vapt"],
  INCIDENT_REPORTING: ["incident-reporting", "security"],
  DATA_LOCALIZATION: ["localization", "data-residency", "cloud"],
  CONSENT: ["consent", "privacy"],
  DATA_RETENTION: ["retention", "erasure", "privacy"],
  THIRD_PARTY_AUDIT: ["third-party", "audit", "cloud", "vendor"],
  CRYPTOGRAPHY: ["cryptography", "encryption", "key-management"],
  RESILIENCE: ["resilience", "dr", "business-continuity"],
  LOGGING: ["logging", "log-retention", "security"],
  GOVERNANCE: ["governance", "board"],
  GRIEVANCE: ["grievance", "privacy"],
  OTHER: ["compliance"],
};

const MAPPING_THRESHOLD = 0.35;

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function tokenize(text: string): Set<string> {
  const words = text.toLowerCase().match(/[a-z][a-z-]{2,}|\d+/g) ?? [];
  return new Set(words.filter((word) => !STOPWORDS.has(word)));
}

export function attributeKeyFor(requirement: Requirement): string | null {
  switch (requirement.kind) {
    case "cadence_months":
      if (requirement.action === "vulnerability_assessment") {
        return "vaCadenceMonths";
      }
      if (requirement.action === "penetration_testing") {
        return "ptCadenceMonths";
      }
      return "drDrillMonths";
    case "incident_reporting_hours":
      return "incidentReportHours";
    case "breach_notification":
      return "notifyPrincipals";
    case "data_residency":
      return "dataRegion";
    case "consent_withdrawal":
      return "consentWithdrawal";
    case "third_party_sharing_consent":
      return "thirdPartySharingConsent";
    case "erasure_on_withdrawal":
      return "erasureOnWithdrawal";
    case "log_retention_days":
      return "logRetentionDays";
    case "third_party_audit":
      return "auditRight";
    case "key_management":
      return "keyManagement";
    case "board_reporting":
      return "cisoReportsToBoard";
    case "risk_committee":
      return "riskCommitteeConstituted";
    case "grievance_contact":
      return "grievanceContact";
    case "manual_review":
      return null;
  }
}

interface ScoredRecord {
  record: ComplianceRecord;
  score: number;
  rationale: string;
}

function scoreRecord(
  record: ComplianceRecord,
  tags: readonly string[],
  obligationTokens: ReadonlySet<string>,
  attributeKey: string | null,
): ScoredRecord {
  const recordTags = new Set(record.tags.map((tag) => tag.toLowerCase()));
  const tagHits = tags.filter((tag) => recordTags.has(tag));
  const tagScore = (tagHits.length / tags.length) * 0.45;

  const recordTokens = tokenize(
    `${record.title} ${record.section} ${record.text} ${record.tags.join(" ")}`,
  );
  let overlap = 0;
  for (const token of obligationTokens) {
    if (recordTokens.has(token)) {
      overlap += 1;
    }
  }
  const termDenominator = Math.min(obligationTokens.size, 12);
  const termScore = (overlap / termDenominator) * 0.35;

  const hasAttribute =
    attributeKey !== null &&
    record.attributes[attributeKey] !== undefined &&
    record.attributes[attributeKey] !== null;
  const attributeScore = hasAttribute ? 0.2 : 0;

  const score = round3(Math.min(1, tagScore + termScore + attributeScore));
  const parts = [
    tagHits.length > 0 ? `tags: ${tagHits.join(", ")}` : null,
    overlap > 0 ? `${overlap} shared terms` : null,
    hasAttribute && attributeKey ? `attribute: ${attributeKey}` : null,
  ].filter((part): part is string => part !== null);

  return {
    record,
    score,
    rationale: parts.length > 0 ? parts.join("; ") : "no signal",
  };
}

function bestOf(candidates: ScoredRecord[]): ScoredRecord | null {
  if (candidates.length === 0) {
    return null;
  }

  return [...candidates].sort((a, b) =>
    b.score === a.score ? a.record.code.localeCompare(b.record.code) : b.score - a.score,
  )[0]!;
}

/**
 * Map an obligation to the closest internal policy and control using domain
 * tags, lexical overlap, and structured attribute support. The mapping is
 * deterministic and does not call an external model.
 */
export function mapObligation(
  obligation: ExtractedObligation,
  policies: readonly ComplianceRecord[],
  controls: readonly ComplianceRecord[],
): MappingResult {
  const tags = TYPE_TAGS[obligation.type];
  const attributeKey = attributeKeyFor(obligation.requirement);
  const obligationTokens = tokenize(
    `${obligation.plainLanguage} ${obligation.actionRequired} ${obligation.type}`,
  );

  const policyCandidates = policies.map((record) =>
    scoreRecord(record, tags, obligationTokens, attributeKey),
  );
  const controlCandidates = controls.map((record) =>
    scoreRecord(record, tags, obligationTokens, attributeKey),
  );

  const policy = bestOf(
    policyCandidates.filter((candidate) => candidate.score >= MAPPING_THRESHOLD),
  );
  const control = bestOf(
    controlCandidates.filter((candidate) => candidate.score >= MAPPING_THRESHOLD),
  );

  const best =
    policy === null
      ? control
      : control === null
        ? policy
        : policy.score >= control.score
          ? policy
          : control;

  if (best === null) {
    return {
      policy: null,
      control: null,
      best: null,
      confidence: 0.2,
      rationale: "No policy or control scored above the 0.35 mapping threshold.",
    };
  }

  return {
    policy: policy?.record ?? null,
    control: control?.record ?? null,
    best: best.record,
    confidence: best.score,
    rationale: `${best.record.code}: ${best.rationale}.`,
  };
}
