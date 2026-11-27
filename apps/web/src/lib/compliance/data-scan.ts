import type { Severity } from "./types";

export interface DataFieldInput {
  datasetName: string;
  fieldName: string;
  dataCategory: "identifier" | "contact" | "financial" | "health" | "biometric" | "metadata";
  sensitiveType?: string;
  sampleMasked: string;
  encrypted: boolean;
  consented: boolean;
}

export interface ScanResult extends DataFieldInput {
  riskLevel: Severity;
  finding: string;
  citation: string;
}

const SENSITIVE_CATEGORIES = new Set<DataFieldInput["dataCategory"]>([
  "financial",
  "health",
  "biometric",
]);

const CONSENT_CITATION = "DPDP Act 2023, Section 6(1)";
const SAFEGUARD_CITATION = "DPDP Act 2023, Section 8(4)";

function label(field: DataFieldInput): string {
  return `${field.datasetName}.${field.fieldName}`;
}

/**
 * Deterministic DPDP discovery scan for one catalogue field. Every risk level
 * follows from three observed facts: sensitivity, encryption, and consent.
 */
export function scanField(field: DataFieldInput): ScanResult {
  const sensitive =
    field.sensitiveType !== undefined || SENSITIVE_CATEGORIES.has(field.dataCategory);
  const issues: string[] = [];
  const citations: string[] = [];

  if (!field.consented) {
    issues.push(`${label(field)} is processed without a recorded consent basis`);
    citations.push(CONSENT_CITATION);
  }

  if (sensitive && !field.encrypted) {
    issues.push(`${label(field)} holds sensitive data without encryption at rest`);
    citations.push(SAFEGUARD_CITATION);
  } else if (sensitive && !field.consented) {
    citations.push(SAFEGUARD_CITATION);
  }

  let riskLevel: Severity = "LOW";

  if (sensitive && (!field.encrypted || !field.consented)) {
    riskLevel = "CRITICAL";
  } else if (!field.consented) {
    riskLevel = "HIGH";
  } else if (!field.encrypted) {
    riskLevel = "MEDIUM";
  }

  return {
    ...field,
    riskLevel,
    finding:
      issues.length > 0
        ? `${issues.join("; ")}.`
        : "No consent or encryption gap detected for this field.",
    citation: citations.length > 0 ? [...new Set(citations)].join(" | ") : SAFEGUARD_CITATION,
  };
}

export function scanCatalog(fields: readonly DataFieldInput[]): ScanResult[] {
  return fields.map(scanField);
}

export function scanSummary(results: readonly ScanResult[]): {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  unconsented: number;
  unencrypted: number;
} {
  return {
    total: results.length,
    critical: results.filter((result) => result.riskLevel === "CRITICAL").length,
    high: results.filter((result) => result.riskLevel === "HIGH").length,
    medium: results.filter((result) => result.riskLevel === "MEDIUM").length,
    low: results.filter((result) => result.riskLevel === "LOW").length,
    unconsented: results.filter((result) => !result.consented).length,
    unencrypted: results.filter((result) => !result.encrypted).length,
  };
}
