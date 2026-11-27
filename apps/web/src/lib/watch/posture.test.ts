import { describe, expect, it } from "vitest";
import { computePosture, postureFromCounts } from "./posture";

const NOW = new Date("2026-11-28T00:00:00.000Z");

describe("computePosture", () => {
  it("scores 100 and STRONG with no open findings", () => {
    const posture = computePosture(
      [{ severity: "CRITICAL", reviewStatus: "APPROVED", dueDate: "2026-11-01" }],
      NOW,
    );
    expect(posture.score).toBe(100);
    expect(posture.band).toBe("STRONG");
    expect(posture.open).toBe(0);
  });

  it("ignores resolved and rejected findings", () => {
    const posture = computePosture(
      [
        { severity: "CRITICAL", reviewStatus: "APPROVED_WITH_EDITS", dueDate: "2026-11-01" },
        { severity: "HIGH", reviewStatus: "REJECTED", dueDate: "2026-11-01" },
        { severity: "LOW", reviewStatus: "NOT_REQUIRED", dueDate: "2026-11-01" },
      ],
      NOW,
    );
    expect(posture.score).toBe(100);
  });

  it("subtracts weight for an open critical finding", () => {
    const posture = computePosture(
      [{ severity: "CRITICAL", reviewStatus: "PENDING_REVIEW", dueDate: "2026-12-20" }],
      NOW,
    );
    expect(posture.score).toBe(82);
    expect(posture.band).toBe("FAIR");
    expect(posture.counts.critical).toBe(1);
  });

  it("adds an overdue penalty and counts overdue critical/high", () => {
    const posture = computePosture(
      [
        { severity: "CRITICAL", reviewStatus: "PENDING_REVIEW", dueDate: "2026-11-01" },
        { severity: "HIGH", reviewStatus: "PENDING_REVIEW", dueDate: "2026-11-10" },
        { severity: "MEDIUM", reviewStatus: "PENDING_REVIEW", dueDate: "2026-12-30" },
      ],
      NOW,
    );
    expect(posture.overdue).toBe(2);
    expect(posture.criticalOverdue).toBe(1);
    expect(posture.highOverdue).toBe(1);
    // 100 - (18+6) - (10+3) - 4 = 59
    expect(posture.score).toBe(59);
    expect(posture.band).toBe("AT_RISK");
  });

  it("clamps to zero when penalties exceed 100", () => {
    const posture = computePosture(
      Array.from({ length: 8 }, () => ({
        severity: "CRITICAL" as const,
        reviewStatus: "PENDING_REVIEW",
        dueDate: "2026-11-01",
      })),
      NOW,
    );
    expect(posture.score).toBe(0);
    expect(posture.band).toBe("CRITICAL");
  });
});

describe("postureFromCounts", () => {
  it("matches computePosture for aggregated rows", () => {
    const findings = [
      { severity: "CRITICAL" as const, reviewStatus: "PENDING_REVIEW", dueDate: "2026-11-01" },
      { severity: "HIGH" as const, reviewStatus: "PENDING_REVIEW", dueDate: "2026-12-20" },
      { severity: "HIGH" as const, reviewStatus: "APPROVED", dueDate: "2026-11-01" },
    ];
    const fromRows = computePosture(findings, NOW);
    const fromCounts = postureFromCounts([
      { severity: "CRITICAL", open: 1, overdue: 1 },
      { severity: "HIGH", open: 1, overdue: 0 },
    ]);

    expect(fromCounts).toEqual(fromRows);
  });
});
