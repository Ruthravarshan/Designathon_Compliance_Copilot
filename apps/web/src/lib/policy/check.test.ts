import { describe, expect, it } from "vitest";
import { assessPolicy } from "./check";

const NOW = new Date("2026-11-28T00:00:00.000Z");

describe("assessPolicy", () => {
  it("is COMPLIANT with no open findings", () => {
    const assessment = assessPolicy(
      [{ severity: "CRITICAL", reviewStatus: "APPROVED", dueDate: "2026-11-01" }],
      NOW,
    );
    expect(assessment.result).toBe("COMPLIANT");
    expect(assessment.score).toBe(100);
    expect(assessment.summary).toBe("The 1 mapped obligation is met; no open gaps.");
  });

  it("is COMPLIANT and says so when nothing is mapped yet", () => {
    const assessment = assessPolicy([], NOW);
    expect(assessment.result).toBe("COMPLIANT");
    expect(assessment.summary).toBe("No regulatory obligations are mapped to this policy yet.");
  });

  it("is GAPS when a critical or high finding is open", () => {
    const assessment = assessPolicy(
      [
        { severity: "CRITICAL", reviewStatus: "PENDING_REVIEW", dueDate: "2026-11-01" },
        { severity: "HIGH", reviewStatus: "PENDING_REVIEW", dueDate: "2026-12-20" },
      ],
      NOW,
    );
    expect(assessment.result).toBe("GAPS");
    expect(assessment.critical).toBe(1);
    expect(assessment.high).toBe(1);
    expect(assessment.overdue).toBe(1);
    expect(assessment.summary).toContain("overdue");
  });

  it("is AT_RISK when only medium/low findings are open", () => {
    const assessment = assessPolicy(
      [
        { severity: "MEDIUM", reviewStatus: "PENDING_REVIEW", dueDate: "2026-12-20" },
        { severity: "LOW", reviewStatus: "PENDING_REVIEW", dueDate: "2026-12-20" },
      ],
      NOW,
    );
    expect(assessment.result).toBe("AT_RISK");
    expect(assessment.medium).toBe(1);
    expect(assessment.low).toBe(1);
    expect(assessment.summary).toContain("2 medium/low");
  });
});
