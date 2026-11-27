import type { SourceClause } from "../compliance/types";

const SECTION_PATTERN =
  /^(?:Section|Clause|Chapter|Regulation|Article|Part)\s+(?<identifier>[\w().\-/]+)(?:\s*[:\-–—]\s*(?<heading>.+))?/i;
const NUMBERED_PATTERN = /^(?<number>\d+(?:\.\d+)*)(?:[.)])?\s+/;

const MIN_CLAUSE_CHARS = 40;
const MAX_CLAUSE_CHARS = 900;

function labelFor(block: string, globalIndex: number): { label: string; heading?: string } {
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

  return { label: `Clause ${globalIndex}` };
}

function splitLongBlock(block: string): string[] {
  if (block.length <= MAX_CLAUSE_CHARS) {
    return [block];
  }

  const sentences = block.match(/[^.!?]+[.!?]+/g) ?? [block];
  const chunks: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    const next = `${current} ${sentence}`.trim();
    if (current !== "" && next.length > MAX_CLAUSE_CHARS) {
      chunks.push(current.trim());
      current = sentence.trim();
    } else {
      current = next;
    }
  }
  if (current !== "") {
    chunks.push(current.trim());
  }

  return chunks;
}

/**
 * Turn extracted document text into clause-sized, citable blocks. Blank lines are
 * the primary delimiter; oversized blocks fall back to sentence packing.
 */
export function textToClauses(
  text: string,
  options: { pageNumber?: number; startIndex?: number; max?: number } = {},
): SourceClause[] {
  const pageNumber = options.pageNumber ?? 1;
  const startIndex = options.startIndex ?? 0;
  const max = Math.max(1, options.max ?? 40);

  const normalized = text.replace(/\r\n?/g, "\n").trim();
  if (normalized === "") {
    return [];
  }

  const blocks = normalized
    .split(/\n\s*\n+/)
    .flatMap((block) => splitLongBlock(block.replace(/\s+$/g, "").trim()))
    .filter((block) => block.length >= MIN_CLAUSE_CHARS)
    .slice(0, max);

  return blocks.map((block, index) => {
    const globalIndex = startIndex + index + 1;
    const { label, heading } = labelFor(block, globalIndex);
    return {
      sectionLabel: `${label}, Page ${pageNumber}`,
      ...(heading ? { heading } : {}),
      pageNumber,
      text: block.replace(/\n+/g, " ").replace(/\s+/g, " ").trim(),
    };
  });
}

/** Combine per-page PDF text, keeping each clause's real page number. */
export function pdfPagesToClauses(
  pages: ReadonlyArray<{ pageNumber: number; text: string }>,
  max = 40,
): SourceClause[] {
  const result: SourceClause[] = [];
  for (const page of pages) {
    if (result.length >= max) {
      break;
    }
    const remaining = max - result.length;
    const clauses = textToClauses(page.text, {
      pageNumber: page.pageNumber,
      startIndex: result.length,
      max: remaining,
    });
    result.push(...clauses);
  }
  return result;
}
