"use client";

import { useState } from "react";
import { ChartBar, ChartDonut, ShieldCheck } from "@phosphor-icons/react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";

export interface DashboardChartsProps {
  findings: {
    total: number;
    pending: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    approved: number;
    rejected: number;
  };
  documents: ReadonlyArray<{
    id: string;
    regulator: string;
    reference: string;
    clauseCount: number;
    findingCount: number;
  }>;
  scans: {
    total: number;
    critical: number;
    high: number;
    unconsented: number;
  };
}

export function ComplianceCharts({ findings, documents, scans }: DashboardChartsProps) {
  const severityRows = [
    {
      key: "CRITICAL",
      label: "Critical",
      count: findings.critical,
      stroke: "stroke-danger",
      fill: "bg-danger",
    },
    {
      key: "HIGH",
      label: "High",
      count: findings.high,
      stroke: "stroke-brand",
      fill: "bg-brand",
    },
    {
      key: "MEDIUM",
      label: "Medium",
      count: findings.medium,
      stroke: "stroke-support",
      fill: "bg-support",
    },
    {
      key: "LOW",
      label: "Low",
      count: findings.low,
      stroke: "stroke-muted",
      fill: "bg-muted",
    },
  ] as const;

  const [activeKey, setActiveKey] = useState<string>("CRITICAL");
  const total = Math.max(findings.total, 0);
  const reviewed = findings.approved + findings.rejected;
  const reviewedPct = total > 0 ? Math.round((reviewed / total) * 100) : 0;
  const activeRow = severityRows.find((r) => r.key === activeKey) ?? severityRows[0];

  const radius = 44;
  const circumference = 2 * Math.PI * radius;

  const segments =
    total > 0
      ? severityRows.reduce<
          Array<(typeof severityRows)[number] & { length: number; offset: number }>
        >((acc, row) => {
          const prev = acc.reduce((sum, s) => sum + s.length, 0);
          const length = (row.count / total) * circumference;
          acc.push({ ...row, length, offset: -prev });
          return acc;
        }, [])
      : [];

  const maxDocUnits = Math.max(
    ...documents.map((doc) => Math.max(doc.clauseCount, doc.findingCount)),
    1,
  );

  const consentedCount = Math.max(scans.total - scans.unconsented, 0);
  const consentPct = scans.total > 0 ? Math.round((consentedCount / scans.total) * 100) : 0;

  return (
    <section aria-label="Workspace analytics" className="grid gap-4 lg:grid-cols-2">
      {/* Findings Posture & Severity Donut */}
      <Card className="p-5">
        <div className="flex items-center justify-between gap-2 border-b border-line pb-3.5">
          <div className="flex items-center gap-2">
            <ChartDonut
              size={17}
              weight="bold"
              aria-hidden="true"
              className="text-brand dark:text-accent"
            />
            <h2 className="text-sm font-semibold text-fg">
              Findings severity &amp; review posture
            </h2>
          </div>
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted tabular-nums">
            {reviewedPct}% reviewed
          </span>
        </div>

        {total === 0 ? (
          <div className="py-10 text-center text-xs text-muted">
            No findings recorded in this workspace yet. Ingest a circular to populate severity
            telemetry.
          </div>
        ) : (
          <div className="mt-4 grid items-center gap-6 sm:grid-cols-[152px_1fr]">
            <div className="relative mx-auto flex size-32 items-center justify-center pp-chart-enter">
              <svg viewBox="0 0 112 112" className="size-full -rotate-90" aria-hidden="true">
                <circle
                  cx="56"
                  cy="56"
                  r={radius}
                  fill="none"
                  className="stroke-surface-2"
                  strokeWidth="12"
                />
                {segments.map((seg) =>
                  seg.count > 0 ? (
                    <circle
                      key={seg.key}
                      cx="56"
                      cy="56"
                      r={radius}
                      fill="none"
                      strokeWidth={activeKey === seg.key ? 15 : 12}
                      strokeDasharray={`${Math.max(seg.length - 2.5, 2)} ${circumference}`}
                      strokeDashoffset={seg.offset}
                      className={cn(
                        "cursor-pointer transition-all duration-200",
                        seg.stroke,
                        activeKey !== seg.key && "opacity-80 hover:opacity-100",
                      )}
                      onMouseEnter={() => setActiveKey(seg.key)}
                    />
                  ) : null,
                )}
              </svg>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="font-mono text-xl font-semibold text-fg tabular-nums">
                  {activeRow.count}
                </span>
                <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted">
                  {activeRow.label}
                </span>
              </div>
            </div>

            <div className="space-y-2.5">
              {severityRows.map((row) => {
                const pct = total > 0 ? Math.round((row.count / total) * 100) : 0;
                return (
                  <button
                    key={row.key}
                    type="button"
                    onMouseEnter={() => setActiveKey(row.key)}
                    onClick={() => setActiveKey(row.key)}
                    className={cn(
                      "block w-full rounded-xl px-2.5 py-1.5 text-left transition-colors",
                      activeKey === row.key ? "bg-surface-2/80" : "hover:bg-surface-2/40",
                    )}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="inline-flex items-center gap-2 font-medium text-fg">
                        <span className={cn("size-2 rounded-full", row.fill)} aria-hidden="true" />
                        {row.label}
                      </span>
                      <span className="font-mono text-[11px] text-muted tabular-nums">
                        {row.count} ({pct}%)
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                      <div
                        className={cn("h-full rounded-full transition-all duration-300", row.fill)}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </Card>

      {/* Circular Extraction Density + DPDP Consent Gauge */}
      <Card className="flex flex-col justify-between p-5">
        <div className="flex items-center justify-between gap-2 border-b border-line pb-3.5">
          <div className="flex items-center gap-2">
            <ChartBar
              size={17}
              weight="bold"
              aria-hidden="true"
              className="text-brand dark:text-accent"
            />
            <h2 className="text-sm font-semibold text-fg">Circular density &amp; DPDP posture</h2>
          </div>
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
            {documents.length} circulars
          </span>
        </div>

        {documents.length === 0 && scans.total === 0 ? (
          <div className="py-10 text-center text-xs text-muted">
            No circulars or data field scans recorded in this workspace yet.
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {documents.slice(0, 4).map((doc) => {
              const clauseWidth = Math.round((doc.clauseCount / maxDocUnits) * 100);
              const findingWidth = Math.round((doc.findingCount / maxDocUnits) * 100);
              return (
                <div key={doc.id} className="space-y-1">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate font-mono text-[11px] text-fg">
                      {doc.regulator} · {doc.reference}
                    </span>
                    <span className="shrink-0 font-mono text-[10px] text-muted tabular-nums">
                      {doc.clauseCount}c / {doc.findingCount}f
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <div
                      className="h-1.5 overflow-hidden rounded-full bg-surface-2"
                      title={`${doc.clauseCount} clauses`}
                    >
                      <div
                        className="h-full rounded-full bg-brand dark:bg-support"
                        style={{ width: `${clauseWidth}%` }}
                      />
                    </div>
                    <div
                      className="h-1.5 overflow-hidden rounded-full bg-surface-2"
                      title={`${doc.findingCount} findings`}
                    >
                      <div
                        className="h-full rounded-full bg-brand/60 dark:bg-accent"
                        style={{ width: `${findingWidth}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}

            <div className="rounded-xl border border-line bg-surface-2/60 p-3.5">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="inline-flex items-center gap-1.5 font-medium text-fg">
                  <ShieldCheck
                    size={14}
                    weight="bold"
                    aria-hidden="true"
                    className="text-brand dark:text-accent"
                  />
                  DPDP consent basis coverage
                </span>
                <span className="font-mono text-[11px] text-fg tabular-nums">
                  {consentedCount}/{scans.total} fields ({consentPct}%)
                </span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface">
                <div
                  className="h-full rounded-full bg-brand transition-all duration-500 dark:bg-accent"
                  style={{ width: `${consentPct}%` }}
                />
              </div>
            </div>
          </div>
        )}
      </Card>
    </section>
  );
}
