export type RegulatorKey = "RBI" | "SEBI" | "IRDAI" | "MEITY";

export type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export type GapStatus = "COMPLIANT" | "PARTIAL_GAP" | "CRITICAL_GAP" | "MISSING_CONTROL";

export type ObligationType =
  | "SECURITY_TESTING"
  | "INCIDENT_REPORTING"
  | "DATA_LOCALIZATION"
  | "CONSENT"
  | "DATA_RETENTION"
  | "THIRD_PARTY_AUDIT"
  | "CRYPTOGRAPHY"
  | "RESILIENCE"
  | "LOGGING"
  | "GOVERNANCE"
  | "GRIEVANCE"
  | "OTHER";

export type Requirement =
  | {
      kind: "cadence_months";
      action: "vulnerability_assessment" | "penetration_testing" | "disaster_recovery_drill";
      months: number;
    }
  | { kind: "incident_reporting_hours"; hours: number; recipients: string[] }
  | { kind: "breach_notification"; notifyPrincipals: boolean; recipients: string[] }
  | { kind: "data_residency"; region: "India" }
  | { kind: "consent_withdrawal"; standard: "comparable_ease" }
  | { kind: "third_party_sharing_consent" }
  | { kind: "erasure_on_withdrawal" }
  | { kind: "log_retention_days"; days: number }
  | { kind: "third_party_audit" }
  | { kind: "key_management"; standard: "byok" }
  | { kind: "board_reporting" }
  | { kind: "risk_committee" }
  | { kind: "grievance_contact" }
  | { kind: "manual_review"; note: string };

export interface SourceClause {
  sectionLabel: string;
  heading?: string;
  pageNumber: number;
  text: string;
}

export interface ExtractedObligation {
  type: ObligationType;
  plainLanguage: string;
  actionRequired: string;
  applicableTo: string;
  requirement: Requirement;
  sla?: string;
  extractionConfidence: number;
  quote: string;
}

export interface ComplianceRecord {
  kind: "policy" | "control";
  code: string;
  title: string;
  section: string;
  text: string;
  tags: string[];
  ownerName: string;
  ownerEmail: string;
  attributes: Record<string, unknown>;
  systemName?: string;
}

export interface MappingResult {
  policy: ComplianceRecord | null;
  control: ComplianceRecord | null;
  best: ComplianceRecord | null;
  confidence: number;
  rationale: string;
}

export interface GapAssessment {
  status: GapStatus;
  severity: Severity;
  description: string;
  rationale: string;
  ruleCertainty: number;
  mappingConfidence: number;
  citationVerified: boolean;
  confidence: number;
}

export interface RedlineDraft {
  before: string;
  after: string;
  taskTitle: string;
  taskAction: string;
  assigneeName: string;
  assigneeEmail: string;
}

export interface FindingDraft {
  obligation: {
    reference: string;
    plainLanguage: string;
    actionRequired: string;
    applicableTo: string;
    type: ObligationType;
    requirement: Requirement;
    sla?: string;
    extractionConfidence: number;
    citationVerified: boolean;
    criticNotes: string;
  };
  mapping: {
    policyCode: string | null;
    controlCode: string | null;
    confidence: number;
    rationale: string;
  };
  finding: {
    status: GapStatus;
    severity: Severity;
    gapDescription: string;
    severityRationale: string;
    citationVerified: boolean;
    extractionConfidence: number;
    mappingConfidence: number;
    confidence: number;
    dueDate: Date;
    redlineBefore: string;
    redlineAfter: string;
    taskTitle: string | null;
    taskAssignee: string | null;
    taskAssigneeEmail: string | null;
    taskDueDate: Date | null;
    reviewStatus: "PENDING_REVIEW" | "NOT_REQUIRED";
  };
}

export const SEVERITY_ORDER: Record<Severity, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
};

export function isSeverity(value: string): value is Severity {
  return value === "CRITICAL" || value === "HIGH" || value === "MEDIUM" || value === "LOW";
}

export function isGapStatus(value: string): value is GapStatus {
  return (
    value === "COMPLIANT" ||
    value === "PARTIAL_GAP" ||
    value === "CRITICAL_GAP" ||
    value === "MISSING_CONTROL"
  );
}
