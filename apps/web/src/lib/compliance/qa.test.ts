import { describe, expect, it } from "vitest";
import { answerQuestion, confidenceFor, retrievePassages, tokenize, type QaSource } from "./qa";

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

describe("token normalization", () => {
  it("collapses synonyms and strips suffixes", () => {
    expect(tokenize("How are cyber incidents reported?")).toEqual([
      "cyber",
      "incident",
      "report",
    ]);
    expect(tokenize("storage tested processes access")).toEqual([
      "store",
      "test",
      "process",
      "access",
    ]);
    expect(tokenize("withdrawals revoked")).toEqual(["withdraw", "withdraw"]);
  });
});

describe("hybrid retrieval", () => {
  const storageClause: QaSource = {
    id: "clause-rbi",
    label: "RBI/IT/2023/07 · Section 4.1 — Storage of payment system data",
    kind: "clause",
    text: "All regulated entities shall ensure that payment system data is stored only on servers located within India and shall not be replicated outside India.",
  };

  const distractorPolicy: QaSource = {
    id: "pol-priv",
    label: "POL-PRIV-01 Customer Privacy and Consent Policy",
    kind: "policy",
    text: "Customers may withdraw consent by writing to the privacy desk within 14 days.",
  };

  it("matches a question phrased with different words for the same concept", () => {
    const passages = retrievePassages("Where is payment data allowed to be stored?", [
      distractorPolicy,
      storageClause,
    ]);
    expect(passages[0]?.source.id).toBe("clause-rbi");
  });

  it("ranks the passage with the rarer evidence first", () => {
    const answer = answerQuestion("How often must penetration testing run?", [
      {
        id: "pol-test",
        label: "POL-TEST-01 Security testing policy",
        kind: "policy",
        text: "Security testing happens every six months.",
      },
      {
        id: "ctrl-vapt",
        label: "CTRL-SEC-09 Annual VAPT programme",
        kind: "control",
        text: "Vulnerability assessments and penetration tests are run annually by an external assessor.",
      },
    ]);
    expect(answer.citations[0]?.id).toBe("ctrl-vapt");
  });

  it("prefers a policy over a clause when the evidence is identical", () => {
    const text = "Cyber incidents are reported within 72 hours of detection.";
    const passages = retrievePassages("cyber incidents reported", [
      { id: "clause", label: "RBI circular", kind: "clause", text },
      { id: "policy", label: "POL-SEC-01", kind: "policy", text },
    ]);
    expect(passages[0]?.source.id).toBe("policy");
  });

  it("honors and clamps the passage limit", () => {
    const markers = ["alpha", "bravo", "charlie", "delta", "echo", "foxtrot", "golf", "hotel"];
    const many: QaSource[] = markers.map((marker, index) => ({
      id: `source-${index}`,
      label: `Source ${index}`,
      kind: "clause",
      text: `An incident about ${marker} must be reported.`,
    }));
    const query = `${markers.join(" ")} incident`;
    expect(retrievePassages(query, many, { limit: 99 })).toHaveLength(6);
    expect(retrievePassages(query, many, { limit: 0 })).toHaveLength(1);
  });

  it("returns nothing for an empty corpus or an empty query", () => {
    expect(retrievePassages("incident", [])).toEqual([]);
    expect(retrievePassages("what is the?", sources)).toEqual([]);
  });

  it("selects the sentence that contains the evidence", () => {
    const answer = answerQuestion("When must cyber incidents be reported?", [
      {
        id: "multi",
        label: "POL-SEC-01 Incident policy",
        kind: "policy",
        text: "The weather desk opens at nine. Cyber incidents are reported within 72 hours of detection. Reviews follow within five days.",
      },
    ]);
    expect(answer.citations[0]?.quote).toContain("Cyber incidents are reported");
  });

  it("keeps a label-only match without inventing quote text", () => {
    const answer = answerQuestion("vendor audit", [
      { id: "label-only", label: "CTRL vendor audit control", kind: "control", text: "" },
    ]);
    expect(answer.matched).toBe(true);
    expect(answer.citations[0]?.quote).toBe("");
  });
});

describe("confidence mapping", () => {
  it("is zero without evidence and saturates at the cap", () => {
    expect(confidenceFor(0)).toBe(0);
    expect(confidenceFor(-1)).toBe(0);
    expect(confidenceFor(1_000)).toBe(0.95);
  });
});
