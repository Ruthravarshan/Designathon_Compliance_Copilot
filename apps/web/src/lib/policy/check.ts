import { computePosture, type PostureFinding, type PostureSummary } from "../watch/posture";

export type PolicyOutcome = "COMPLIANT" | "AT_RISK" | "GAPS";

export interface PolicyAssessment {
  result: PolicyOutcome;
  score: number;
  open: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  overdue: number;
  summary: string;
  posture: PostureSummary;
}

/**
 * Assess one internal policy against the findings mapped to it. Critical/high
 * open gaps dominate; medium/low are "at risk"; nothing open is compliant.
 */
export function assessPolicy(findings: readonly PostureFinding[], now: Date): PolicyAssessment {
  const posture = computePosture(findings, now);
  const { critical, high, medium, low } = posture.counts;

  let result: PolicyOutcome;
  if (critical + high > 0) {
    result = "GAPS";
  } else if (posture.open > 0) {
    result = "AT_RISK";
  } else {
    result = "COMPLIANT";
  }

  let summary: string;
  if (result === "GAPS") {
    summary = `${critical} critical and ${high} high obligations are open for this policy${
      posture.overdue > 0 ? `; ${posture.overdue} overdue` : ""
    }.`;
  } else if (result === "AT_RISK") {
    summary = `${medium + low} medium/low obligations remain open for this policy${
      posture.overdue > 0 ? `; ${posture.overdue} overdue` : ""
    }.`;
  } else {
    summary = "No open obligations are mapped to this policy.";
  }

  return {
    result,
    score: posture.score,
    open: posture.open,
    critical,
    high,
    medium,
    low,
    overdue: posture.overdue,
    summary,
    posture,
  };
}
