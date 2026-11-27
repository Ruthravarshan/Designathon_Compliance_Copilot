import type { SourceClause } from "./types";

const SECTION_PATTERN =
  /^(?:Section|Clause|Chapter|Regulation|Article)\s+(?<identifier>[\w().\-/]+)(?:\s*[:\-–—]\s*(?<heading>.+))?/i;
const NUMBERED_PATTERN = /^(?<number>\d+(?:\.\d+)*)(?:[.)])?\s+/;
const MAX_CLAUSES = 60;
const MIN_CLAUSE_LENGTH = 24;

function sectionLabelFor(block: string, index: number): { label: string; heading?: string } {
  const firstLine = block.split("\n", 1).join("");
  const section = SECTION_PATTERN.exec(firstLine);

  if (section?.groups) {
    const heading = section.groups.heading?.trim();
    return {
      label: `Section ${section.groups.identifier}`,
      ...(heading ? { heading } : {}),
    };
  }

  const numbered = NUMBERED_PATTERN.exec(firstLine);
  if (numbered?.groups) {
    return { label: `Clause ${numbered.groups.number}` };
  }

  return { label: `Clause ${index + 1}` };
}

/**
 * Split pasted circular text into clause-sized blocks. Blank lines are the
 * delimiter; a leading section or clause number becomes the citation label.
 * Pasted text is cited as page 1 because page geometry is not available.
 */
export function parseDocumentText(text: string): SourceClause[] {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (normalized === "") {
    return [];
  }

  return normalized
    .split(/\n\s*\n+/)
    .map((block) => block.replace(/\s+$/g, "").trim())
    .filter((block) => block.length >= MIN_CLAUSE_LENGTH)
    .slice(0, MAX_CLAUSES)
    .map((block, index) => {
      const { label, heading } = sectionLabelFor(block, index);
      return {
        sectionLabel: `${label}, Page 1`,
        ...(heading ? { heading } : {}),
        pageNumber: 1,
        text: block.replace(/\n+/g, " ").replace(/\s+/g, " ").trim(),
      };
    });
}
