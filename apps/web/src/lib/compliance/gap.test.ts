import { describe, expect, it } from "vitest";
import { assessGap } from "./gap";
import type {
  ComplianceRecord,
  ExtractedObligation,
  MappingResult,
  ObligationType,
  Requirement,
} from "./types";

function control(
  attributes: Record<string, unknown>,
  overrides: Partial<ComplianceRecord> = {},
): ComplianceRecord {
  return {
    kind: "control",
    code: "CTRL-TEST",
    title: "Control",
    section: "Control activity",
    text: "Control text",
    tags: [],
    ownerName: "Owner",
    ownerEmail: "owner@example.com",
    attributes,
    ...overrides,
  };
}

function mapping(record: ComplianceRecord | null): MappingResult {
  return {
    policy: record?.kind === "policy" ? record : null,
    control: record?.kind === "control" ? record : null,
    best: record,
    confidence: 0.6,
    rationale: "test",
  };
}

function obligation(
  requirement: Requirement,
  type: ObligationType = "SECURITY_TESTING",
): ExtractedObligation {
  return {
    type,
    plainLanguage: "Plain language",
    actionRequired: "Action",
    applicableTo: "Owner",
    requirement,
    extractionConfidence: 0.9,
    quote: "Quote text that is long enough",
  };
}

const verified = true;

describe("cadence gaps", () => {
  it("reports a missing cadence attribute", () => {
    const result = assessGap(
      obligation({ kind: "cadence_months", action: "vulnerability_assessment", months: 6 }),
      mapping(control({})),
      verified,
    );
    expect(result.status).toBe("MISSING_CONTROL");
    expect(result.ruleCertainty).toBe(0.93);
    expect(result.confidence).toBeLessThan(0.9);
  });

  it("passes when the internal cadence is within the limit", () => {
    const result = assessGap(
      obligation({ kind: "cadence_months", action: "vulnerability_assessment", months: 6 }),
      mapping(control({ vaCadenceMonths: 6 })),
      verified,
    );
    expect(result.status).toBe("COMPLIANT");
    expect(result.severity).toBe("LOW");
  });

  it("flags a slower internal cadence", () => {
    const result = assessGap(
      obligation({ kind: "cadence_months", action: "penetration_testing", months: 12 }),
      mapping(control({ ptCadenceMonths: 24 })),
      verified,
    );
    expect(result.status).toBe("PARTIAL_GAP");
    expect(result.severity).toBe("HIGH");
    expect(result.description).toContain("penetration testing");
  });

  it("labels DR drill gaps", () => {
    const result = assessGap(
      obligation(
        { kind: "cadence_months", action: "disaster_recovery_drill", months: 6 },
        "RESILIENCE",
      ),
      mapping(control({ drDrillMonths: 12 })),
      verified,
    );
    expect(result.description).toContain("disaster recovery drill");
  });

  it("treats a zero cadence as missing", () => {
    const result = assessGap(
      obligation({ kind: "cadence_months", action: "vulnerability_assessment", months: 6 }),
      mapping(control({ vaCadenceMonths: 0 })),
      verified,
    );
    expect(result.status).toBe("MISSING_CONTROL");
  });
});

describe("incident reporting gaps", () => {
  it("flags a regulator SLA miss as critical", () => {
    const result = assessGap(
      obligation(
        { kind: "incident_reporting_hours", hours: 6, recipients: ["CERT-In"] },
        "INCIDENT_REPORTING",
      ),
      mapping(control({ incidentReportHours: 72 })),
      verified,
    );
    expect(result.status).toBe("CRITICAL_GAP");
    expect(result.severity).toBe("CRITICAL");
    expect(result.confidence).toBe(0.86);
  });

  it("passes a faster SLA", () => {
    const result = assessGap(
      obligation(
        { kind: "incident_reporting_hours", hours: 6, recipients: ["CERT-In"] },
        "INCIDENT_REPORTING",
      ),
      mapping(control({ incidentReportHours: 4 })),
      verified,
    );
    expect(result.status).toBe("COMPLIANT");
  });

  it("reports a missing SLA", () => {
    const result = assessGap(
      obligation(
        { kind: "incident_reporting_hours", hours: 6, recipients: ["CERT-In"] },
        "INCIDENT_REPORTING",
      ),
      mapping(control({})),
      verified,
    );
    expect(result.status).toBe("MISSING_CONTROL");
  });
});

describe("breach notification gaps", () => {
  it("reports missing breach controls", () => {
    const result = assessGap(
      obligation(
        { kind: "breach_notification", notifyPrincipals: true, recipients: [] },
        "INCIDENT_REPORTING",
      ),
      mapping(control({})),
      verified,
    );
    expect(result.status).toBe("MISSING_CONTROL");
  });

  it("passes when principals are notified", () => {
    const result = assessGap(
      obligation(
        { kind: "breach_notification", notifyPrincipals: true, recipients: [] },
        "INCIDENT_REPORTING",
      ),
      mapping(control({ notifyPrincipals: true })),
      verified,
    );
    expect(result.status).toBe("COMPLIANT");
  });

  it("flags principal notification that is absent", () => {
    const result = assessGap(
      obligation(
        { kind: "breach_notification", notifyPrincipals: true, recipients: [] },
        "INCIDENT_REPORTING",
      ),
      mapping(control({ notifyPrincipals: false })),
      verified,
    );
    expect(result.status).toBe("PARTIAL_GAP");
    expect(result.description).toContain("affected Data Principal");
  });
});

