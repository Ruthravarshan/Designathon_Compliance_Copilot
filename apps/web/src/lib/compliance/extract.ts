import type { ExtractedObligation, ObligationType, Requirement, SourceClause } from "./types";

const MODAL = /\b(shall|must|is required to|are required to|shall not|must not|may not)\b/i;

const NUMBER_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  eighteen: 18,
  twenty: 20,
  "twenty four": 24,
  "twenty-four": 24,
  thirty: 30,
  "thirty six": 36,
  "thirty-six": 36,
  forty: 40,
  fortyfive: 45,
  "forty five": 45,
  "forty-five": 45,
  sixty: 60,
  ninety: 90,
  "one hundred eighty": 180,
  "one-hundred-eighty": 180,
};

const ROLE_BY_TYPE: Record<ObligationType, string> = {
  SECURITY_TESTING: "Information Security / CISO",
  INCIDENT_REPORTING: "Information Security / CISO",
  DATA_LOCALIZATION: "Cloud Platform / DevOps",
  CONSENT: "Data Protection Officer / Product",
  DATA_RETENTION: "Data Protection Officer / Legal",
  THIRD_PARTY_AUDIT: "Vendor Risk / Procurement",
  CRYPTOGRAPHY: "Cloud Platform / CISO",
  RESILIENCE: "IT Operations / CISO",
  LOGGING: "Security Operations",
  GOVERNANCE: "Board / CISO",
  GRIEVANCE: "Compliance / Grievance Officer",
  OTHER: "Compliance Office",
};

