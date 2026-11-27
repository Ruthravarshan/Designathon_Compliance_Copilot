import { describe, expect, it } from "vitest";
import { REFUSAL_ANSWER } from "./qa";
import {
  groundedCandidateSchema,
  normalizeQuote,
  verifyGroundedAnswer,
  type GroundedPassage,
} from "./qa-grounding";

const passages: GroundedPassage[] = [
  {
    id: "pol-sec",
    label: "POL-SEC-02 · Incident Response and Reporting Policy",
    text: "Cyber security incidents are reported to IRDAI and CERT-In within 72 hours of detection. Post-incident reviews are completed within five business days.",
  },
  {
    id: "clause-irdai",
    label: "IRDAI/IT/CYBER/2023 · Section 4.2 — Incident reporting",
    text: "Critical and cyber security incidents shall be reported to the IRDAI within six hours of detection, along with the root cause and containment actions.",
  },
  {
    id: "pol-ret",
    label: "POL-RET-03 · Records Retention Policy",
    text: "Application and security logs are retained for 90 days in the central log archive.",
  },
  {
    id: "ctrl-vapt",
    label: "CTRL-SEC-09 · Annual VAPT programme",
    text: "Vulnerability assessments and penetration tests are run annually by an external assessor.",
  },
];

const QUOTE =
  "Cyber security incidents are reported to IRDAI and CERT-In within 72 hours of detection";

function candidate(input: unknown) {
  return groundedCandidateSchema.parse(input);
}

describe("grounded answer verification", () => {
  it("keeps a verbatim citation and reports the passage label", () => {
    const result = verifyGroundedAnswer(
      candidate({
        decision: "answer",
        answer: "Incidents go to IRDAI and CERT-In within 72 hours.",
        citations: [{ passage: 1, quote: QUOTE }],
      }),
      passages,
    );

    expect(result.matched).toBe(true);
    expect(result.citations).toHaveLength(1);
    expect(result.citations[0]).toMatchObject({ id: "pol-sec" });
    expect(result.citations[0]?.label).toContain("POL-SEC-02");
    expect(result.confidence).toBeGreaterThan(0.7);
  });

  it("tolerates case and whitespace noise but not invented words", () => {
    const result = verifyGroundedAnswer(
      candidate({
        decision: "answer",
        answer: "Within six hours.",
        citations: [
          {
            passage: 2,
            quote: "  critical   and CYBER security incidents shall be reported to the irdai within six hours ",
          },
        ],
      }),
      passages,
    );

    expect(result.matched).toBe(true);
    expect(result.citations[0]?.quote).toBe(
      "critical and CYBER security incidents shall be reported to the irdai within six hours",
    );
  });

  it("refuses an answer whose quote is not a substring of the cited passage", () => {
    const result = verifyGroundedAnswer(
      candidate({
        decision: "answer",
        answer: "Incidents must be reported within two hours.",
        citations: [{ passage: 1, quote: "Incidents must be reported within two hours" }],
      }),
      passages,
    );

    expect(result.matched).toBe(false);
    expect(result.citations).toEqual([]);
    expect(result.answer).toBe(REFUSAL_ANSWER);
    expect(result.confidence).toBe(0);
  });

  it("refuses an answer that cites a passage outside the retrieved set", () => {
    const result = verifyGroundedAnswer(
      candidate({
        decision: "answer",
        answer: "Something.",
        citations: [{ passage: 9, quote: QUOTE }],
      }),
      passages,
    );
    expect(result.matched).toBe(false);
  });

  it("drops duplicate citations to the same passage", () => {
    const result = verifyGroundedAnswer(
      candidate({
        decision: "answer",
        answer: "Incidents go to IRDAI.",
        citations: [
          { passage: 1, quote: QUOTE },
          { passage: 1, quote: "Post-incident reviews are completed within five business days" },
        ],
      }),
      passages,
    );
    expect(result.citations).toHaveLength(1);
  });

  it("caps verified citations at three", () => {
    const result = verifyGroundedAnswer(
      candidate({
        decision: "answer",
        answer: "A summary.",
        citations: [
          { passage: 1, quote: QUOTE },
          { passage: 2, quote: "Critical and cyber security incidents shall be reported" },
          { passage: 3, quote: "Application and security logs are retained for 90 days" },
          { passage: 4, quote: "Vulnerability assessments and penetration tests are run annually" },
        ],
      }),
      passages,
    );
    expect(result.matched).toBe(true);
    expect(result.citations).toHaveLength(3);
  });

  it("passes an explicit refusal through without citations", () => {
    const result = verifyGroundedAnswer(
      candidate({
        decision: "insufficient",
        answer: "The register does not state where backups are hosted.",
        citations: [],
      }),
      passages,
    );

    expect(result.matched).toBe(false);
    expect(result.answer).toBe("The register does not state where backups are hosted.");
    expect(result.citations).toEqual([]);
  });

  it("normalizes unicode width and zero-width characters", () => {
    expect(normalizeQuote("ｉｎｃｉｄｅｎｔ\u200B  report")).toBe("incident report");
  });
});

describe("grounded answer schema", () => {
  it("rejects unknown fields, bad decisions, and short quotes", () => {
    const base = { decision: "answer", answer: "ok", citations: [] };

    expect(groundedCandidateSchema.safeParse({ ...base, extra: true }).success).toBe(false);
    expect(groundedCandidateSchema.safeParse({ ...base, decision: "maybe" }).success).toBe(false);
    expect(
      groundedCandidateSchema.safeParse({
        ...base,
        citations: [{ passage: 1, quote: "too short" }],
      }).success,
    ).toBe(false);
    expect(groundedCandidateSchema.safeParse(base).success).toBe(true);
  });
});
