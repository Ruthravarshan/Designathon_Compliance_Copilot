"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, MagnifyingGlass } from "@phosphor-icons/react";
import { PolicyCheckButton } from "@/components/policy/policy-check-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SearchField } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format";

export interface PolicyExplorerItem {
  id: string;
  code: string;
  title: string;
  version: string;
  section: string;
  ownerName: string;
  assessment: {
    result: string;
    score: number;
    open: number;
    summary: string;
  };
  lastCheck: {
    score: number;
    createdAt: string;
  } | null;
}

type StatusFilter = "ALL" | "GAPS" | "AT_RISK" | "COMPLIANT";

const STATUS_FILTERS: ReadonlyArray<{ key: StatusFilter; label: string }> = [
  { key: "ALL", label: "All" },
  { key: "GAPS", label: "Gaps" },
  { key: "AT_RISK", label: "At risk" },
  { key: "COMPLIANT", label: "Compliant" },
];

function outcomeTone(result: string): "brand" | "danger" | "outline" {
  if (result === "GAPS") {
    return "danger";
  }
  if (result === "AT_RISK") {
    return "brand";
  }
  return "outline";
}

export function PoliciesExplorer({
  policies,
  canCheck,
}: {
  policies: readonly PolicyExplorerItem[];
  canCheck: boolean;
}) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return policies.filter((policy) => {
      if (statusFilter !== "ALL" && policy.assessment.result !== statusFilter) {
        return false;
      }
      if (!q) {
        return true;
      }
      return (
        policy.code.toLowerCase().includes(q) ||
        policy.title.toLowerCase().includes(q) ||
        policy.ownerName.toLowerCase().includes(q) ||
        policy.section.toLowerCase().includes(q)
      );
    });
  }, [policies, query, statusFilter]);

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <SearchField
            id="policies-search"
            label="Search internal policies"
            value={query}
            onChange={setQuery}
            placeholder="Search by policy code, title, section, or owner..."
            className="w-full lg:max-w-[360px]"
          />

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 font-mono text-[9px] uppercase tracking-[0.16em] text-muted">
              Posture
            </span>
            {STATUS_FILTERS.map((item) => {
              const count =
                item.key === "ALL"
                  ? policies.length
                  : policies.filter((p) => p.assessment.result === item.key).length;
              const active = statusFilter === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setStatusFilter(item.key)}
                  className={cn(
                    "min-h-9 rounded-full px-3 py-1.5 text-xs transition-colors sm:min-h-8",
                    active
                      ? "bg-brand font-medium text-brand-ink"
                      : "border border-line bg-surface text-muted hover:border-muted/50 hover:text-fg",
                  )}
                >
                  {item.label} ({count})
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
          <h2 className="mt-3 text-base font-semibold text-fg">No policies match this filter.</h2>
          <p className="mx-auto mt-1.5 max-w-[46ch] text-xs leading-relaxed text-muted">
            Reset search or posture filters to view all {policies.length} internal policies.
          </p>
          <div className="mt-5">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setQuery("");
                setStatusFilter("ALL");
              }}
            >
              Reset filters
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filtered.map((policy) => (
            <Card key={policy.id} className="p-5 transition-colors hover:border-brand/40">
              <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-brand dark:text-support">
                      {policy.code}
                    </span>
                    <Badge tone={outcomeTone(policy.assessment.result)}>
                      {policy.assessment.result.replace(/_/g, " ")}
                    </Badge>
                    <Badge tone="outline">{policy.version}</Badge>
                    <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted tabular-nums">
                      Score {policy.assessment.score}/100
                    </span>
                  </div>

                  <Link
                    href={`/app/policies/${policy.id}`}
                    className="group inline-flex items-center gap-2 text-base font-semibold text-fg hover:text-brand dark:hover:text-support"
                  >
                    <span>{policy.title}</span>
                    <ArrowRight
                      size={14}
                      weight="bold"
                      aria-hidden="true"
                      className="shrink-0 text-muted transition-transform group-hover:translate-x-0.5"
                    />
                  </Link>

                  <p className="text-xs leading-relaxed text-muted">{policy.assessment.summary}</p>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-xs text-muted">
                    <span>Section: {policy.section}</span>
                    <span>Owner: {policy.ownerName}</span>
                    <span>Open findings: {policy.assessment.open}</span>
                    {policy.lastCheck ? (
                      <span>
                        Last checked: {formatDate(policy.lastCheck.createdAt)} (
                        {policy.lastCheck.score}/100)
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-3">
                  {canCheck ? <PolicyCheckButton policyId={policy.id} compact /> : null}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
