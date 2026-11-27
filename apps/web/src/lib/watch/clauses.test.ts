import { describe, expect, it } from "vitest";
import { pdfPagesToClauses, textToClauses } from "./clauses";

describe("textToClauses", () => {
  it("splits on blank lines and labels sections and numbered clauses", () => {
    const text = [
      "Section 4.2 Incident escalation",
      "Cyber security incidents shall be reported to the regulator within 72 hours of detection.",
      "",
      "5.1 Log retention",
      "Application logs must be retained for at least 180 days in the central archive.",
      "",
      "too short",
    ].join("\n");

    const clauses = textToClauses(text);
    expect(clauses).toHaveLength(2);
    expect(clauses[0]?.sectionLabel).toBe("Section 4.2, Page 1");
    expect(clauses[1]?.sectionLabel).toBe("Clause 5.1, Page 1");
    expect(clauses.every((clause) => clause.text.length >= 40)).toBe(true);
  });

  it("packs an oversized block into bounded chunks", () => {
    const sentence = "The entity shall maintain a documented control environment. ";
    const text = sentence.repeat(40);
    const clauses = textToClauses(text, { max: 10 });
    expect(clauses.length).toBeGreaterThan(1);
    expect(clauses.every((clause) => clause.text.length <= 900)).toBe(true);
  });

  it("handles empty input and respects the cap", () => {
    expect(textToClauses("   ")).toEqual([]);
    const blocks = Array.from(
      { length: 5 },
      (_, index) => `Paragraph ${index} that is definitely long enough to count as a clause.`,
    ).join("\n\n");
    expect(textToClauses(blocks, { max: 2 })).toHaveLength(2);
  });
});

describe("pdfPagesToClauses", () => {
  it("keeps real page numbers and a running label index", () => {
    const clauses = pdfPagesToClauses([
      {
        pageNumber: 1,
        text: "Section 1 Scope. This framework shall apply to all regulated entities and their vendors.",
      },
      {
        pageNumber: 2,
        text: "All incidents must be reported within six hours to the designated authority for action.",
      },
    ]);

    expect(clauses).toHaveLength(2);
    expect(clauses[0]?.pageNumber).toBe(1);
    expect(clauses[1]?.pageNumber).toBe(2);
    expect(clauses[1]?.sectionLabel.endsWith("Page 2")).toBe(true);
  });

  it("caps total clauses across pages", () => {
    const pages = Array.from({ length: 3 }, (_, index) => ({
      pageNumber: index + 1,
      text: "A sufficiently long obligation that shall be satisfied by the regulated entity.",
    }));
    expect(pdfPagesToClauses(pages, 1)).toHaveLength(1);
  });
});
