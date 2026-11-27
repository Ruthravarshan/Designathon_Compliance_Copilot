import { describe, expect, it } from "vitest";
import { extractObligations } from "./extract";
import type { SourceClause } from "./types";

function clause(text: string, sectionLabel = "Section 1, Page 1"): SourceClause {
  return { sectionLabel, pageNumber: 1, text };
}

describe("obligation extraction", () => {
  it("returns nothing when the clause has no modal verb", () => {
    expect(
      extractObligations(clause("This circular explains the background to the framework.")),
    ).toEqual([]);
  });

  it("extracts a breach notification duty with affected principals", () => {
    const [result] = extractObligations(
      clause(
        "The Data Fiduciary shall notify a personal data breach to the Data Protection Board and each affected Data Principal within 72 hours.",
      ),
    );

    expect(result?.type).toBe("INCIDENT_REPORTING");
    expect(result?.requirement).toEqual({
      kind: "breach_notification",
      notifyPrincipals: true,
      recipients: ["Data Protection Board"],
    });
    expect(result?.quote).toContain("personal data breach");
    expect(result?.extractionConfidence).toBeGreaterThan(0.9);
  });

  it("marks breach notification without principal notice", () => {
    const [result] = extractObligations(
      clause("The entity shall notify the Data Protection Board of a personal data breach."),
    );

    expect(result?.requirement).toMatchObject({
      kind: "breach_notification",
      notifyPrincipals: false,
    });
  });

  it("extracts data localisation from storage wording", () => {
    const [result] = extractObligations(
      clause(
        "All regulated entities shall ensure that payment data is stored only on servers located within India.",
      ),
    );

    expect(result?.type).toBe("DATA_LOCALIZATION");
    expect(result?.requirement).toEqual({ kind: "data_residency", region: "India" });
  });

  it("recognises the localisation spelling variant", () => {
    const [result] = extractObligations(
      clause("Regulated entities shall complete data localisation within nine months."),
    );

    expect(result?.type).toBe("DATA_LOCALIZATION");
  });

  it("splits a combined VAPT clause into two dated obligations", () => {
    const results = extractObligations(
      clause(
        "Critical systems shall undergo a vulnerability assessment at least once every six months and penetration testing at least once every twelve months.",
      ),
    );

    expect(results).toHaveLength(2);
    expect(results[0]?.requirement).toEqual({
      kind: "cadence_months",
      action: "vulnerability_assessment",
      months: 6,
    });
    expect(results[1]?.requirement).toEqual({
      kind: "cadence_months",
      action: "penetration_testing",
      months: 12,
    });
    expect(results[0]?.sla).toBe("Every 6 months");
  });

  it("falls back to manual review when a VAPT cadence is missing", () => {
    const results = extractObligations(
      clause("Critical systems shall undergo a vulnerability assessment."),
    );

    expect(results[0]?.requirement.kind).toBe("manual_review");
    expect(results[0]?.extractionConfidence).toBe(0.72);
  });

  it("falls back to manual review when only the penetration test cadence is missing", () => {
    const results = extractObligations(
      clause("A penetration test shall be carried out for critical systems."),
    );

    expect(results[0]?.requirement.kind).toBe("manual_review");
  });

  it("extracts an incident reporting window with known recipients", () => {
    const [result] = extractObligations(
      clause(
        "Cyber security incidents shall be reported to CERT-In and IRDAI within six hours of detection.",
      ),
    );

    expect(result?.requirement).toEqual({
      kind: "incident_reporting_hours",
      hours: 6,
      recipients: ["CERT-In", "IRDAI"],
    });
    expect(result?.plainLanguage).toContain("6 hours");
  });

  it("uses a generic recipient when the regulator is unnamed", () => {
    const [result] = extractObligations(
      clause("A cyber security incident shall be reported to the Authority within 24 hours."),
    );

    expect(result?.requirement).toMatchObject({ recipients: ["the regulator"] });
  });

  it("falls back to manual review when an incident window is missing", () => {
    const [result] = extractObligations(
      clause("Cyber security incidents shall be reported to CERT-In without delay."),
    );

    expect(result?.requirement.kind).toBe("manual_review");
    expect(result?.type).toBe("INCIDENT_REPORTING");
  });

  it("extracts a right-to-audit duty", () => {
    const [result] = extractObligations(
      clause("Cloud contracts shall include a right to audit the provider's security controls."),
    );

    expect(result?.requirement).toEqual({ kind: "third_party_audit" });
  });

  it("extracts a BYOK duty", () => {
    const [result] = extractObligations(
      clause("Regulated data shall use a bring your own key model for encryption."),
    );

    expect(result?.requirement).toEqual({ kind: "key_management", standard: "byok" });
  });

  it("extracts a 180-day log retention period", () => {
    const [result] = extractObligations(
      clause(
        "Service providers shall retain logs of their ICT systems for a rolling period of one hundred eighty days.",
      ),
    );

    expect(result?.requirement).toEqual({ kind: "log_retention_days", days: 180 });
    expect(result?.type).toBe("LOGGING");
  });

  it("falls back to manual review when log retention has no period", () => {
    const [result] = extractObligations(
      clause("Service providers shall retain logs of their ICT systems."),
    );

    expect(result?.requirement.kind).toBe("manual_review");
  });

  it("extracts erasure on withdrawal", () => {
    const [result] = extractObligations(
      clause("The Data Fiduciary shall erase personal data upon withdrawal of consent."),
    );

    expect(result?.requirement).toEqual({ kind: "erasure_on_withdrawal" });
    expect(result?.type).toBe("DATA_RETENTION");
  });

  it("extracts comparable-ease consent withdrawal", () => {
    const [result] = extractObligations(
      clause(
        "The Data Principal shall be able to withdraw her consent at any time with comparable ease.",
      ),
    );

    expect(result?.requirement).toEqual({
      kind: "consent_withdrawal",
      standard: "comparable_ease",
    });
  });

  it("extracts third-party sharing consent", () => {
    const [result] = extractObligations(
      clause("The entity shall obtain consent before sharing customer data with a third party."),
    );

    expect(result?.requirement).toEqual({ kind: "third_party_sharing_consent" });
  });

  it("extracts a disaster recovery cadence", () => {
    const [result] = extractObligations(
      clause(
        "Regulated entities shall conduct disaster recovery drills at least once every six months.",
      ),
    );

    expect(result?.requirement).toEqual({
      kind: "cadence_months",
      action: "disaster_recovery_drill",
      months: 6,
    });
    expect(result?.type).toBe("RESILIENCE");
  });

  it("falls back to manual review when a DR cadence is missing", () => {
    const [result] = extractObligations(
      clause("The entity shall maintain a disaster recovery plan."),
    );

    expect(result?.requirement.kind).toBe("manual_review");
  });

  it("extracts a Board reporting line", () => {
    const [result] = extractObligations(
      clause("The Chief Information Security Officer shall report directly to the Board."),
    );

    expect(result?.requirement).toEqual({ kind: "board_reporting" });
  });

  it("extracts a Risk Management Committee duty", () => {
    const [result] = extractObligations(
      clause("The Board shall constitute a Risk Management Committee."),
    );

    expect(result?.requirement).toEqual({ kind: "risk_committee" });
  });

  it("extracts a grievance contact duty", () => {
    const [result] = extractObligations(
      clause("The Data Fiduciary shall publish the contact details of a grievance officer."),
    );

    expect(result?.requirement).toEqual({ kind: "grievance_contact" });
  });

  it("falls back to a manual OTHER obligation and truncates long copy", () => {
    const longText =
      "Every intermediary shall preserve the configuration of its network for inspection by the regulator at all times without exception.";
    const [result] = extractObligations(clause(longText));

    expect(result?.type).toBe("OTHER");
    expect(result?.requirement.kind).toBe("manual_review");
    expect(result?.plainLanguage.length).toBeLessThanOrEqual(220);
  });

  it("collapses whitespace in the quote", () => {
    const [result] = extractObligations(
      clause("Cyber  security\nincidents shall be reported to CERT-In within six hours."),
    );

    expect(result?.quote).toBe(
      "Cyber security incidents shall be reported to CERT-In within six hours.",
    );
  });
});

