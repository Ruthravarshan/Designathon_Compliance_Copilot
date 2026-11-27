import { describe, expect, it } from "vitest";
import { analyzeClause, dueDateFor } from "./pipeline";
import type { ComplianceRecord, SourceClause } from "./types";

const now = new Date("2026-11-10T09:00:00.000Z");

function record(
  kind: ComplianceRecord["kind"],
  code: string,
  attributes: Record<string, unknown>,
  tags: string[],
): ComplianceRecord {
  return {
    kind,
    code,
    title: `${code} title`,
    section: "Section",
    text: "Text",
    tags,
    ownerName: "Owner",
    ownerEmail: "owner@example.com",
    attributes,
  };
}

const policies: ComplianceRecord[] = [
  record("policy", "POL-SEC-02", { incidentReportHours: 72 }, ["incident-reporting", "security"]),
];

const controls: ComplianceRecord[] = [
  record("control", "CTRL-SEC-09", { vaCadenceMonths: 12, ptCadenceMonths: 12 }, [
    "security-testing",
    "vapt",
  ]),
];

function clause(text: string): SourceClause {
  return { sectionLabel: "Section 3.2, Page 8", pageNumber: 8, text };
}

describe("due dates", () => {
  it("uses severity windows from the supplied clock", () => {
    expect(dueDateFor("CRITICAL", now).toISOString()).toBe("2026-11-17T12:00:00.000Z");
    expect(dueDateFor("HIGH", now).toISOString()).toBe("2026-11-24T12:00:00.000Z");
    expect(dueDateFor("MEDIUM", now).toISOString()).toBe("2026-12-10T12:00:00.000Z");
    expect(dueDateFor("LOW", now).toISOString()).toBe("2027-01-09T12:00:00.000Z");
  });
});

describe("clause pipeline", () => {
  it("returns no findings when no obligation is extracted", () => {
    const drafts = analyzeClause({
      document: { key: "test", regulator: "RBI", reference: "RBI/TEST" },
      clause: clause("This section explains the background to the framework."),
      clauseOrder: 1,
      policies,
      controls,
      now,
    });

    expect(drafts).toEqual([]);
  });

  it("produces referenced findings for a combined VAPT clause", () => {
    const drafts = analyzeClause({
      document: { key: "rbi-test", regulator: "RBI", reference: "RBI/TEST" },
      clause: clause(
        "Critical systems shall undergo a vulnerability assessment at least once every six months and penetration testing at least once every twelve months.",
      ),
      clauseOrder: 2,
      policies,
      controls,
      now,
    });

    expect(drafts).toHaveLength(2);
    expect(drafts[0]?.obligation.reference).toBe("OBL-RBI-rbi-test-02-01");
    expect(drafts[1]?.obligation.reference).toBe("OBL-RBI-rbi-test-02-02");
    expect(drafts[0]?.obligation.citationVerified).toBe(true);
    expect(drafts[0]?.mapping.controlCode).toBe("CTRL-SEC-09");
    expect(drafts[0]?.finding.status).toBe("PARTIAL_GAP");
    expect(drafts[0]?.finding.severity).toBe("HIGH");
    expect(drafts[0]?.finding.reviewStatus).toBe("PENDING_REVIEW");
    expect(drafts[0]?.finding.taskTitle).toContain("vulnerability assessments");
    expect(drafts[1]?.finding.status).toBe("COMPLIANT");
    expect(drafts[1]?.finding.reviewStatus).toBe("NOT_REQUIRED");
    expect(drafts[1]?.finding.taskTitle).toBeNull();
    expect(drafts[1]?.finding.dueDate.toISOString()).toBe("2027-01-09T12:00:00.000Z");
  });

  it("marks a six-hour incident gap as critical and overdue-ready", () => {
    const [draft] = analyzeClause({
      document: {
        key: "irdai-test",
        regulator: "IRDAI",
        reference: "IRDAI/TEST",
        effectiveAt: new Date("2024-01-01T00:00:00.000Z"),
      },
      clause: clause(
        "Critical and cyber security incidents shall be reported to the IRDAI within six hours of detection.",
      ),
      clauseOrder: 1,
      policies,
      controls,
      now,
    });

    expect(draft?.finding.status).toBe("CRITICAL_GAP");
    expect(draft?.finding.severity).toBe("CRITICAL");
    expect(draft?.mapping.policyCode).toBe("POL-SEC-02");
    expect(draft?.finding.confidence).toBe(0.88);
    expect(draft?.finding.taskAssigneeEmail).toBe("owner@example.com");
    expect(draft?.finding.dueDate.toISOString()).toBe("2026-11-17T12:00:00.000Z");
    expect(draft?.obligation.criticNotes).toContain("exact substring");
  });

  it("flags an unmapped obligation", () => {
    const [draft] = analyzeClause({
      document: { key: "dpdp-test", regulator: "MEITY", reference: "DPDP/TEST" },
      clause: clause(
        "The Data Fiduciary shall publish the contact details of a grievance officer.",
      ),
      clauseOrder: 1,
      policies: [],
      controls: [],
      now,
    });

    expect(draft?.mapping.policyCode).toBeNull();
    expect(draft?.finding.status).toBe("MISSING_CONTROL");
    expect(draft?.obligation.criticNotes).toContain("No internal mapping");
  });
});
