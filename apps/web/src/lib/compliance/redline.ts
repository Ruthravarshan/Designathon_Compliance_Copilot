import type {
  ExtractedObligation,
  GapStatus,
  MappingResult,
  Requirement,
  RedlineDraft,
} from "./types";

export interface RedlineInput {
  obligation: ExtractedObligation;
  mapping: MappingResult;
  citation: string;
  status: GapStatus;
}

function compliantWording(requirement: Requirement, citation: string): string {
  switch (requirement.kind) {
    case "cadence_months": {
      if (requirement.action === "vulnerability_assessment") {
        return `Critical IT systems shall undergo a vulnerability assessment at least once every ${requirement.months} months, per ${citation}.`;
      }
      if (requirement.action === "penetration_testing") {
        return `Critical IT systems shall undergo penetration testing at least once every ${requirement.months} months, per ${citation}.`;
      }
      return `Disaster recovery drills shall be conducted at least once every ${requirement.months} months, per ${citation}.`;
    }
    case "incident_reporting_hours":
      return `Critical and cyber security incidents shall be reported to ${requirement.recipients.join(" and ")} within ${requirement.hours} hours of detection, per ${citation}.`;
    case "breach_notification":
      return `Personal data breaches shall be notified to ${requirement.recipients.join(" and ")}${
        requirement.notifyPrincipals ? " and each affected Data Principal" : ""
      } in the prescribed form, per ${citation}.`;
    case "data_residency":
      return `All regulated data shall be stored exclusively on servers located within India, per ${citation}.`;
    case "consent_withdrawal":
      return `Data Principals shall be able to withdraw consent through the same interface used to give it, with comparable ease, per ${citation}.`;
    case "third_party_sharing_consent":
      return `The regulated entity shall obtain explicit consent before sharing personal data with any third party, per ${citation}.`;
    case "erasure_on_withdrawal":
      return `Personal data shall be erased upon withdrawal of consent or completion of purpose, unless retention is required by law, per ${citation}.`;
    case "log_retention_days":
      return `System logs shall be retained for at least ${requirement.days} days, per ${citation}.`;
    case "third_party_audit":
      return `Contracts with cloud service providers shall include a right to audit and an annual audit plan, per ${citation}.`;
    case "key_management":
      return `Cryptographic keys for regulated data shall be customer-managed under a BYOK model, per ${citation}.`;
    case "board_reporting":
      return `The CISO shall report directly to the Board or a Board-level committee, per ${citation}.`;
    case "risk_committee":
      return `The Board shall constitute a Risk Management Committee and review its charter annually, per ${citation}.`;
    case "grievance_contact":
      return `The data fiduciary shall publish the contact details of its Data Protection Officer and grievance officer, per ${citation}.`;
    case "manual_review":
      return `The control owner shall document how this obligation is met, per ${citation}.`;
  }
}

function taskTitle(requirement: Requirement): string {
  switch (requirement.kind) {
    case "cadence_months":
      if (requirement.action === "vulnerability_assessment") {
        return `Move vulnerability assessments to a ${requirement.months}-month cycle`;
      }
      if (requirement.action === "penetration_testing") {
        return `Run penetration tests every ${requirement.months} months`;
      }
      return `Run DR drills every ${requirement.months} months`;
    case "incident_reporting_hours":
      return `Cut incident reporting to ${requirement.hours} hours`;
    case "breach_notification":
      return "Notify affected Data Principals on a breach";
    case "data_residency":
      return "Move regulated storage into India";
    case "consent_withdrawal":
      return "Ship one-click consent withdrawal";
    case "third_party_sharing_consent":
      return "Add a third-party sharing consent gate";
    case "erasure_on_withdrawal":
      return "Erase data on consent withdrawal";
    case "log_retention_days":
      return `Retain logs for ${requirement.days} days`;
    case "third_party_audit":
      return "Add right-to-audit to cloud contracts";
    case "key_management":
      return "Move regulated keys to BYOK";
    case "board_reporting":
      return "Move the CISO reporting line to the Board";
    case "risk_committee":
      return "Evidence the Risk Management Committee charter";
    case "grievance_contact":
      return "Publish the DPO grievance contact";
    case "manual_review":
      return "Document the control response";
  }
}

