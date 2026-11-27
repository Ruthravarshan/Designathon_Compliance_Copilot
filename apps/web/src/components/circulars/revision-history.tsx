import { ArrowsClockwise } from "@phosphor-icons/react/dist/ssr";
import { Card, CardHeader } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";

interface DiffToken {
  type: "added" | "removed" | "unchanged";
  value: string;
}

export interface RevisionRow {
  id: string;
  summary: string;
  detectedAt: Date;
  diff: unknown;
}

function toTokens(value: unknown): DiffToken[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter(
      (token): token is DiffToken =>
        typeof token === "object" &&
        token !== null &&
        typeof (token as { value?: unknown }).value === "string" &&
        ["added", "removed", "unchanged"].includes((token as { type?: string }).type ?? ""),
    )
    .slice(0, 240);
}

export function RevisionHistory({ revisions }: { revisions: RevisionRow[] }) {
  if (revisions.length === 0) {
    return null;
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <div>
          <h2 className="text-sm font-medium text-fg">Revision history</h2>
          <p className="mt-1 text-xs text-muted">
            The watchdog detected these republished versions by checksum. Clauses and findings keep
            the text that was reviewed; the diff below is the evidence of change.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-brand">
          <ArrowsClockwise size={13} weight="bold" aria-hidden="true" />
          {revisions.length} detected
        </span>
      </CardHeader>
      <ul className="divide-y divide-line">
        {revisions.map((revision) => (
          <li key={revision.id} className="px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-medium text-fg">{revision.summary}</p>
              <span className="font-mono text-[10px] text-muted">
                {formatDateTime(revision.detectedAt)}
              </span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              {toTokens(revision.diff).map((token, index) =>
                token.type === "added" ? (
                  <mark key={index} className="rounded-sm bg-brand/15 px-0.5 text-brand">
                    {token.value}
                  </mark>
                ) : token.type === "removed" ? (
                  <del key={index} className="rounded-sm bg-danger/10 px-0.5 text-muted">
                    {token.value}
                  </del>
                ) : (
                  <span key={index}>{token.value}</span>
                ),
              )}
            </p>
          </li>
        ))}
      </ul>
    </Card>
  );
}