function normalize(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function parseCount(raw: string): number {
  const cleaned = raw.toLowerCase().trim().replace(/\s+/g, " ");
  if (/^\d+$/.test(cleaned)) {
    return Number.parseInt(cleaned, 10);
  }

  // COUNT_TOKEN is generated from these keys, so the lookup always resolves.
  return NUMBER_WORDS[cleaned]!;
}

const COUNT_TOKEN = `(?:\\d{1,3}|${Object.keys(NUMBER_WORDS)
  .sort((a, b) => b.length - a.length)
  .join("|")})`;

interface ParsedDuration {
  value: number;
  unit: "months" | "years" | "hours" | "days";
  endIndex: number;
}

function parseMonths(window: string, offset: number): ParsedDuration | null {
  const patterns = [
    new RegExp(`once\\s+(?:in|every)\\s+(?<count>${COUNT_TOKEN})\\s+(?<unit>months?|years?)`, "i"),
    new RegExp(`every\\s+(?<count>${COUNT_TOKEN})\\s+(?<unit>months?|years?)`, "i"),
    new RegExp(
      `at least once (?:in|every)\\s+(?<count>${COUNT_TOKEN})\\s+(?<unit>months?|years?)`,
      "i",
    ),
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(window);
    if (!match?.groups) {
      continue;
    }

    // The pattern is generated with these exact named groups, so they always resolve.
    const { count: rawCount, unit: rawUnit } = match.groups as { count: string; unit: string };
    const count = parseCount(rawCount);
    const years = rawUnit.toLowerCase().startsWith("year");
    return {
      value: years ? count * 12 : count,
      unit: years ? "years" : "months",
      endIndex: offset + match.index + match[0].length,
    };
  }

  return null;
}

function parseHours(window: string, offset: number): ParsedDuration | null {
  const pattern = new RegExp(
    `within\\s+(?:a period of\\s+)?(?<count>${COUNT_TOKEN})\\s*(?:hours?|hrs?)`,
    "i",
  );
  const match = pattern.exec(window);
  if (!match) {
    return null;
  }

  return {
    // The pattern above always captures this group.
    value: parseCount((match.groups as { count: string }).count),
    unit: "hours",
    endIndex: offset + match.index + match[0].length,
  };
}

function parseDays(window: string, offset: number): ParsedDuration | null {
  const pattern = new RegExp(
    `(?:retain|retention)[\\s\\S]{0,180}?(?<count>${COUNT_TOKEN})\\s+(days?)`,
    "i",
  );
  const match = pattern.exec(window);
  if (!match) {
    return null;
  }

  return {
    // The pattern above always captures this group.
    value: parseCount((match.groups as { count: string }).count),
    unit: "days",
    endIndex: offset + match.index + match[0].length,
  };
}

function confidenceFor(quote: string, numeric: boolean, sectionLabel: string): number {
  const confidence = 0.84 + (numeric ? 0.08 : 0) + (sectionLabel.trim() ? 0.04 : 0);
  return round2(Math.min(0.98, quote.length >= 80 ? confidence + 0.02 : confidence));
}

interface BuildInput {
  type: ObligationType;
  requirement: Requirement;
  quote: string;
  sectionLabel: string;
  plainLanguage: string;
  actionRequired: string;
  sla?: string;
  numeric: boolean;
}

function build(input: BuildInput): ExtractedObligation {
  return {
    type: input.type,
    plainLanguage: input.plainLanguage,
    actionRequired: input.actionRequired,
    applicableTo: ROLE_BY_TYPE[input.type],
    requirement: input.requirement,
    ...(input.sla === undefined ? {} : { sla: input.sla }),
    extractionConfidence: confidenceFor(input.quote, input.numeric, input.sectionLabel),
    quote: input.quote,
  };
}

function recipientsFrom(text: string): string[] {
  const known: Array<[RegExp, string]> = [
    [/CERT-In/i, "CERT-In"],
    [/\bIRDAI\b/i, "IRDAI"],
    [/\bRBI\b|Reserve Bank of India/i, "RBI"],
    [/\bSEBI\b/i, "SEBI"],
    [/Data Protection Board/i, "Data Protection Board"],
    [/MeitY|Ministry of Electronics/i, "MeitY"],
  ];

  const found = known.filter(([pattern]) => pattern.test(text)).map(([, name]) => name);
  return found.length > 0 ? found : ["the regulator"];
}

function manual(
  type: ObligationType,
  quote: string,
  sectionLabel: string,
  note: string,
  plainLanguage: string,
): ExtractedObligation {
  return {
    type,
    plainLanguage,
    actionRequired: "Assign the obligation to an owner and document the control response.",
    applicableTo: ROLE_BY_TYPE[type],
    requirement: { kind: "manual_review", note },
    extractionConfidence: 0.72,
    quote,
  };
}

/**
 * Extract atomic obligations from one clause. A single clause can contain more
 * than one duty (for example VA and PT cadences), so the result is a list.
 */
export function extractObligations(clause: SourceClause): ExtractedObligation[] {
  const text = normalize(clause.text);
  if (!MODAL.test(text)) {
    return [];
  }

  const lower = text.toLowerCase();
  const quote = text;

  if (/personal data breach/i.test(text) && /notify/i.test(text)) {
    const recipients = recipientsFrom(text);
    const notifyPrincipals = /each affected data principal|affected data principals/i.test(text);
    return [
      build({
        type: "INCIDENT_REPORTING",
        requirement: { kind: "breach_notification", notifyPrincipals, recipients },
        quote,
        sectionLabel: clause.sectionLabel,
        plainLanguage:
          "Personal data breaches must be notified to the Data Protection Board and the affected Data Principals.",
        actionRequired:
          "Define a breach notification path to the Board and each affected Data Principal, with evidence retained.",
        numeric: /\b\d+\s*(?:hours?|days?)\b/i.test(text),
      }),
    ];
  }

  if (
    /(stored|storage|located|reside|stored exclusively)[^.]{0,80}(within|in) india/i.test(text) ||
    /localis|localiz/i.test(lower)
  ) {
    return [
      build({
        type: "DATA_LOCALIZATION",
        requirement: { kind: "data_residency", region: "India" },
        quote,
        sectionLabel: clause.sectionLabel,
        plainLanguage:
          "All regulated data must be stored exclusively on servers located within India.",
        actionRequired:
          "Move affected storage to an India region, block cross-border replication, and test the control.",
        numeric: false,
      }),
    ];
  }

  const vaIndex = lower.indexOf("vulnerability assessment");
  const ptIndex = lower.indexOf("penetration test");

  if (vaIndex >= 0 || ptIndex >= 0) {
    const obligations: ExtractedObligation[] = [];

    if (vaIndex >= 0) {
      const duration = parseMonths(text.slice(vaIndex, vaIndex + 200), vaIndex);
      if (duration) {
        obligations.push(
          build({
            type: "SECURITY_TESTING",
            requirement: {
              kind: "cadence_months",
              action: "vulnerability_assessment",
              months: duration.value,
            },
            quote,
            sectionLabel: clause.sectionLabel,
            plainLanguage: `Critical IT systems must undergo a vulnerability assessment at least once every ${duration.value} months.`,
            actionRequired: `Move vulnerability assessments to a ${duration.value}-month cadence and retain the reports.`,
            sla: `Every ${duration.value} months`,
            numeric: true,
          }),
        );
      } else {
        obligations.push(
          manual(
            "SECURITY_TESTING",
            quote,
            clause.sectionLabel,
            "Vulnerability assessment cadence was not specified.",
            "Critical IT systems must undergo vulnerability assessments.",
          ),
        );
      }
    }

    if (ptIndex >= 0) {
      const duration = parseMonths(text.slice(ptIndex, ptIndex + 200), ptIndex);
      if (duration) {
        obligations.push(
          build({
            type: "SECURITY_TESTING",
            requirement: {
              kind: "cadence_months",
              action: "penetration_testing",
              months: duration.value,
            },
            quote,
            sectionLabel: clause.sectionLabel,
            plainLanguage: `Critical IT systems must undergo penetration testing at least once every ${duration.value} months.`,
            actionRequired: `Run penetration tests at least every ${duration.value} months and track remediation.`,
            sla: `Every ${duration.value} months`,
            numeric: true,
          }),
        );
      } else {
        obligations.push(
          manual(
            "SECURITY_TESTING",
            quote,
            clause.sectionLabel,
            "Penetration testing cadence was not specified.",
            "Critical IT systems must undergo penetration testing.",
          ),
        );
      }
    }

    return obligations;
  }

  if (/cyber incident|security incident/i.test(text) && /report|notify/i.test(text)) {
    const duration = parseHours(text, 0);
    const recipients = recipientsFrom(text);
    if (duration) {
      return [
        build({
          type: "INCIDENT_REPORTING",
          requirement: {
            kind: "incident_reporting_hours",
            hours: duration.value,
            recipients,
          },
          quote,
          sectionLabel: clause.sectionLabel,
          plainLanguage: `Cyber incidents must be reported to ${recipients.join(" and ")} within ${duration.value} hours of detection.`,
          actionRequired: `Cut the incident reporting SLA to ${duration.value} hours and rehearse the runbook.`,
          sla: `${duration.value} hours from detection`,
          numeric: true,
        }),
      ];
    }

    return [
      manual(
        "INCIDENT_REPORTING",
        quote,
        clause.sectionLabel,
        "Incident reporting window was not specified.",
        "Cyber incidents must be reported to the regulator.",
      ),
    ];
  }

  if (/right to audit|audit the cloud|audit of the cloud|right of audit/i.test(text)) {
    return [
      build({
        type: "THIRD_PARTY_AUDIT",
        requirement: { kind: "third_party_audit" },
        quote,
        sectionLabel: clause.sectionLabel,
        plainLanguage:
          "The regulated entity must retain a right to audit its cloud service providers.",
        actionRequired:
          "Add a right-to-audit clause to every cloud contract and schedule the first audit.",
        numeric: false,
      }),
    ];
  }

  if (/bring your own key|\bbyok\b|customer-managed key|key management/i.test(text)) {
    return [
      build({
        type: "CRYPTOGRAPHY",
        requirement: { kind: "key_management", standard: "byok" },
        quote,
        sectionLabel: clause.sectionLabel,
        plainLanguage:
          "Cryptographic keys for regulated data must follow a bring-your-own-key (BYOK) model.",
        actionRequired:
          "Move regulated keys to a BYOK or customer-managed key model and document custody.",
        numeric: false,
      }),
    ];
  }

  if (/\blogs?\b/i.test(text) && /retain|retention/i.test(text)) {
    const duration = parseDays(text, 0);
    if (duration) {
      return [
        build({
          type: "LOGGING",
          requirement: { kind: "log_retention_days", days: duration.value },
          quote,
          sectionLabel: clause.sectionLabel,
          plainLanguage: `System logs must be retained for at least ${duration.value} days.`,
          actionRequired: `Extend immutable log retention to at least ${duration.value} days.`,
          sla: `${duration.value} days`,
          numeric: true,
        }),
      ];
    }

    return [
      manual(
        "LOGGING",
        quote,
        clause.sectionLabel,
        "Log retention period was not specified.",
        "System logs must be retained for the period required by the regulator.",
      ),
    ];
  }

  if (/erase|erasure/i.test(text)) {
    return [
      build({
        type: "DATA_RETENTION",
        requirement: { kind: "erasure_on_withdrawal" },
        quote,
        sectionLabel: clause.sectionLabel,
        plainLanguage:
          "Personal data must be erased when consent is withdrawn or the purpose is served, unless retention is legally required.",
        actionRequired:
          "Implement erasure on withdrawal and purpose completion, with an auditable legal-hold exception.",
        numeric: false,
      }),
    ];
  }

  if (/withdraw[^.]{0,80}consent|withdrawal of consent|revoke[^.]{0,40}consent/i.test(text)) {
    return [
      build({
        type: "CONSENT",
        requirement: { kind: "consent_withdrawal", standard: "comparable_ease" },
        quote,
        sectionLabel: clause.sectionLabel,
        plainLanguage: "Customers must be able to withdraw consent as easily as they gave it.",
        actionRequired: "Ship a self-service consent withdrawal path with comparable ease.",
        numeric: false,
      }),
    ];
  }

  if (
    /sharing[^.]{0,80}third part|third part[^.]{0,80}sharing|before sharing[^.]{0,80}(data|information)/i.test(
      text,
    )
  ) {
    return [
      build({
        type: "CONSENT",
        requirement: { kind: "third_party_sharing_consent" },
        quote,
        sectionLabel: clause.sectionLabel,
        plainLanguage:
          "Explicit consent must be obtained before sharing customer data with any third party.",
        actionRequired: "Add an explicit consent gate before any third-party data sharing.",
        numeric: false,
      }),
    ];
  }

  if (/disaster recovery|\bdr\b[^.]{0,20}drill|business continuity/i.test(text)) {
    const duration = parseMonths(text, Math.max(0, lower.indexOf("disaster recovery")));
    if (duration) {
      return [
        build({
          type: "RESILIENCE",
          requirement: {
            kind: "cadence_months",
            action: "disaster_recovery_drill",
            months: duration.value,
          },
          quote,
          sectionLabel: clause.sectionLabel,
          plainLanguage: `Disaster recovery drills must run at least once every ${duration.value} months.`,
          actionRequired: `Run DR drills every ${duration.value} months and publish the results.`,
          sla: `Every ${duration.value} months`,
          numeric: true,
        }),
      ];
    }

    return [
      manual(
        "RESILIENCE",
        quote,
        clause.sectionLabel,
        "Disaster recovery cadence was not specified.",
        "Disaster recovery drills must be conducted.",
      ),
    ];
  }

  if (/ciso[^.]{0,120}(report|board)|report[^.]{0,120}board/i.test(text)) {
    return [
      build({
        type: "GOVERNANCE",
        requirement: { kind: "board_reporting" },
        quote,
        sectionLabel: clause.sectionLabel,
        plainLanguage: "The CISO must report to the Board or a Board-level committee.",
        actionRequired: "Change the CISO reporting line to the Board or a Board-level committee.",
        numeric: false,
      }),
    ];
  }

  if (/risk management committee/i.test(text)) {
    return [
      build({
        type: "GOVERNANCE",
        requirement: { kind: "risk_committee" },
        quote,
        sectionLabel: clause.sectionLabel,
        plainLanguage: "The Board must constitute a Risk Management Committee.",
        actionRequired:
          "Confirm the Board-level Risk Management Committee charter and retain evidence.",
        numeric: false,
      }),
    ];
  }

  if (/grievance|complaint[^.]{0,60}officer|data protection officer[^.]{0,60}contact/i.test(text)) {
    return [
      build({
        type: "GRIEVANCE",
        requirement: { kind: "grievance_contact" },
        quote,
        sectionLabel: clause.sectionLabel,
        plainLanguage:
          "The data fiduciary must publish a grievance or Data Protection Officer contact.",
        actionRequired: "Publish a grievance or Data Protection Officer contact on the trust page.",
        numeric: false,
      }),
    ];
  }

  const end = quote.search(/[.!?](?=\s|$)/);
  const firstSentence = end === -1 ? quote : quote.slice(0, end + 1);
  return [
    manual(
      "OTHER",
      quote,
      clause.sectionLabel,
      "No typed requirement matched this clause.",
      firstSentence.length > 220 ? `${firstSentence.slice(0, 217)}...` : firstSentence,
    ),
  ];
}
