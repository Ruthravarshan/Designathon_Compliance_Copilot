"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle, MagnifyingGlass } from "@phosphor-icons/react";
import { GapStatusLabel, ReviewStatusBadge, SeverityBadge } from "@/components/severity-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SearchField } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import type { Severity } from "@/lib/compliance/types";
import { formatPercent, humanize } from "@/lib/format";

export interface CircularClauseExplorerItem {
  id: string;
  sectionLabel: string;
  heading: string | null;
  pageNumber: number;
  text: string;
  obligations: Array<{
    id: string;
    obligationType: string;
    citationVerified: boolean;
    plainLanguage: string;
    reference: string;
    sla: string | null;
    extractionConfidence: number;
    finding: {
      id: string;
      severity: Severity;
      reviewStatus: string;
      status: string;
      confidence: number;
    } | null;
  }>;
}

export function CircularClausesExplorer({
  clauses,
}: {
  clauses: readonly CircularClauseExplorerItem[];
}) {
  const [query, setQuery] = useState("");
  const [onlyWithFindings, setOnlyWithFindings] = useState(false);

  const findingClauseCount = useMemo(
    () => clauses.filter((clause) => clause.obligations.some((ob) => ob.finding !== null)).length,
    [clauses],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return clauses.filter((clause) => {
      if (onlyWithFindings && !clause.obligations.some((ob) => ob.finding !== null)) {
        return false;
      }
      if (!q) {
        return true;
      }
      return (
        clause.sectionLabel.toLowerCase().includes(q) ||
        (clause.heading?.toLowerCase().includes(q) ?? false) ||
        clause.text.toLowerCase().includes(q) ||
        clause.obligations.some(
          (ob) =>
            ob.plainLanguage.toLowerCase().includes(q) || ob.reference.toLowerCase().includes(q),
        )
      );
    });
  }, [clauses, query, onlyWithFindings]);

  return (
    <section aria-label="Clauses" className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchField
          id="clauses-search"
          label="Search circular clauses"
          value={query}
          onChange={setQuery}
          placeholder="Filter clauses by section, text, or obligation..."
          className="w-full sm:max-w-[360px]"
        />

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            aria-pressed={!onlyWithFindings}
            onClick={() => setOnlyWithFindings(false)}
            className={cn(
              "min-h-9 rounded-full px-3 py-1.5 text-xs transition-colors sm:min-h-8",
              !onlyWithFindings
                ? "bg-brand font-medium text-brand-ink"
                : "border border-line bg-surface text-muted hover:border-muted/50 hover:text-fg",
            )}
          >
            All clauses ({clauses.length})
          </button>
          <button
            type="button"
            aria-pressed={onlyWithFindings}
            onClick={() => setOnlyWithFindings(true)}
            className={cn(
              "min-h-9 rounded-full px-3 py-1.5 text-xs transition-colors sm:min-h-8",
              onlyWithFindings
                ? "bg-brand font-medium text-brand-ink"
                : "border border-line bg-surface text-muted hover:border-muted/50 hover:text-fg",
            )}
          >
            With findings ({findingClauseCount})
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card className="px-6 py-12 text-center">
          <MagnifyingGlass
            size={24}
            weight="bold"
            aria-hidden="true"
            className="mx-auto text-brand dark:text-support"
          />
          <p className="mt-3 text-sm font-medium text-fg">No clauses match your filter.</p>
          <div className="mt-4">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setQuery("");
                setOnlyWithFindings(false);
              }}
            >
              Reset filters
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((clause) => (
            <Card key={clause.id} className="overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-surface-2/60 px-5 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-brand dark:text-support">
                    {clause.sectionLabel}
                  </span>
                  {clause.heading ? (
                    <span className="text-xs text-muted">· {clause.heading}</span>
                  ) : null}
                </div>
                <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted">
                  Page {clause.pageNumber}
                </span>
              </div>

              <div className="p-5">
                <blockquote className="border-l-2 border-brand/40 pl-4 text-sm leading-relaxed text-fg dark:border-support/50">
                  {clause.text}
                </blockquote>

                {clause.obligations.length === 0 ? (
                  <p className="mt-4 rounded-xl border border-dashed border-line px-4 py-3 text-xs text-muted">
                    No atomic obligation was extracted from this clause. The clause remains citable
                    in policy Q&amp;A.
                  </p>
                ) : (
                  <ul className="mt-4 space-y-2">
                    {clause.obligations.map((obligation) => {
                      const finding = obligation.finding;
                      return (
                        <li
                          key={obligation.id}
                          className="rounded-xl border border-line bg-surface px-4 py-3.5"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted">
                                {humanize(obligation.obligationType)}
                              </span>
                              {finding ? <SeverityBadge severity={finding.severity} /> : null}
                              {finding ? <ReviewStatusBadge status={finding.reviewStatus} /> : null}
                            </div>
                            <span className="inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.12em] text-muted">
                              <CheckCircle
                                size={11}
                                weight="bold"
                                aria-hidden="true"
                                className={
                                  obligation.citationVerified
                                    ? "text-brand dark:text-support"
                                    : "text-danger"
                                }
                              />
                              {obligation.citationVerified
                                ? "Citation verified"
                                : "Citation flagged"}
                            </span>
                          </div>
                          <p className="mt-2 text-sm leading-relaxed text-fg">
                            {obligation.plainLanguage}
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
                            <span className="font-mono">{obligation.reference}</span>
                            {obligation.sla ? <span>SLA · {obligation.sla}</span> : null}
                            <span>Extraction {formatPercent(obligation.extractionConfidence)}</span>
                            {finding ? (
                              <span className="inline-flex items-center gap-2">
                                <GapStatusLabel status={finding.status} />
                                <span>Overall {formatPercent(finding.confidence)}</span>
                              </span>
                            ) : null}
                          </div>
                          {finding ? (
                            <div className="mt-3 border-t border-line pt-3">
                              <Link
                                href={`/app/findings/${finding.id}`}
                                className="inline-flex items-center gap-1.5 text-xs font-medium text-brand hover:underline dark:text-support"
                              >
                                Open finding and redline
                                <ArrowRight size={12} weight="bold" aria-hidden="true" />
                              </Link>
                            </div>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
