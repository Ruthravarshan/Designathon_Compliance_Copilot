"use client";

import { useMemo, useState } from "react";
import { CaretDown, CaretUp, MagnifyingGlass } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SearchField } from "@/components/ui/field";
import { formatDateTime, humanize } from "@/lib/format";

export interface AuditExplorerItem {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  actorName: string | null;
  createdAt: string;
  metadataSummary: string;
  metadataPretty: string | null;
}

export function AuditExplorer({
  entries,
  actorRole,
}: {
  entries: readonly AuditExplorerItem[];
  actorRole: string;
}) {
  const [query, setQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return entries;
    }
    return entries.filter(
      (entry) =>
        entry.action.toLowerCase().includes(q) ||
        entry.entity.toLowerCase().includes(q) ||
        (entry.actorName?.toLowerCase().includes(q) ?? false) ||
        entry.metadataSummary.toLowerCase().includes(q),
    );
  }, [entries, query]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <SearchField
          id="audit-search"
          label="Search audit events"
          value={query}
          onChange={setQuery}
          placeholder="Search action, entity, actor, or metadata..."
          className="w-full sm:max-w-[380px]"
        />
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted tabular-nums">
          {filtered.length} of {entries.length} events
        </p>
      </div>

      {filtered.length === 0 ? (
        <Card className="px-6 py-12 text-center">
          <MagnifyingGlass
            size={26}
            weight="bold"
            aria-hidden="true"
            className="mx-auto text-brand dark:text-support"
          />
          <h2 className="mt-3 text-base font-semibold text-fg">
            No audit events match &ldquo;{query.trim()}&rdquo;.
          </h2>
          <div className="mt-5">
            <Button variant="secondary" size="sm" onClick={() => setQuery("")}>
              Clear search
            </Button>
          </div>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="hidden grid-cols-[11rem_1fr_9rem_1fr] gap-4 border-b border-line bg-surface-2 px-5 py-2.5 font-mono text-[9px] uppercase tracking-[0.16em] text-muted lg:grid">
            <span>When</span>
            <span>Action</span>
            <span>Actor</span>
            <span>Context</span>
          </div>
          <ul className="divide-y divide-line">
            {filtered.map((entry) => {
              const expanded = expandedId === entry.id;
              return (
                <li key={entry.id} className="px-5 py-3.5">
                  <div className="grid gap-2 lg:grid-cols-[11rem_1fr_9rem_1fr] lg:items-baseline lg:gap-4">
                    <span className="font-mono text-[10px] text-muted">
                      {formatDateTime(entry.createdAt)}
                    </span>
                    <div className="min-w-0">
                      <p className="font-mono text-[11px] text-fg">{entry.action}</p>
                      <p className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-muted">
                        {entry.entity}
                        {entry.entityId ? ` · ${entry.entityId.slice(0, 10)}…` : ""}
                      </p>
                    </div>
                    <span className="text-xs text-muted">{entry.actorName ?? "System"}</span>
                    <div className="flex min-w-0 items-center justify-between gap-2">
                      <span
                        className="min-w-0 truncate font-mono text-[10px] text-muted"
                        title={entry.metadataSummary}
                      >
                        {entry.metadataSummary}
                      </span>
                      {entry.metadataPretty ? (
                        <button
                          type="button"
                          aria-expanded={expanded}
                          onClick={() => setExpandedId(expanded ? null : entry.id)}
                          className="inline-flex shrink-0 items-center gap-1 rounded-full border border-line bg-surface px-2.5 py-1 font-mono text-[10px] text-muted transition-colors hover:border-muted/60 hover:text-fg"
                        >
                          {expanded ? "Hide" : "JSON"}
                          {expanded ? (
                            <CaretUp size={10} weight="bold" aria-hidden="true" />
                          ) : (
                            <CaretDown size={10} weight="bold" aria-hidden="true" />
                          )}
                        </button>
                      ) : null}
                    </div>
                  </div>
                  {expanded && entry.metadataPretty ? (
                    <pre className="mt-3 overflow-x-auto rounded-xl border border-line bg-surface-2/70 p-3 font-mono text-[11px] leading-relaxed text-fg">
                      {entry.metadataPretty}
                    </pre>
                  ) : null}
                </li>
              );
            })}
          </ul>
          <div className="border-t border-line px-5 py-3">
            <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted">
              Showing {filtered.length} events · {humanize(actorRole)} view
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
