"use client";

import { useMemo, useState } from "react";
import { MagnifyingGlass, ShieldCheck } from "@phosphor-icons/react";
import { SeverityBadge } from "@/components/severity-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SearchField } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import type { Severity } from "@/lib/compliance/types";
import { humanize } from "@/lib/format";

export interface DataCatalogItem {
  id: string;
  datasetName: string;
  fieldName: string;
  dataCategory: string;
  sensitiveType: string | null;
  sampleMasked: string | null;
  encrypted: boolean;
  consented: boolean;
  riskLevel: Severity;
  finding: string;
  citation: string;
}

type FilterKey = "ALL" | "HIGH_RISK" | "UNENCRYPTED" | "UNCONSENTED";

const FILTERS: ReadonlyArray<{ key: FilterKey; label: string }> = [
  { key: "ALL", label: "All fields" },
  { key: "HIGH_RISK", label: "Critical & High" },
  { key: "UNENCRYPTED", label: "Unencrypted" },
  { key: "UNCONSENTED", label: "No consent" },
];

export function DataCatalogExplorer({ items }: { items: readonly DataCatalogItem[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterKey>("ALL");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (filter === "HIGH_RISK" && item.riskLevel !== "CRITICAL" && item.riskLevel !== "HIGH") {
        return false;
      }
      if (filter === "UNENCRYPTED" && item.encrypted) {
        return false;
      }
      if (filter === "UNCONSENTED" && item.consented) {
        return false;
      }
      if (!q) {
        return true;
      }
      return (
        `${item.datasetName}.${item.fieldName}`.toLowerCase().includes(q) ||
        item.dataCategory.toLowerCase().includes(q) ||
        item.finding.toLowerCase().includes(q) ||
        item.citation.toLowerCase().includes(q)
      );
    });
  }, [items, query, filter]);

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <SearchField
            id="data-catalog-search"
            label="Search catalog fields"
            value={query}
            onChange={setQuery}
            placeholder="Search dataset.field, category, or finding..."
            className="w-full lg:max-w-[360px]"
          />

          <div className="flex flex-wrap items-center gap-1.5">
            {FILTERS.map((entry) => {
              const active = filter === entry.key;
              return (
                <button
                  key={entry.key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setFilter(entry.key)}
                  className={cn(
                    "min-h-9 rounded-full px-3 py-1.5 text-xs transition-colors sm:min-h-8",
                    active
                      ? "bg-brand font-medium text-brand-ink"
                      : "border border-line bg-surface text-muted hover:border-muted/50 hover:text-fg",
                  )}
                >
                  {entry.label}
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
          <h2 className="mt-3 text-base font-semibold text-fg">
            No catalog fields match this filter.
          </h2>
          <p className="mx-auto mt-1.5 max-w-[46ch] text-xs leading-relaxed text-muted">
            Clear your search or safeguard filter to inspect all {items.length} scanned fields.
          </p>
          <div className="mt-5">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setQuery("");
                setFilter("ALL");
              }}
            >
              Reset filters
            </Button>
          </div>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="hidden grid-cols-[6.5rem_1.2fr_7rem_8.5rem_1fr] gap-4 border-b border-line bg-surface-2 px-5 py-2.5 font-mono text-[9px] uppercase tracking-[0.16em] text-muted lg:grid">
            <span>Risk</span>
            <span>Field</span>
            <span>Category</span>
            <span>Safeguards</span>
            <span>Finding</span>
          </div>
          <ul className="divide-y divide-line">
            {filtered.map((item) => (
              <li
                key={item.id}
                className="grid gap-3 px-5 py-4 lg:grid-cols-[6.5rem_1.2fr_7rem_8.5rem_1fr] lg:items-start lg:gap-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 lg:block">
                  <SeverityBadge severity={item.riskLevel} />
                  <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted lg:hidden">
                    {humanize(item.dataCategory)}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="truncate font-mono text-xs text-fg">
                    {item.datasetName}.{item.fieldName}
                  </p>
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
                    {item.sampleMasked ?? "no sample"}
                    {item.sensitiveType ? ` · ${item.sensitiveType}` : ""}
                  </p>
                </div>
                <p className="hidden text-xs text-muted lg:block">{humanize(item.dataCategory)}</p>
                <div className="flex flex-wrap gap-1.5">
                  <span
                    className={
                      item.encrypted
                        ? "rounded-full border border-line bg-surface px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-muted"
                        : "rounded-full border border-danger/35 bg-danger/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-fg"
                    }
                  >
                    {item.encrypted ? "Encrypted" : "Not encrypted"}
                  </span>
                  <span
                    className={
                      item.consented
                        ? "rounded-full border border-line bg-surface px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-muted"
                        : "rounded-full border border-danger/35 bg-danger/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-fg"
                    }
                  >
                    {item.consented ? "Consent" : "No consent"}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="text-xs leading-relaxed text-muted">{item.finding}</p>
                  <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.1em] text-muted">
                    {item.citation}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          <div className="flex flex-col gap-2 border-t border-line px-5 py-3 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck
                size={13}
                weight="bold"
                aria-hidden="true"
                className="text-brand dark:text-support"
              />
              Samples are masked before they reach the API. Showing {filtered.length} of{" "}
              {items.length} fields.
            </span>
            <span className="font-mono text-[9px] uppercase tracking-[0.12em]">
              Citations · DPDP Act 2023
            </span>
          </div>
        </Card>
      )}
    </div>
  );
}
