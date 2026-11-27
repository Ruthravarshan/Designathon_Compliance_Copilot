"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, MagnifyingGlass } from "@phosphor-icons/react";
import { SeverityBadge } from "@/components/severity-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SearchField } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import type { RegulatorKey } from "@/lib/compliance/types";
import { formatDate } from "@/lib/format";

export interface CircularExplorerItem {
  id: string;
  title: string;
  reference: string;
  regulator: RegulatorKey;
  summary: string;
  publishedAt: string;
  status: string;
  clauseCount: number;
  findingCount: number;
  criticalCount: number;
}

const REGULATORS: ReadonlyArray<RegulatorKey> = ["RBI", "SEBI", "IRDAI", "MEITY"];

export function CircularsExplorer({ items }: { items: readonly CircularExplorerItem[] }) {
  const [query, setQuery] = useState("");
  const [regulator, setRegulator] = useState<RegulatorKey | "ALL">("ALL");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((doc) => {
      if (regulator !== "ALL" && doc.regulator !== regulator) {
        return false;
      }
      if (!q) {
        return true;
      }
      return (
        doc.title.toLowerCase().includes(q) ||
        doc.reference.toLowerCase().includes(q) ||
        doc.regulator.toLowerCase().includes(q) ||
        doc.summary.toLowerCase().includes(q)
      );
    });
  }, [items, query, regulator]);

  const hasFilters = query.trim().length > 0 || regulator !== "ALL";

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <SearchField
            id="circulars-search"
            label="Search circulars"
            value={query}
            onChange={setQuery}
            placeholder="Search by title, reference, or regulator..."
            className="w-full lg:max-w-[360px]"
          />

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 font-mono text-[9px] uppercase tracking-[0.16em] text-muted">
              Regulator
            </span>
            <button
              type="button"
              aria-pressed={regulator === "ALL"}
              onClick={() => setRegulator("ALL")}
              className={cn(
                "min-h-9 rounded-full px-3 py-1.5 text-xs transition-colors sm:min-h-8",
                regulator === "ALL"
                  ? "bg-brand font-medium text-brand-ink"
                  : "border border-line bg-surface text-muted hover:border-muted/50 hover:text-fg",
              )}
            >
              All ({items.length})
            </button>
            {REGULATORS.map((key) => {
              const count = items.filter((item) => item.regulator === key).length;
              if (count === 0) {
                return null;
              }
              const active = regulator === key;
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setRegulator(key)}
                  className={cn(
                    "min-h-9 rounded-full px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.1em] transition-colors sm:min-h-8",
                    active
                      ? "bg-brand font-medium text-brand-ink"
                      : "border border-line bg-surface text-muted hover:border-muted/50 hover:text-fg",
                  )}
                >
                  {key} ({count})
                </button>
              );
            })}
          </div>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <Card className="px-6 py-12 text-center">
          <MagnifyingGlass
            size={26}
            weight="bold"
            aria-hidden="true"
            className="mx-auto text-brand dark:text-support"
          />
          <h2 className="mt-3 text-base font-semibold text-fg">No circulars match your filter.</h2>
          <p className="mx-auto mt-1.5 max-w-[46ch] text-xs leading-relaxed text-muted">
            Clear the search query or regulator filter to see all {items.length} ingested circulars.
          </p>
          {hasFilters ? (
            <div className="mt-5">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setQuery("");
                  setRegulator("ALL");
                }}
              >
                Reset filters
              </Button>
            </div>
          ) : null}
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="hidden grid-cols-[6rem_1fr_9rem_8rem_2rem] gap-4 border-b border-line bg-surface-2 px-5 py-2.5 font-mono text-[9px] uppercase tracking-[0.16em] text-muted lg:grid">
            <span>Regulator</span>
            <span>Circular</span>
            <span>Coverage</span>
            <span>Published</span>
            <span />
          </div>
          <ul className="divide-y divide-line">
            {filtered.map((document) => (
              <li key={document.id}>
                <Link
                  href={`/app/circulars/${document.id}`}
                  className="group grid gap-3 px-5 py-4 transition-colors hover:bg-surface-2/60 lg:grid-cols-[6rem_1fr_9rem_8rem_2rem] lg:items-center lg:gap-4"
                >
                  <div className="flex items-center justify-between gap-2 lg:block">
                    <span className="inline-block w-fit rounded-full border border-brand/25 bg-brand/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-brand dark:border-support/35 dark:bg-support/15 dark:text-support">
                      {document.regulator}
                    </span>
                    {document.criticalCount > 0 ? (
                      <SeverityBadge severity="CRITICAL" className="lg:hidden" />
                    ) : null}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-fg">{document.title}</p>
                    <p className="mt-1 truncate font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
                      {document.reference} · {document.status.toLowerCase()}
                    </p>
                    <p className="mt-1 text-xs text-muted lg:hidden">
                      Published {formatDate(document.publishedAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted tabular-nums">
                    <span>{document.clauseCount} clauses</span>
                    <span aria-hidden="true">·</span>
                    <span>{document.findingCount} findings</span>
                  </div>
                  <div className="hidden lg:block">
                    <p className="text-xs text-fg">{formatDate(document.publishedAt)}</p>
                    {document.criticalCount > 0 ? (
                      <SeverityBadge severity="CRITICAL" className="mt-1.5" />
                    ) : (
                      <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted">
                        no critical gaps
                      </span>
                    )}
                  </div>
                  <ArrowRight
                    size={15}
                    weight="bold"
                    aria-hidden="true"
                    className="hidden text-muted transition-colors group-hover:text-brand dark:group-hover:text-support lg:block"
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
