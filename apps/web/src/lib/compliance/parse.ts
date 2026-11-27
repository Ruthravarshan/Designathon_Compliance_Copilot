import type { SourceClause } from "./types";

const SECTION_PATTERN =
  /^(?:Section|Clause|Chapter|Regulation|Article)\s+([\w().\-/]+)(?:\s*[:\-–]\s*(.+))?/i;
const NUMBERED_PATTERN = /^(\d+(?:\.\d+)*)(?:[.)])?\s+(.*)$/;
const MAX_CLAUSES = 60;
const MIN_CLAUSE_LENGTH = 24;

function sectionLabelFor(block: string, index: number): { label: string; heading?: string } {
  const firstLine = block.split("\n")[0]?.trim() ?? "";
  const section = SECTION_PATTERN.exec(firstLine);

  if (section) {
    const identifier = section[1] ?? String(index + 1);
    const heading = section[2]?.trim();
    return {
      label: `Section ${identifier}`,
      ...(heading ? { heading } : {}),
    };
  }

  const numbered = NUMBERED_PATTERN.exec(firstLine);
  if (numbered) {
    const identifier = numbered[1] ?? String(index + 1);
    return { label: `Clause ${identifier}` };
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
