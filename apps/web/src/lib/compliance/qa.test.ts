import { describe, expect, it } from "vitest";
import { answerQuestion, type QaSource } from "./qa";

const sources: QaSource[] = [
  {
    id: "pol-sec",
    label: "POL-SEC-02 Incident Response and Reporting Policy",
    kind: "policy",
    text: "Cyber security incidents are reported to IRDAI and CERT-In within 72 hours of detection. Post-incident reviews are completed within five business days.",
  },
  {
    id: "pol-priv",
    label: "POL-PRIV-01 Customer Privacy and Consent Policy",
    kind: "policy",
    text: "Customers may withdraw consent by writing to the privacy desk within 14 days. Personal data is retained for 18 months.",
  },
  {
    id: "ctrl-cloud",
    label: "CTRL-CLOUD-07 Cloud vendor audit control",
    kind: "control",
    text: "Cloud contracts include a right-to-audit clause and an annual audit calendar.",
  },
  {
    id: "clause-dpdp",
    label: "DPDP Act 2023 Section 6(4)",
    kind: "clause",
    text: "The Data Principal may withdraw consent at any time with comparable ease.",
  },
];

describe("policy-grounded Q&A", () => {
  it("answers with the best policy passage", () => {
    const answer = answerQuestion("What is our incident reporting window?", sources);

    expect(answer.matched).toBe(true);
    expect(answer.answer).toContain("POL-SEC-02");
    expect(answer.citations[0]?.id).toBe("pol-sec");
    expect(answer.confidence).toBeGreaterThan(0.5);
  });

  it("lists supporting citations in ranked order", () => {
    const answer = answerQuestion("How does consent withdrawal work?", sources);

    expect(answer.matched).toBe(true);
    expect(answer.citations[0]?.label).toContain("POL-PRIV-01");
    expect(answer.citations.length).toBeGreaterThan(1);
    expect(answer.answer).toContain("Related passages");
  });

  it("caps citations at three", () => {
    const answer = answerQuestion("cloud incident consent audit", sources);
    expect(answer.citations.length).toBe(3);
  });

  it("escalates when nothing matches", () => {
    const answer = answerQuestion("quantum-safe satellite telemetry", sources);

    expect(answer.matched).toBe(false);
    expect(answer.citations).toEqual([]);
    expect(answer.confidence).toBe(0);
    expect(answer.answer).toContain("Escalate");
  });

  it("rejects a question without searchable terms", () => {
    const answer = answerQuestion("what is the?", sources);
    expect(answer.matched).toBe(false);
    expect(answer.answer).toContain("searchable terms");
  });

  it("returns a single citation when only one passage matches", () => {
    const answer = answerQuestion("vendor audit calendar", sources);
    expect(answer.matched).toBe(true);
    expect(answer.citations).toHaveLength(1);
    expect(answer.answer).not.toContain("Related passages");
  });
});

describe("quote truncation", () => {
  it("truncates a long passage and keeps the citation", () => {
    const longText = `${"incident escalation procedure ".repeat(12)}`;
    const answer = answerQuestion("incident escalation", [
      { id: "long", label: "POL-LONG-01 Long policy", kind: "policy", text: longText },
    ]);
    expect(answer.matched).toBe(true);
    expect(answer.citations[0]?.quote.endsWith("...")).toBe(true);
  });
});

describe("questions without words", () => {
  it("returns the unsearchable-terms answer when no tokens survive", () => {
    const answer = answerQuestion("??", sources);
    expect(answer.matched).toBe(false);
    expect(answer.confidence).toBe(0);
  });
});
