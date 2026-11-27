import { describe, expect, it } from "vitest";
import { diffWords, draftRedline } from "./redline";
import type { ComplianceRecord, ExtractedObligation, MappingResult, Requirement } from "./types";

function policy(overrides: Partial<ComplianceRecord> = {}): ComplianceRecord {
  return {
    kind: "policy",
    code: "POL-TEST-01",
    title: "Test policy",
    section: "§1 Test",
    text: "The current wording.",
    tags: [],
    ownerName: "Priya Nair",
    ownerEmail: "priya.nair@example.com",
    attributes: {},
    ...overrides,
  };
}

function mapping(best: ComplianceRecord | null): MappingResult {
  return { policy: best, control: null, best, confidence: 0.6, rationale: "test" };
}

function obligation(requirement: Requirement): ExtractedObligation {
  return {
    type: "OTHER",
    plainLanguage: "Plain",
    actionRequired: "Do the work",
    applicableTo: "Owner",
    requirement,
    extractionConfidence: 0.9,
    quote: "Quote",
  };
}

const citation = "IRDAI IRDAI/IT/CYBER/2023 · Section 4.2, Page 12";

describe("compliant redlines", () => {
  it("keeps the current wording and assigns an evidence task", () => {
    const draft = draftRedline({
      obligation: obligation({ kind: "third_party_audit" }),
      mapping: mapping(policy()),
      citation,
      status: "COMPLIANT",
    });

    expect(draft.before).toBe(draft.after);
    expect(draft.taskTitle).toContain("Retain evidence");
    expect(draft.assigneeEmail).toBe("priya.nair@example.com");
  });

  it("handles a compliant finding with no mapped record", () => {
    const draft = draftRedline({
      obligation: obligation({ kind: "risk_committee" }),
      mapping: mapping(null),
      citation,
      status: "COMPLIANT",
    });

    expect(draft.before).toBe("No internal policy or control covers this obligation.");
    expect(draft.assigneeEmail).toBe("compliance@hexa.example");
  });
});

