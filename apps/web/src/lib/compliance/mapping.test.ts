import { describe, expect, it } from "vitest";
import { attributeKeyFor, mapObligation, tokenize } from "./mapping";
import type { ComplianceRecord, ExtractedObligation } from "./types";

function record(overrides: Partial<ComplianceRecord> & { code: string }): ComplianceRecord {
  return {
    kind: "policy",
    title: "Policy",
    section: "Section",
    text: "Text",
    tags: [],
    ownerName: "Owner",
    ownerEmail: "owner@example.com",
    attributes: {},
    ...overrides,
  };
}

function obligation(overrides: Partial<ExtractedObligation> = {}): ExtractedObligation {
  return {
    type: "INCIDENT_REPORTING",
    plainLanguage: "Cyber incidents must be reported within six hours.",
    actionRequired: "Cut the incident reporting SLA to six hours.",
    applicableTo: "Information Security / CISO",
    requirement: { kind: "incident_reporting_hours", hours: 6, recipients: ["CERT-In"] },
    extractionConfidence: 0.94,
    quote: "Cyber incidents must be reported within six hours.",
    ...overrides,
  };
}

describe("tokenize", () => {
  it("drops stopwords and short tokens", () => {
    const tokens = tokenize("The policy must cover incident reporting");
    expect(tokens.has("the")).toBe(false);
    expect(tokens.has("policy")).toBe(false);
    expect(tokens.has("incident")).toBe(true);
    expect(tokens.has("reporting")).toBe(true);
  });
});

describe("attributeKeyFor", () => {
  it("maps every typed requirement to its attribute key", () => {
    expect(attributeKeyFor({ kind: "incident_reporting_hours", hours: 6, recipients: [] })).toBe(
      "incidentReportHours",
    );
    expect(
      attributeKeyFor({ kind: "cadence_months", action: "vulnerability_assessment", months: 6 }),
    ).toBe("vaCadenceMonths");
    expect(
      attributeKeyFor({ kind: "cadence_months", action: "penetration_testing", months: 12 }),
    ).toBe("ptCadenceMonths");
    expect(
      attributeKeyFor({ kind: "cadence_months", action: "disaster_recovery_drill", months: 6 }),
    ).toBe("drDrillMonths");
    expect(
      attributeKeyFor({ kind: "breach_notification", notifyPrincipals: true, recipients: [] }),
    ).toBe("notifyPrincipals");
    expect(attributeKeyFor({ kind: "data_residency", region: "India" })).toBe("dataRegion");
    expect(attributeKeyFor({ kind: "consent_withdrawal", standard: "comparable_ease" })).toBe(
      "consentWithdrawal",
    );
    expect(attributeKeyFor({ kind: "third_party_sharing_consent" })).toBe(
      "thirdPartySharingConsent",
    );
    expect(attributeKeyFor({ kind: "erasure_on_withdrawal" })).toBe("erasureOnWithdrawal");
    expect(attributeKeyFor({ kind: "log_retention_days", days: 180 })).toBe("logRetentionDays");
    expect(attributeKeyFor({ kind: "third_party_audit" })).toBe("auditRight");
    expect(attributeKeyFor({ kind: "key_management", standard: "byok" })).toBe("keyManagement");
    expect(attributeKeyFor({ kind: "board_reporting" })).toBe("cisoReportsToBoard");
    expect(attributeKeyFor({ kind: "risk_committee" })).toBe("riskCommitteeConstituted");
    expect(attributeKeyFor({ kind: "grievance_contact" })).toBe("grievanceContact");
    expect(attributeKeyFor({ kind: "manual_review", note: "review" })).toBeNull();
  });
});

describe("mapObligation", () => {
  const securityPolicy = record({
    code: "POL-SEC-02",
    title: "Incident Response and Reporting Policy",
    text: "Cyber security incidents are escalated and reported within 72 hours.",
    tags: ["incident-reporting", "security"],
    attributes: { incidentReportHours: 72 },
  });

  const privacyPolicy = record({
    code: "POL-PRIV-01",
    title: "Privacy Policy",
    text: "Consent withdrawal is handled by the privacy desk.",
    tags: ["consent", "privacy"],
    attributes: { consentWithdrawal: "email_request_14_days" },
  });

  it("selects the record with the strongest tag and attribute signal", () => {
    const result = mapObligation(obligation(), [securityPolicy, privacyPolicy], []);

    expect(result.best?.code).toBe("POL-SEC-02");
    expect(result.policy?.code).toBe("POL-SEC-02");
    expect(result.control).toBeNull();
    expect(result.confidence).toBeGreaterThanOrEqual(0.35);
    expect(result.rationale).toContain("POL-SEC-02");
  });

  it("returns an empty mapping below the threshold", () => {
    const unrelated = record({
      code: "POL-X",
      title: "Office supplies",
      text: "Paper clips are ordered quarterly.",
      tags: ["office"],
    });
    const result = mapObligation(obligation(), [unrelated], []);

    expect(result.best).toBeNull();
    expect(result.confidence).toBe(0.2);
    expect(result.rationale).toContain("0.35");
  });

  it("can map to a control when the control scores higher", () => {
    const policy = record({
      code: "POL-Z",
      title: "Incident policy",
      text: "Incidents are escalated.",
      tags: ["incident-reporting"],
      attributes: { incidentReportHours: 72 },
    });
    const control = record({
      code: "CTRL-01",
      kind: "control",
      title: "Incident reporting control",
      text: "Incidents are reported to the regulator within 72 hours.",
      tags: ["incident-reporting", "security"],
      attributes: { incidentReportHours: 72 },
    });
    const result = mapObligation(obligation(), [policy], [control]);

    expect(result.best?.code).toBe("CTRL-01");
    expect(result.control?.code).toBe("CTRL-01");
    expect(result.policy?.code).toBe("POL-Z");
  });

  it("breaks ties by code for deterministic output", () => {
    const a = record({
      code: "POL-B",
      title: "Incident reporting policy",
      text: "Incident reporting policy text.",
      tags: ["incident-reporting"],
      attributes: { incidentReportHours: 72 },
    });
    const b = record({
      code: "POL-A",
      title: "Incident reporting policy",
      text: "Incident reporting policy text.",
      tags: ["incident-reporting"],
      attributes: { incidentReportHours: 72 },
    });
    const result = mapObligation(obligation(), [a, b], []);

    expect(result.best?.code).toBe("POL-A");
  });

  it("handles a manual review obligation without an attribute", () => {
    const manual = obligation({
      type: "OTHER",
      requirement: { kind: "manual_review", note: "review" },
      plainLanguage: "Document the response.",
      actionRequired: "Document the response.",
    });
    const compliancePolicy = record({
      code: "POL-COMP-01",
      title: "Compliance policy",
      text: "The compliance office documents responses.",
      tags: ["compliance"],
    });
    const result = mapObligation(manual, [compliancePolicy], []);

    expect(result.best?.code).toBe("POL-COMP-01");
  });
});

describe("tokenize fallback", () => {
  it("returns an empty set when the text has no scoreable words", () => {
    expect(tokenize("! ?").size).toBe(0);
  });
});
