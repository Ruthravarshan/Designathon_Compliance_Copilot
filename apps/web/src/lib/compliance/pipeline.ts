import { extractObligations } from "./extract";
import { assessGap } from "./gap";
import { mapObligation } from "./mapping";
import { draftRedline } from "./redline";
import type { ComplianceRecord, FindingDraft, RegulatorKey, Severity, SourceClause } from "./types";
import { criticNotes, verifyCitation } from "./verify";

const DUE_DAYS: Record<Severity, number> = {
  CRITICAL: 7,
  HIGH: 14,
  MEDIUM: 30,
  LOW: 60,
};

export function dueDateFor(severity: Severity, now: Date): Date {
  const due = new Date(now.getTime());
  due.setUTCDate(due.getUTCDate() + DUE_DAYS[severity]);
  due.setUTCHours(12, 0, 0, 0);
  return due;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export interface AnalyzeClauseInput {
  document: {
    key: string;
    regulator: RegulatorKey;
    reference: string;
    effectiveAt?: Date | null;
  };
  clause: SourceClause;
  clauseOrder: number;
  policies: readonly ComplianceRecord[];
  controls: readonly ComplianceRecord[];
  now: Date;
}

/**
 * Run the full deterministic pipeline for one clause:
 * extract -> verify citation -> map -> assess gap -> draft redline.
 */
export function analyzeClause(input: AnalyzeClauseInput): FindingDraft[] {
  const obligations = extractObligations(input.clause);
  const citation = `${input.document.regulator} ${input.document.reference} · ${input.clause.sectionLabel}`;

  return obligations.map((obligation, index) => {
    const reference = `OBL-${input.document.regulator}-${input.document.key}-${pad(
      input.clauseOrder,
    )}-${pad(index + 1)}`;
    const check = verifyCitation(input.clause.text, obligation.quote);
    const mapping = mapObligation(obligation, input.policies, input.controls);
    const gap = assessGap(obligation, mapping, check.verified);
    const redline = draftRedline({
      obligation,
      mapping,
      citation,
      status: gap.status,
    });

    const dueDate = dueDateFor(gap.severity, input.now);
    const compliant = gap.status === "COMPLIANT";

    return {
      obligation: {
        reference,
        plainLanguage: obligation.plainLanguage,
        actionRequired: obligation.actionRequired,
        applicableTo: obligation.applicableTo,
        type: obligation.type,
        requirement: obligation.requirement,
        ...(obligation.sla === undefined ? {} : { sla: obligation.sla }),
        extractionConfidence: obligation.extractionConfidence,
        citationVerified: check.verified,
        criticNotes: criticNotes(check, mapping.best !== null),
      },
      mapping: {
        policyCode: mapping.policy?.code ?? null,
        controlCode: mapping.control?.code ?? null,
        confidence: mapping.confidence,
        rationale: mapping.rationale,
      },
      finding: {
        status: gap.status,
        severity: gap.severity,
        gapDescription: gap.description,
        severityRationale: gap.rationale,
        citationVerified: gap.citationVerified,
        extractionConfidence: obligation.extractionConfidence,
        mappingConfidence: gap.mappingConfidence,
        confidence: gap.confidence,
        dueDate,
        redlineBefore: redline.before,
        redlineAfter: redline.after,
        taskTitle: compliant ? null : redline.taskTitle,
        taskAssignee: compliant ? null : redline.assigneeName,
        taskAssigneeEmail: compliant ? null : redline.assigneeEmail,
        taskDueDate: compliant ? null : dueDate,
        reviewStatus: compliant ? "NOT_REQUIRED" : "PENDING_REVIEW",
      },
    };
  });
}