describe("data residency gaps", () => {
  it("reports a missing region", () => {
    const result = assessGap(
      obligation({ kind: "data_residency", region: "India" }, "DATA_LOCALIZATION"),
      mapping(control({})),
      verified,
    );
    expect(result.status).toBe("MISSING_CONTROL");
  });

  it("passes an India region", () => {
    const result = assessGap(
      obligation({ kind: "data_residency", region: "India" }, "DATA_LOCALIZATION"),
      mapping(control({ dataRegion: "ap-south-1" })),
      verified,
    );
    expect(result.status).toBe("COMPLIANT");
  });

  it("flags cross-border storage as critical", () => {
    const result = assessGap(
      obligation({ kind: "data_residency", region: "India" }, "DATA_LOCALIZATION"),
      mapping(control({ dataRegion: "AWS ap-southeast-1" })),
      verified,
    );
    expect(result.status).toBe("CRITICAL_GAP");
    expect(result.description).toContain("ap-southeast-1");
  });
});

describe("consent gaps", () => {
  it("reports a missing withdrawal mode", () => {
    const result = assessGap(
      obligation({ kind: "consent_withdrawal", standard: "comparable_ease" }, "CONSENT"),
      mapping(control({})),
      verified,
    );
    expect(result.status).toBe("MISSING_CONTROL");
  });

  it("passes a comparable-ease path", () => {
    const result = assessGap(
      obligation({ kind: "consent_withdrawal", standard: "comparable_ease" }, "CONSENT"),
      mapping(control({ consentWithdrawal: "one_click" })),
      verified,
    );
    expect(result.status).toBe("COMPLIANT");
  });

  it("flags friction that exceeds giving consent", () => {
    const result = assessGap(
      obligation({ kind: "consent_withdrawal", standard: "comparable_ease" }, "CONSENT"),
      mapping(control({ consentWithdrawal: "email request 14 days" })),
      verified,
    );
    expect(result.status).toBe("PARTIAL_GAP");
    expect(result.description).toContain("email request");
  });
});

describe("sharing and erasure gaps", () => {
  it("reports a missing sharing consent attribute", () => {
    expect(
      assessGap(
        obligation({ kind: "third_party_sharing_consent" }, "CONSENT"),
        mapping(control({})),
        verified,
      ).status,
    ).toBe("MISSING_CONTROL");
  });

  it("passes and fails sharing consent", () => {
    expect(
      assessGap(
        obligation({ kind: "third_party_sharing_consent" }, "CONSENT"),
        mapping(control({ thirdPartySharingConsent: true })),
        verified,
      ).status,
    ).toBe("COMPLIANT");
    expect(
      assessGap(
        obligation({ kind: "third_party_sharing_consent" }, "CONSENT"),
        mapping(control({ thirdPartySharingConsent: false })),
        verified,
      ).status,
    ).toBe("PARTIAL_GAP");
  });

  it("reports a missing erasure attribute", () => {
    expect(
      assessGap(
        obligation({ kind: "erasure_on_withdrawal" }, "DATA_RETENTION"),
        mapping(control({})),
        verified,
      ).status,
    ).toBe("MISSING_CONTROL");
  });

  it("passes erasure and flags retained data", () => {
    expect(
      assessGap(
        obligation({ kind: "erasure_on_withdrawal" }, "DATA_RETENTION"),
        mapping(control({ erasureOnWithdrawal: true })),
        verified,
      ).status,
    ).toBe("COMPLIANT");
    const gap = assessGap(
      obligation({ kind: "erasure_on_withdrawal" }, "DATA_RETENTION"),
      mapping(control({ erasureOnWithdrawal: false, retentionMonths: 18 })),
      verified,
    );
    expect(gap.status).toBe("PARTIAL_GAP");
    expect(gap.description).toContain("18 months");
  });

  it("describes erasure gaps without a retention period", () => {
    const gap = assessGap(
      obligation({ kind: "erasure_on_withdrawal" }, "DATA_RETENTION"),
      mapping(control({ erasureOnWithdrawal: false })),
      verified,
    );
    expect(gap.description).not.toContain("months");
  });
});

describe("log retention gaps", () => {
  it("reports a missing retention period", () => {
    expect(
      assessGap(
        obligation({ kind: "log_retention_days", days: 180 }, "LOGGING"),
        mapping(control({})),
        verified,
      ).status,
    ).toBe("MISSING_CONTROL");
  });

  it("passes a longer retention and flags a shorter one", () => {
    expect(
      assessGap(
        obligation({ kind: "log_retention_days", days: 180 }, "LOGGING"),
        mapping(control({ logRetentionDays: 365 })),
        verified,
      ).status,
    ).toBe("COMPLIANT");
    expect(
      assessGap(
        obligation({ kind: "log_retention_days", days: 180 }, "LOGGING"),
        mapping(control({ logRetentionDays: 90 })),
        verified,
      ).status,
    ).toBe("PARTIAL_GAP");
  });
});