describe("duration variants", () => {
  it("converts years to months", () => {
    const [result] = extractObligations(
      clause("Critical systems shall undergo penetration testing at least once every two years."),
    );
    expect(result?.requirement).toEqual({
      kind: "cadence_months",
      action: "penetration_testing",
      months: 24,
    });
  });

  it("accepts numeric cadence periods", () => {
    const [result] = extractObligations(
      clause("Critical systems shall undergo a vulnerability assessment once every 24 months."),
    );
    expect(result?.requirement).toMatchObject({ months: 24 });
  });

  it("accepts 'a period of' before an hour window", () => {
    const [result] = extractObligations(
      clause("Cyber security incidents shall be reported to CERT-In within a period of 48 hours."),
    );
    expect(result?.requirement).toMatchObject({ kind: "incident_reporting_hours", hours: 48 });
  });

  it("accepts the hrs abbreviation", () => {
    const [result] = extractObligations(
      clause("Cyber security incidents shall be reported to CERT-In within 24 hrs."),
    );
    expect(result?.requirement).toMatchObject({ hours: 24 });
  });

  it("accepts numeric and worded retention periods", () => {
    const [numeric] = extractObligations(
      clause("Service providers shall retain logs for 365 days."),
    );
    const [worded] = extractObligations(
      clause("Service providers shall keep retention of logs for ninety days."),
    );
    expect(numeric?.requirement).toEqual({ kind: "log_retention_days", days: 365 });
    expect(worded?.requirement).toEqual({ kind: "log_retention_days", days: 90 });
  });
});

describe("confidence and fallbacks", () => {
  it("scores a short quote without a section label", () => {
    const [result] = extractObligations({
      sectionLabel: "",
      pageNumber: 1,
      text: "Cyber incidents shall report within 6 hours.",
    });
    expect(result?.requirement).toMatchObject({ kind: "incident_reporting_hours", hours: 6 });
    expect(result?.extractionConfidence).toBe(0.92);
  });

  it("truncates a long untyped obligation summary", () => {
    const text =
      "The entity shall maintain comprehensive records of all compliance activities, preserve them in a secure repository, cooperate with supervisory inquiries, furnish information requested by the Authority, and ensure that senior management reviews the records each quarter.";
    const [result] = extractObligations({ sectionLabel: "Section 9", pageNumber: 1, text });
    expect(result?.type).toBe("OTHER");
    expect(result?.requirement).toMatchObject({ kind: "manual_review" });
    expect(result?.plainLanguage.endsWith("...")).toBe(true);
  });
});
