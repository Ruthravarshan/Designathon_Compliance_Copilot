import { describe, expect, it } from "vitest";
import { parseDocumentText } from "./parse";

describe("pasted document parsing", () => {
  it("returns no clauses for empty text", () => {
    expect(parseDocumentText("   \n\n  ")).toEqual([]);
  });

  it("splits paragraphs into clauses with section labels", () => {
    const text = [
      "Section 4.2 — Incident reporting",
      "Critical incidents shall be reported within six hours of detection to the regulator.",
      "",
      "Section 4.3: Evidence",
      "The regulated entity shall retain the incident report for five years.",
    ].join("\n");

    const clauses = parseDocumentText(text);

    expect(clauses).toHaveLength(2);
    expect(clauses[0]?.sectionLabel).toBe("Section 4.2, Page 1");
    expect(clauses[0]?.heading).toBe("Incident reporting");
    expect(clauses[0]?.pageNumber).toBe(1);
    expect(clauses[1]?.heading).toBe("Evidence");
  });

  it("uses numbered clause labels", () => {
    const text = "1. The entity shall report incidents within six hours of detection.";
    const clauses = parseDocumentText(text);

    expect(clauses[0]?.sectionLabel).toBe("Clause 1, Page 1");
  });

  it("falls back to positional labels", () => {
    const text = "The entity shall report incidents within six hours of detection.";
    const clauses = parseDocumentText(text);

    expect(clauses[0]?.sectionLabel).toBe("Clause 1, Page 1");
  });

  it("keeps numbered labels without a title separator", () => {
    const text = "2.3 The entity shall retain logs for one hundred eighty days.";
    const clauses = parseDocumentText(text);

    expect(clauses[0]?.sectionLabel).toBe("Clause 2.3, Page 1");
  });

  it("ignores short fragments", () => {
    const text =
      "Short.\n\nSection 1: Real rule\nThe entity shall report incidents within six hours.";
    const clauses = parseDocumentText(text);

    expect(clauses).toHaveLength(1);
    expect(clauses[0]?.sectionLabel).toBe("Section 1, Page 1");
  });

  it("caps the number of clauses and normalises whitespace", () => {
    const block = "Section 1: Rule\nIncidents shall be reported within six hours of detection.";
    const text = Array.from({ length: 70 }, () => block).join("\n\n");
    const clauses = parseDocumentText(text);

    expect(clauses).toHaveLength(60);
    expect(clauses[0]?.text).toBe(
      "Section 1: Rule Incidents shall be reported within six hours of detection.",
    );
  });

  it("handles CRLF input", () => {
    const text =
      "Section 2: Rule\r\nThe entity shall report incidents within six hours of detection.";
    const clauses = parseDocumentText(text);

    expect(clauses).toHaveLength(1);
    expect(clauses[0]?.text.startsWith("Section 2: Rule")).toBe(true);
  });
});

describe("label variants", () => {
  it("parses a regulation label without a heading", () => {
    const clauses = parseDocumentText(
      "Regulation 7 Governed entities shall report incidents within six hours.",
    );
    expect(clauses[0]?.sectionLabel).toBe("Section 7, Page 1");
    expect(clauses[0]?.heading).toBeUndefined();
  });

  it("parses a numbered clause with a closing parenthesis", () => {
    const clauses = parseDocumentText(
      "2) The entity shall retain incident evidence for five years.",
    );
    expect(clauses[0]?.sectionLabel).toBe("Clause 2, Page 1");
  });
});
