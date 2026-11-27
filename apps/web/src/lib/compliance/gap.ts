import type {
  ExtractedObligation,
  GapAssessment,
  GapStatus,
  MappingResult,
  ObligationType,
  Requirement,
  Severity,
} from "./types";

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function numberAttribute(attributes: Record<string, unknown>, key: string): number | null {
  const value = attributes[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stringAttribute(attributes: Record<string, unknown>, key: string): string | null {
  const value = attributes[key];
  return typeof value === "string" ? value : null;
}

function booleanAttribute(attributes: Record<string, unknown>, key: string): boolean | null {
  const value = attributes[key];
  return typeof value === "boolean" ? value : null;
}

function isIndiaRegion(value: string): boolean {
  return /india|ap-south-1|ap-south-2|mumbai|hyderabad|central/i.test(value);
}

const COMPARABLE_CONSENT = new Set(["one_click", "one-click", "self_service", "self-service", "comparable_ease"]);

const BYOK_MODES = new Set(["byok", "customer_managed", "customer-managed", "hyok"]);

function requirementLabel(requirement: Requirement): string {
  switch (requirement.kind) {
    case "cadence_months":
      if (requirement.action === "vulnerability_assessment") {
        return "vulnerability assessment cadence";
      }
      if (requirement.action === "penetration_testing") {
        return "penetration testing cadence";
      }
      return "disaster recovery drill cadence";
    case "incident_reporting_hours":
      return "incident reporting window";
    case "breach_notification":
      return "breach notification duty";
    case "data_residency":
      return "data residency";
    case "consent_withdrawal":
      return "consent withdrawal";
    case "third_party_sharing_consent":
      return "third-party sharing consent";
    case "erasure_on_withdrawal":
      return "erasure on withdrawal";
    case "log_retention_days":
      return "log retention";
    case "third_party_audit":
      return "right to audit";
    case "key_management":
      return "key management";
    case "board_reporting":
      return "Board reporting line";
    case "risk_committee":
      return "Risk Management Committee";
    case "grievance_contact":
      return "grievance contact";
    case "manual_review":
      return requirement.note;
  }
}

const CRITICAL_WHEN_MISSING = new Set<ObligationType>([
  "INCIDENT_REPORTING",
  "DATA_LOCALIZATION",
  "CONSENT",
  "THIRD_PARTY_AUDIT",
]);

function missingSeverity(type: ObligationType): Severity {
  if (CRITICAL_WHEN_MISSING.has(type)) {
    return "CRITICAL";
  }
  return type === "OTHER" ? "MEDIUM" : "HIGH";
}

function assessment(
  status: GapStatus,
  severity: Severity,
  description: string,
  rationale: string,
  ruleCertainty: number,
  citationVerified: boolean,
  mappingConfidence: number,
): GapAssessment {
  const confidence = round2(
    Math.min(
      1,
      Math.max(0, 0.4 * (citationVerified ? 1 : 0) + 0.35 * mappingConfidence + 0.25 * ruleCertainty),
    ),
  );

  return {
    status,
    severity,
    description,
    rationale,
    ruleCertainty,
    mappingConfidence,
    citationVerified,
    confidence,
  };
}

function missing(
  obligation: ExtractedObligation,
  mapping: MappingResult,
  citationVerified: boolean,
  note: string,
): GapAssessment {
  return assessment(
    "MISSING_CONTROL",
    missingSeverity(obligation.type),
    `${note} (${requirementLabel(obligation.requirement)}).`,
    "No internal policy or control carries the required attribute.",
    0.93,
    citationVerified,
    mapping.confidence,
  );
}

/**
 * Compare a regulatory requirement with the mapped internal control. The rule
 * set is deterministic: every branch names the compared values so a reviewer
 * can audit the decision.
 */
export function assessGap(
  obligation: ExtractedObligation,
  mapping: MappingResult,
  citationVerified: boolean,
): GapAssessment {
  if (mapping.best === null) {
    return missing(obligation, mapping, citationVerified, "No internal policy or control covers this obligation");
  }

  const attributes = mapping.best.attributes;
  const requirement = obligation.requirement;

  switch (requirement.kind) {
    case "cadence_months": {
      const key =
        requirement.action === "vulnerability_assessment"
          ? "vaCadenceMonths"
          : requirement.action === "penetration_testing"
            ? "ptCadenceMonths"
            : "drDrillMonths";
      const internal = numberAttribute(attributes, key);
      const label = requirementLabel(requirement);

      if (internal === null || internal <= 0) {
        return missing(obligation, mapping, citationVerified, `No internal cadence is recorded for ${label}`);
      }

      if (internal <= requirement.months) {
        return assessment(
          "COMPLIANT",
          "LOW",
          `Internal ${label} is ${internal} months, which meets the ${requirement.months}-month requirement.`,
          `Numeric comparison: ${internal} <= ${requirement.months}.`,
          0.97,
          citationVerified,
          mapping.confidence,
        );
      }

      return assessment(
        "PARTIAL_GAP",
        "HIGH",
        `Internal ${label} is ${internal} months; the regulation requires at least every ${requirement.months} months.`,
        `Numeric comparison: ${internal} > ${requirement.months}.`,
        0.97,
        citationVerified,
        mapping.confidence,
      );
    }

    case "incident_reporting_hours": {
      const internal = numberAttribute(attributes, "incidentReportHours");
      if (internal === null || internal <= 0) {
        return missing(
          obligation,
          mapping,
          citationVerified,
          "No internal incident reporting SLA is recorded",
        );
      }

      if (internal <= requirement.hours) {
        return assessment(
          "COMPLIANT",
          "LOW",
          `Internal incident reporting is ${internal} hours, within the ${requirement.hours}-hour requirement.`,
          `Numeric comparison: ${internal} <= ${requirement.hours}.`,
          0.97,
          citationVerified,
          mapping.confidence,
        );
      }

      return assessment(
        "CRITICAL_GAP",
        "CRITICAL",
        `Internal incident reporting is ${internal} hours; the regulation requires ${requirement.hours} hours from detection.`,
        `Numeric comparison: ${internal} > ${requirement.hours} on a regulator-mandated SLA.`,
        0.99,
        citationVerified,
        mapping.confidence,
      );
    }

    case "breach_notification": {
      const notifyPrincipals = booleanAttribute(attributes, "notifyPrincipals");
      if (notifyPrincipals === null) {
        return missing(
          obligation,
          mapping,
          citationVerified,
          "Breach notification duties are not recorded",
        );
      }

      if (notifyPrincipals && requirement.notifyPrincipals) {
        return assessment(
          "COMPLIANT",
          "LOW",
          "Breach notification covers the Data Protection Board and affected Data Principals.",
          "Boolean comparison: notifyPrincipals = true.",
          0.95,
          citationVerified,
          mapping.confidence,
        );
      }

      return assessment(
        "PARTIAL_GAP",
        "HIGH",
        "Breach notification does not reach each affected Data Principal.",
        "Boolean comparison: notifyPrincipals = false.",
        0.95,
        citationVerified,
        mapping.confidence,
      );
    }

    case "data_residency": {
      const region = stringAttribute(attributes, "dataRegion");
      if (region === null) {
        return missing(obligation, mapping, citationVerified, "No data region is recorded for regulated data");
      }

      if (isIndiaRegion(region)) {
        return assessment(
          "COMPLIANT",
          "LOW",
          `Recorded data region ${region} is within India.`,
          "Region check: within India.",
          0.96,
          citationVerified,
          mapping.confidence,
        );
      }

      return assessment(
        "CRITICAL_GAP",
        "CRITICAL",
        `Regulated data is configured in ${region}, outside India; the regulation requires storage within India.`,
        "Region check: outside India, cross-border storage.",
        0.99,
        citationVerified,
        mapping.confidence,
      );
    }

    case "consent_withdrawal": {
      const mode = stringAttribute(attributes, "consentWithdrawal");
      if (mode === null) {
        return missing(
          obligation,
          mapping,
          citationVerified,
          "No consent withdrawal mechanism is recorded",
        );
      }

      const normalized = mode.toLowerCase().replace(/\s+/g, "_");
      if (COMPARABLE_CONSENT.has(normalized)) {
        return assessment(
          "COMPLIANT",
          "LOW",
          `Consent withdrawal uses ${mode}, which is comparable to giving consent.`,
          "Qualitative check: comparable ease.",
          0.9,
          citationVerified,
          mapping.confidence,
        );
      }

      return assessment(
        "PARTIAL_GAP",
        "HIGH",
        `Consent withdrawal requires ${mode.replace(/_/g, " ")}, which is not comparable to giving consent.`,
        "Qualitative check: friction exceeds the consent path.",
        0.9,
        citationVerified,
        mapping.confidence,
      );
    }

    case "third_party_sharing_consent": {
      const covered = booleanAttribute(attributes, "thirdPartySharingConsent");
      if (covered === null) {
        return missing(
          obligation,
          mapping,
          citationVerified,
          "No third-party sharing consent gate is recorded",
        );
      }

      return assessment(
        covered ? "COMPLIANT" : "PARTIAL_GAP",
        covered ? "LOW" : "HIGH",
        covered
          ? "Third-party sharing has an explicit consent gate."
          : "Third-party sharing does not have an explicit consent gate.",
        `Boolean comparison: thirdPartySharingConsent = ${String(covered)}.`,
        0.95,
        citationVerified,
        mapping.confidence,
      );
    }

    case "erasure_on_withdrawal": {
      const implemented = booleanAttribute(attributes, "erasureOnWithdrawal");
      const retentionMonths = numberAttribute(attributes, "retentionMonths");
      if (implemented === null) {
        return missing(
          obligation,
          mapping,
          citationVerified,
          "No erasure-on-withdrawal control is recorded",
        );
      }

      if (implemented) {
        return assessment(
          "COMPLIANT",
          "LOW",
          "Erasure on consent withdrawal is implemented with a legal-hold exception.",
          "Boolean comparison: erasureOnWithdrawal = true.",
          0.95,
          citationVerified,
          mapping.confidence,
        );
      }

      const retention =
        retentionMonths === null ? "" : ` Data is retained for ${retentionMonths} months after closure.`;
      return assessment(
        "PARTIAL_GAP",
        "HIGH",
        `Erasure on consent withdrawal is not implemented.${retention}`,
        "Boolean comparison: erasureOnWithdrawal = false.",
        0.95,
        citationVerified,
        mapping.confidence,
      );
    }

    case "log_retention_days": {
      const internal = numberAttribute(attributes, "logRetentionDays");
      if (internal === null || internal <= 0) {
        return missing(obligation, mapping, citationVerified, "No log retention period is recorded");
      }

      if (internal >= requirement.days) {
        return assessment(
          "COMPLIANT",
          "LOW",
          `Logs are retained for ${internal} days, meeting the ${requirement.days}-day requirement.`,
          `Numeric comparison: ${internal} >= ${requirement.days}.`,
          0.97,
          citationVerified,
          mapping.confidence,
        );
      }

      return assessment(
        "PARTIAL_GAP",
        "HIGH",
        `Logs are retained for ${internal} days; the regulation requires at least ${requirement.days} days.`,
        `Numeric comparison: ${internal} < ${requirement.days}.`,
        0.97,
        citationVerified,
        mapping.confidence,
      );
    }

    case "third_party_audit": {
      const auditRight = booleanAttribute(attributes, "auditRight");
      if (auditRight === null) {
        return missing(
          obligation,
          mapping,
          citationVerified,
          "No right-to-audit clause is recorded",
        );
      }

      return assessment(
        auditRight ? "COMPLIANT" : "CRITICAL_GAP",
        auditRight ? "LOW" : "HIGH",
        auditRight
          ? "Cloud contracts carry a right-to-audit clause."
          : "Cloud contracts do not carry a right-to-audit clause.",
        `Boolean comparison: auditRight = ${String(auditRight)}.`,
        0.95,
        citationVerified,
        mapping.confidence,
      );
    }

    case "key_management": {
      const mode = stringAttribute(attributes, "keyManagement");
      if (mode === null) {
        return missing(obligation, mapping, citationVerified, "No key management model is recorded");
      }

      const normalized = mode.toLowerCase().replace(/\s+/g, "_");
      if (BYOK_MODES.has(normalized)) {
        return assessment(
          "COMPLIANT",
          "LOW",
          `Key management uses ${mode}, meeting the BYOK requirement.`,
          "Qualitative check: BYOK or customer-managed keys.",
          0.9,
          citationVerified,
          mapping.confidence,
        );
      }

      return assessment(
        "PARTIAL_GAP",
        "HIGH",
        `Key management uses ${mode.replace(/_/g, " ")}; the regulation requires BYOK or customer-managed keys.`,
        "Qualitative check: provider-managed keys fail BYOK.",
        0.9,
        citationVerified,
        mapping.confidence,
      );
    }

    case "board_reporting": {
      const boardLevel = booleanAttribute(attributes, "cisoReportsToBoard");
      if (boardLevel === null) {
        return missing(
          obligation,
          mapping,
          citationVerified,
          "No CISO reporting line is recorded",
        );
      }

      return assessment(
        boardLevel ? "COMPLIANT" : "PARTIAL_GAP",
        boardLevel ? "LOW" : "MEDIUM",
        boardLevel
          ? "The CISO reports to the Board or a Board-level committee."
          : "The CISO reporting line is not Board-level.",
        `Boolean comparison: cisoReportsToBoard = ${String(boardLevel)}.`,
        0.9,
        citationVerified,
        mapping.confidence,
      );
    }

    case "risk_committee": {
      const constituted = booleanAttribute(attributes, "riskCommitteeConstituted");
      if (constituted === true) {
        return assessment(
          "COMPLIANT",
          "LOW",
          "A Board-level Risk Management Committee is recorded.",
          "Boolean comparison: riskCommitteeConstituted = true.",
          0.9,
          citationVerified,
          mapping.confidence,
        );
      }

      return assessment(
        "PARTIAL_GAP",
        "MEDIUM",
        "No evidence of a Board-level Risk Management Committee is recorded; verify the charter before acting.",
        "Boolean comparison: riskCommitteeConstituted is false or missing.",
        0.7,
        citationVerified,
        mapping.confidence,
      );
    }

    case "grievance_contact": {
      const published = booleanAttribute(attributes, "grievanceContact");
      if (published === null) {
        return missing(obligation, mapping, citationVerified, "No grievance contact is recorded");
      }

      return assessment(
        published ? "COMPLIANT" : "PARTIAL_GAP",
        published ? "LOW" : "MEDIUM",
        published
          ? "A grievance or Data Protection Officer contact is published."
          : "No grievance or Data Protection Officer contact is published.",
        `Boolean comparison: grievanceContact = ${String(published)}.`,
        0.9,
        citationVerified,
        mapping.confidence,
      );
    }

    case "manual_review": {
      return assessment(
        "PARTIAL_GAP",
        "MEDIUM",
        `Manual review required: ${requirement.note}`,
        "No typed rule matched; a compliance officer must decide.",
        0.65,
        citationVerified,
        mapping.confidence,
      );
    }
  }
}
