import type { Severity } from "../compliance/types";

export type PostureBand = "STRONG" | "FAIR" | "AT_RISK" | "CRITICAL";

export interface PostureFinding {
  severity: Severity;
  reviewStatus: string;
  dueDate: Date | string;
}

export interface PostureSummary {
  score: number;
  band: PostureBand;
  open: number;
  overdue: number;
  criticalOverdue: number;
  highOverdue: number;
  counts: { critical: number; high: number; medium: number; low: number };
}

const OPEN_STATUS = "PENDING_REVIEW";

const WEIGHT: Record<Severity, number> = {
  CRITICAL: 18,
  HIGH: 10,
  MEDIUM: 4,
  LOW: 1,
};

const OVERDUE_EXTRA: Record<Severity, number> = {
  CRITICAL: 6,
  HIGH: 3,
  MEDIUM: 1,
  LOW: 0,
};

function isOverdue(dueDate: Date | string, now: Date): boolean {
  const due = dueDate instanceof Date ? dueDate : new Date(dueDate);
  return !Number.isNaN(due.getTime()) && due.getTime() < now.getTime();
}

/**
 * Executive compliance posture. Resolved findings (approved / rejected) do not
 * count; only work still awaiting officer sign-off lowers the score.
 */
export function computePosture(findings: readonly PostureFinding[], now: Date): PostureSummary {
  let open = 0;
  let overdue = 0;
  let criticalOverdue = 0;
  let highOverdue = 0;
  let penalty = 0;
  const counts = { critical: 0, high: 0, medium: 0, low: 0 };

  for (const finding of findings) {
    if (finding.reviewStatus !== OPEN_STATUS) {
      continue;
    }

    open += 1;
    penalty += WEIGHT[finding.severity];
    counts[finding.severity.toLowerCase() as keyof typeof counts] += 1;

    if (isOverdue(finding.dueDate, now)) {
      overdue += 1;
      penalty += OVERDUE_EXTRA[finding.severity];
      if (finding.severity === "CRITICAL") {
        criticalOverdue += 1;
      } else if (finding.severity === "HIGH") {
        highOverdue += 1;
      }
    }
  }

  const score = Math.max(0, Math.min(100, Math.round(100 - penalty)));
  const band: PostureBand =
    score >= 85 ? "STRONG" : score >= 65 ? "FAIR" : score >= 40 ? "AT_RISK" : "CRITICAL";

  return { score, band, open, overdue, criticalOverdue, highOverdue, counts };
}

export interface PostureCount {
  severity: Severity;
  open: number;
  overdue: number;
}

/** Same scoring as computePosture, fed by database aggregates instead of full rows. */
export function postureFromCounts(rows: readonly PostureCount[]): PostureSummary {
  let open = 0;
  let overdue = 0;
  let criticalOverdue = 0;
  let highOverdue = 0;
  let penalty = 0;
  const counts = { critical: 0, high: 0, medium: 0, low: 0 };

  for (const row of rows) {
    open += row.open;
    overdue += row.overdue;
    penalty += WEIGHT[row.severity] * row.open + OVERDUE_EXTRA[row.severity] * row.overdue;
    counts[row.severity.toLowerCase() as keyof typeof counts] += row.open;
    if (row.severity === "CRITICAL") {
      criticalOverdue += row.overdue;
    } else if (row.severity === "HIGH") {
      highOverdue += row.overdue;
    }
  }

  const score = Math.max(0, Math.min(100, Math.round(100 - penalty)));
  const band: PostureBand =
    score >= 85 ? "STRONG" : score >= 65 ? "FAIR" : score >= 40 ? "AT_RISK" : "CRITICAL";

  return { score, band, open, overdue, criticalOverdue, highOverdue, counts };
}