describe("redline wording", () => {
  const cases: Array<[Requirement, string]> = [
    [
      { kind: "cadence_months", action: "vulnerability_assessment", months: 6 },
      "vulnerability assessment at least once every 6 months",
    ],
    [
      { kind: "cadence_months", action: "penetration_testing", months: 12 },
      "penetration testing at least once every 12 months",
    ],
    [
      { kind: "cadence_months", action: "disaster_recovery_drill", months: 6 },
      "Disaster recovery drills",
    ],
    [
      { kind: "incident_reporting_hours", hours: 6, recipients: ["CERT-In", "IRDAI"] },
      "within 6 hours",
    ],
    [
      {
        kind: "breach_notification",
        notifyPrincipals: true,
        recipients: ["Data Protection Board"],
      },
      "each affected Data Principal",
    ],
    [
      {
        kind: "breach_notification",
        notifyPrincipals: false,
        recipients: ["Data Protection Board"],
      },
      "prescribed form",
    ],
    [{ kind: "data_residency", region: "India" }, "located within India"],
    [{ kind: "consent_withdrawal", standard: "comparable_ease" }, "comparable ease"],
    [{ kind: "third_party_sharing_consent" }, "explicit consent"],
    [{ kind: "erasure_on_withdrawal" }, "erased upon withdrawal"],
    [{ kind: "log_retention_days", days: 180 }, "180 days"],
    [{ kind: "third_party_audit" }, "right to audit"],
    [{ kind: "key_management", standard: "byok" }, "BYOK"],
    [{ kind: "board_reporting" }, "Board"],
    [{ kind: "risk_committee" }, "Risk Management Committee"],
    [{ kind: "grievance_contact" }, "grievance officer"],
    [{ kind: "manual_review", note: "Review" }, "document how this obligation is met"],
  ];

  it.each(cases)("drafts wording for %o", (requirement, expected) => {
    const draft = draftRedline({
      obligation: obligation(requirement),
      mapping: mapping(policy()),
      citation,
      status: "PARTIAL_GAP",
    });

    expect(draft.after.toLowerCase()).toContain(expected.toLowerCase());
    expect(draft.after).toContain(citation);
    expect(draft.taskTitle.length).toBeGreaterThan(0);
  });

  it("prefixes a new policy when no record is mapped", () => {
    const draft = draftRedline({
      obligation: obligation({ kind: "data_residency", region: "India" }),
      mapping: mapping(null),
      citation,
      status: "MISSING_CONTROL",
    });

    expect(draft.after.startsWith("New policy required")).toBe(true);
    expect(draft.taskTitle).toBe("Move regulated storage into India");
  });

  it("uses requirement-specific task titles", () => {
    const titles = [
      { kind: "cadence_months", action: "vulnerability_assessment", months: 6 },
      { kind: "cadence_months", action: "penetration_testing", months: 12 },
      { kind: "cadence_months", action: "disaster_recovery_drill", months: 6 },
      { kind: "incident_reporting_hours", hours: 6, recipients: ["CERT-In"] },
      { kind: "breach_notification", notifyPrincipals: true, recipients: [] },
      { kind: "data_residency", region: "India" },
      { kind: "consent_withdrawal", standard: "comparable_ease" },
      { kind: "third_party_sharing_consent" },
      { kind: "erasure_on_withdrawal" },
      { kind: "log_retention_days", days: 180 },
      { kind: "third_party_audit" },
      { kind: "key_management", standard: "byok" },
      { kind: "board_reporting" },
      { kind: "risk_committee" },
      { kind: "grievance_contact" },
      { kind: "manual_review", note: "Review" },
    ] satisfies Requirement[];

    for (const requirement of titles) {
      const draft = draftRedline({
        obligation: obligation(requirement),
        mapping: mapping(policy()),
        citation,
        status: "PARTIAL_GAP",
      });
      expect(draft.taskTitle.length).toBeGreaterThan(8);
    }
  });
});

describe("word diff", () => {
  it("marks equal text", () => {
    expect(diffWords("same words", "same words")).toEqual([{ value: "same words", type: "equal" }]);
  });

  it("marks additions and removals", () => {
    const diff = diffWords("we report within 72 hours", "we report within 6 hours");
    expect(diff.some((token) => token.type === "removed" && token.value.includes("72"))).toBe(true);
    expect(diff.some((token) => token.type === "added" && token.value.includes("6"))).toBe(true);
  });

  it("handles empty inputs", () => {
    expect(diffWords("", "new text")).toEqual([{ value: "new text", type: "added" }]);
    expect(diffWords("old text", "")).toEqual([{ value: "old text", type: "removed" }]);
    expect(diffWords("", "")).toEqual([]);
  });

  it("degrades to remove-all/add-all beyond the token cap", () => {
    const before = Array.from({ length: 401 }, () => "a").join(" ");
    const after = Array.from({ length: 401 }, () => "b").join(" ");
    const diff = diffWords(before, after);

    expect(diff).toHaveLength(2);
    expect(diff[0]?.type).toBe("removed");
    expect(diff[1]?.type).toBe("added");
  });

  it("merges consecutive tokens of the same type", () => {
    const diff = diffWords("a b c", "a x y c");
    expect(diff.filter((token) => token.type === "added")).toHaveLength(1);
    expect(diff.find((token) => token.type === "added")?.value).toBe("x y");
  });
});

describe("word diff beyond the cap with one side empty", () => {
  it("returns a single removed run", () => {
    const before = Array.from({ length: 401 }, () => "a").join(" ");
    expect(diffWords(before, "")).toEqual([{ value: before, type: "removed" }]);
  });

  it("returns a single added run", () => {
    const after = Array.from({ length: 401 }, () => "b").join(" ");
    expect(diffWords("", after)).toEqual([{ value: after, type: "added" }]);
  });
});
