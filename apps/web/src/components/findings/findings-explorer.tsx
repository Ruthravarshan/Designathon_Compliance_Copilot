"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, MagnifyingGlass } from "@phosphor-icons/react";
import { ReviewStatusBadge, SeverityBadge } from "@/components/severity-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SearchField } from "@/components/ui/field";
import type { Severity } from "@/lib/compliance/types";
import { formatDate, formatPercent } from "@/lib/format";

export interface FindingExplorerItem {
  id: string;
  severity: Severity;
  reviewStatus: string;
  plainLanguage: string;
  reference: string;
  documentReference: string;
  confidence: number;
  policyCode: string | null;
  controlCode: string | null;
  dueDate: string;
}

export function FindingsExplorer({ items }: { items: readonly FindingExplorerItem[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return items;
    }
    return items.filter(
      (item) =>
        item.plainLanguage.toLowerCase().includes(q) ||
        item.reference.toLowerCase().includes(q) ||
        item.documentReference.toLowerCase().includes(q) ||
        (item.policyCode?.toLowerCase().includes(q) ?? false) ||
        (item.controlCode?.toLowerCase().includes(q) ?? false),
    );
  }, [items, query]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <SearchField
          id="findings-search"
          label="Search loaded findings"
          value={query}
          onChange={setQuery}
          placeholder="Search obligations, circular ref, or policy code..."
          className="w-full sm:max-w-[380px]"
        />
        {query.trim() ? (
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted tabular-nums">
            {filtered.length} of {items.length} matching on page
          </p>
        ) : null}
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
            No loaded findings match &ldquo;{query.trim()}&rdquo;.
          </h2>
          <p className="mx-auto mt-1.5 max-w-[46ch] text-xs leading-relaxed text-muted">
            Clear your search to return to all findings on this page.
          </p>
          <div className="mt-5">
            <Button variant="secondary" size="sm" onClick={() => setQuery("")}>
              Clear search
            </Button>
          </div>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="hidden grid-cols-[7rem_1fr_8rem_7.5rem_8rem_2rem] gap-4 border-b border-line bg-surface-2 px-5 py-2.5 font-mono text-[9px] uppercase tracking-[0.16em] text-muted xl:grid">
            <span>Severity</span>
            <span>Finding</span>
            <span>Mapped to</span>
            <span>Deadline</span>
            <span>Review</span>
            <span />
          </div>
          <ul className="divide-y divide-line">
            {filtered.map((finding) => (
              <li key={finding.id}>
                <Link
                  href={`/app/findings/${finding.id}`}
                  className="group grid gap-3 px-5 py-4 transition-colors hover:bg-surface-2/60 xl:grid-cols-[7rem_1fr_8rem_7.5rem_8rem_2rem] xl:items-center xl:gap-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 xl:block">
                    <SeverityBadge severity={finding.severity} />
                    <div className="xl:hidden">
                      <ReviewStatusBadge status={finding.reviewStatus} />
                    </div>
                  </div>
                  <div className="min-w-0">
                    <p className="line-clamp-2 text-sm font-medium text-fg">
                      {finding.plainLanguage}
                    </p>
                    <p className="mt-1 truncate font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
                      {finding.reference} · {finding.documentReference}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      Overall confidence {formatPercent(finding.confidence)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10px] leading-relaxed text-muted xl:block">
                    <span className="xl:hidden">Mapped:</span>
                    {finding.policyCode ? <p>{finding.policyCode}</p> : <p>No policy match</p>}
                    {finding.controlCode ? <p>{finding.controlCode}</p> : null}
                  </div>
                  <p className="text-xs text-muted">
                    <span className="mr-1.5 font-mono text-[10px] uppercase tracking-[0.1em] xl:hidden">
                      Due
                    </span>
                    {formatDate(finding.dueDate)}
                  </p>
                  <div className="hidden xl:block">
                    <ReviewStatusBadge status={finding.reviewStatus} />
                  </div>
                  <ArrowRight
                    size={15}
                    weight="bold"
                    aria-hidden="true"
                    className="hidden text-muted transition-colors group-hover:text-brand dark:group-hover:text-support xl:block"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
