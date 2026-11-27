import { diffWords, type DiffToken } from "../compliance/redline";

export interface RevisionSummary {
  summary: string;
  added: number;
  removed: number;
  diff: DiffToken[];
}

const MAX_DIFF_TOKENS = 240;

function wordCount(value: string): number {
  const trimmed = value.trim();
  return trimmed === "" ? 0 : trimmed.split(/\s+/).length;
}

/** Describe how a republished document differs from the stored copy. */
export function summarizeRevision(before: string, after: string): RevisionSummary {
  const tokens = diffWords(before, after);
  let added = 0;
  let removed = 0;
  let passages = 0;

  for (const token of tokens) {
    if (token.type === "added") {
      added += wordCount(token.value);
      passages += 1;
    } else if (token.type === "removed") {
      removed += wordCount(token.value);
      passages += 1;
    }
  }

  const summary =
    added === 0 && removed === 0
      ? "No textual changes detected."
      : `${added} word${added === 1 ? "" : "s"} added and ${removed} removed across ${passages} changed passage${
          passages === 1 ? "" : "s"
        }.`;

  return { summary, added, removed, diff: tokens.slice(0, MAX_DIFF_TOKENS) };
}