/**
 * Draft a policy redline and owner task. `before` is the current internal
 * wording (or an explicit gap statement); `after` keeps the citation attached
 * so the approved change is traceable.
 */
export function draftRedline({
  obligation,
  mapping,
  citation,
  status,
}: RedlineInput): RedlineDraft {
  const record = mapping.best;
  const before = record
    ? `${record.code} ${record.section} — ${record.text}`
    : "No internal policy or control covers this obligation.";

  if (status === "COMPLIANT") {
    return {
      before,
      after: before,
      taskTitle: `Retain evidence: ${taskTitle(obligation.requirement)}`,
      taskAction:
        "No policy change is required. Attach the control evidence to the next compliance review.",
      assigneeName: record?.ownerName ?? "Compliance Office",
      assigneeEmail: record?.ownerEmail ?? "compliance@hexa.example",
    };
  }

  const wording = compliantWording(obligation.requirement, citation);
  const after = record
    ? `${record.code} ${record.section} — ${wording}`
    : `New policy required — ${wording}`;

  return {
    before,
    after,
    taskTitle: taskTitle(obligation.requirement),
    taskAction: obligation.actionRequired,
    assigneeName: record?.ownerName ?? "Compliance Office",
    assigneeEmail: record?.ownerEmail ?? "compliance@hexa.example",
  };
}

export interface DiffToken {
  value: string;
  type: "equal" | "added" | "removed";
}

const MAX_DIFF_TOKENS = 400;

/**
 * Word-level diff for the redline view. Bounded in size; if a pair of texts is
 * larger than the cap it degrades to a remove-all/add-all pair.
 */
export function diffWords(before: string, after: string): DiffToken[] {
  const beforeTokens = before.trim() === "" ? [] : before.trim().split(/\s+/);
  const afterTokens = after.trim() === "" ? [] : after.trim().split(/\s+/);

  if (beforeTokens.length > MAX_DIFF_TOKENS || afterTokens.length > MAX_DIFF_TOKENS) {
    return [
      ...(beforeTokens.length > 0
        ? [{ value: beforeTokens.join(" "), type: "removed" as const }]
        : []),
      ...(afterTokens.length > 0 ? [{ value: afterTokens.join(" "), type: "added" as const }] : []),
    ];
  }

  const rows = beforeTokens.length + 1;
  const cols = afterTokens.length + 1;
  const matrix: number[][] = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));
  // Row and column bounds are fixed by the loops below, so the lookups always resolve.
  const get = (row: number, col: number): number => matrix[row]![col]!;
  const set = (row: number, col: number, value: number): void => {
    matrix[row]![col] = value;
  };

  for (let row = 1; row < rows; row += 1) {
    for (let col = 1; col < cols; col += 1) {
      if (beforeTokens[row - 1] === afterTokens[col - 1]) {
        set(row, col, get(row - 1, col - 1) + 1);
      } else {
        set(row, col, Math.max(get(row - 1, col), get(row, col - 1)));
      }
    }
  }

  const reversed: DiffToken[] = [];
  let row = beforeTokens.length;
  let col = afterTokens.length;

  while (row > 0 || col > 0) {
    if (row > 0 && col > 0 && beforeTokens[row - 1] === afterTokens[col - 1]) {
      reversed.push({ value: beforeTokens[row - 1] ?? "", type: "equal" });
      row -= 1;
      col -= 1;
    } else if (col > 0 && (row === 0 || get(row, col - 1) >= get(row - 1, col))) {
      reversed.push({ value: afterTokens[col - 1] ?? "", type: "added" });
      col -= 1;
    } else {
      reversed.push({ value: beforeTokens[row - 1] ?? "", type: "removed" });
      row -= 1;
    }
  }

  const tokens = reversed.reverse();
  const merged: DiffToken[] = [];

  for (const token of tokens) {
    const last = merged[merged.length - 1];
    if (last && last.type === token.type) {
      last.value = `${last.value} ${token.value}`;
    } else {
      merged.push({ ...token });
    }
  }

  return merged;
}