describe("audit, key management, and governance gaps", () => {
  it("reports missing attributes for audit, keys, board, committee, and grievance", () => {
    const cases: Array<[Requirement, ObligationType]> = [
      [{ kind: "third_party_audit" }, "THIRD_PARTY_AUDIT"],
      [{ kind: "key_management", standard: "byok" }, "CRYPTOGRAPHY"],
      [{ kind: "board_reporting" }, "GOVERNANCE"],
      [{ kind: "grievance_contact" }, "GRIEVANCE"],
    ];
    for (const [requirement, type] of cases) {
      expect(assessGap(obligation(requirement, type), mapping(control({})), verified).status).toBe(
        "MISSING_CONTROL",
      );
    }
  });

  it("passes and fails right-to-audit", () => {
    expect(
      assessGap(
        obligation({ kind: "third_party_audit" }, "THIRD_PARTY_AUDIT"),
        mapping(control({ auditRight: true })),
        verified,
      ).status,
    ).toBe("COMPLIANT");
    expect(
      assessGap(
        obligation({ kind: "third_party_audit" }, "THIRD_PARTY_AUDIT"),
        mapping(control({ auditRight: false })),
        verified,
      ).status,
    ).toBe("CRITICAL_GAP");
  });

  it("passes and fails BYOK", () => {
    expect(
      assessGap(
        obligation({ kind: "key_management", standard: "byok" }, "CRYPTOGRAPHY"),
        mapping(control({ keyManagement: "customer-managed" })),
        verified,
      ).status,
    ).toBe("COMPLIANT");
    expect(
      assessGap(
        obligation({ kind: "key_management", standard: "byok" }, "CRYPTOGRAPHY"),
        mapping(control({ keyManagement: "provider-managed" })),
        verified,
      ).status,
    ).toBe("PARTIAL_GAP");
  });

  it("passes and fails Board reporting", () => {
    expect(
      assessGap(
        obligation({ kind: "board_reporting" }, "GOVERNANCE"),
        mapping(control({ cisoReportsToBoard: true })),
        verified,
      ).status,
    ).toBe("COMPLIANT");
    expect(
      assessGap(
        obligation({ kind: "board_reporting" }, "GOVERNANCE"),
        mapping(control({ cisoReportsToBoard: false })),
        verified,
      ).status,
    ).toBe("PARTIAL_GAP");
  });

  it("evaluates the Risk Management Committee", () => {
    expect(
      assessGap(
        obligation({ kind: "risk_committee" }, "GOVERNANCE"),
        mapping(control({ riskCommitteeConstituted: true })),
        verified,
      ).status,
    ).toBe("COMPLIANT");
    const gap = assessGap(
      obligation({ kind: "risk_committee" }, "GOVERNANCE"),
      mapping(control({})),
      verified,
    );
    expect(gap.status).toBe("PARTIAL_GAP");
    expect(gap.severity).toBe("MEDIUM");
    expect(gap.confidence).toBeLessThan(0.8);
  });

  it("passes and fails grievance contact publishing", () => {
    expect(
      assessGap(
        obligation({ kind: "grievance_contact" }, "GRIEVANCE"),
        mapping(control({ grievanceContact: true })),
        verified,
      ).status,
    ).toBe("COMPLIANT");
    expect(
      assessGap(
        obligation({ kind: "grievance_contact" }, "GRIEVANCE"),
        mapping(control({ grievanceContact: false })),
        verified,
      ).status,
    ).toBe("PARTIAL_GAP");
  });
});

describe("manual and unmatched gaps", () => {
  it("routes a manual review to a medium partial gap", () => {
    const gap = assessGap(
      obligation({ kind: "manual_review", note: "Check applicability" }, "OTHER"),
      mapping(control({})),
      verified,
    );
    expect(gap.status).toBe("PARTIAL_GAP");
    expect(gap.severity).toBe("MEDIUM");
    expect(gap.ruleCertainty).toBe(0.65);
  });

  it("returns a missing control with a mapping-independent assessment", () => {
    const gap = assessGap(
      obligation(
        { kind: "incident_reporting_hours", hours: 6, recipients: [] },
        "INCIDENT_REPORTING",
      ),
      mapping(null),
      false,
    );
    expect(gap.status).toBe("MISSING_CONTROL");
    expect(gap.severity).toBe("CRITICAL");
    expect(gap.ruleCertainty).toBe(0.93);
    expect(gap.confidence).toBeLessThan(0.4);
    expect(gap.citationVerified).toBe(false);
  });

  it("uses MEDIUM severity for unmatched OTHER obligations", () => {
    const gap = assessGap(
      obligation({ kind: "manual_review", note: "Unclear" }, "OTHER"),
      mapping(null),
      verified,
    );
    expect(gap.severity).toBe("MEDIUM");
  });
});
