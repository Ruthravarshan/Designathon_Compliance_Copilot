"use client";

import { useState } from "react";
import { ChartBar, ChartDonut, ClockCountdown } from "@phosphor-icons/react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";

const SEVERITY_DATA = [
  {
    key: "CRITICAL",
    label: "Critical",
    count: 4,
    sla: "6h – 7d window",
    strokeClass: "stroke-danger",
    barClass: "bg-danger",
  },
  {
    key: "HIGH",
    label: "High",
    count: 5,
    sla: "14d remediation",
    strokeClass: "stroke-brand",
    barClass: "bg-brand",
  },
  {
    key: "MEDIUM",
    label: "Medium",
    count: 3,
    sla: "30d cycle",
    strokeClass: "stroke-support",
    barClass: "bg-support",
  },
  {
    key: "LOW",
    label: "Low / Verified",
    count: 1,
    sla: "On record",
    strokeClass: "stroke-muted",
    barClass: "bg-muted",
  },
] as const;

const REGULATOR_COVERAGE = [
  { name: "IRDAI", clauses: 2, findings: 2, mapped: "POL-SEC-02" },
  { name: "RBI", clauses: 3, findings: 3, mapped: "POL-CLOUD-05" },
  { name: "SEBI", clauses: 2, findings: 2, mapped: "POL-LOG-04" },
  { name: "MeitY / DPDP", clauses: 6, findings: 6, mapped: "POL-PRIV-01" },
] as const;

const SLA_COMPRESSIONS = [
  {
    regulator: "IRDAI · Cyber",
    policy: "POL-SEC-02",
    before: "72 hours",
    after: "6 hours",
    reductionPct: 92,
  },
  {
    regulator: "DPDP · Erasure",
    policy: "POL-PRIV-01",
    before: "14d + 18m tail",
    after: "Immediate ease",
    reductionPct: 86,
  },
  {
    regulator: "RBI · Residency",
    policy: "POL-CLOUD-05",
    before: "ap-southeast-1",
    after: "India-only",
    reductionPct: 100,
  },
] as const;

export function ComplianceGraphs() {
  const [hoveredSeverity, setHoveredSeverity] = useState<string>("CRITICAL");
  const totalFindings = SEVERITY_DATA.reduce((sum, item) => sum + item.count, 0);
  const activeItem = SEVERITY_DATA.find((item) => item.key === hoveredSeverity) ?? SEVERITY_DATA[0];

  const radius = 52;
  const circumference = 2 * Math.PI * radius;

  const segments = SEVERITY_DATA.reduce<
    Array<(typeof SEVERITY_DATA)[number] & { length: number; offset: number }>
  >((acc, item) => {
    const prevLength = acc.reduce((sum, seg) => sum + seg.length, 0);
    const length = (item.count / totalFindings) * circumference;
    acc.push({ ...item, length, offset: -prevLength });
    return acc;
  }, []);

  return (
    <section
      id="telemetry"
      className="scroll-mt-20 mx-auto w-full max-w-[1200px] px-5 py-16 sm:px-8"
    >
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-brand dark:text-accent">
            Corpus Telemetry
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.025em] text-fg sm:text-3xl">
            Live regulatory posture across the seeded workspace.
          </h2>
        </div>
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
          13 extracted findings · 4 regulators · deterministic scoring
        </p>
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        {/* Card 1: Animated SVG Severity Donut */}
        <Card className="flex flex-col justify-between p-6">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ChartDonut
                size={18}
                weight="bold"
                aria-hidden="true"
                className="text-brand dark:text-accent"
              />
              <h3 className="text-sm font-semibold text-fg">Exposure by severity</h3>
            </div>
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
              {totalFindings} total
            </span>
          </div>

          <div className="my-5 flex items-center justify-center">
            <div className="relative flex size-36 items-center justify-center pp-chart-enter">
              <svg viewBox="0 0 132 132" className="size-full -rotate-90" aria-hidden="true">
                <circle
                  cx="66"
                  cy="66"
                  r={radius}
                  fill="none"
                  className="stroke-surface-2"
                  strokeWidth="14"
                />
                {segments.map((seg) => (
                  <circle
                    key={seg.key}
                    cx="66"
                    cy="66"
                    r={radius}
                    fill="none"
                    strokeWidth={hoveredSeverity === seg.key ? 17 : 14}
                    strokeDasharray={`${Math.max(seg.length - 3, 2)} ${circumference}`}
                    strokeDashoffset={seg.offset}
                    strokeLinecap="butt"
                    className={cn(
                      "cursor-pointer transition-all duration-200",
                      seg.strokeClass,
                      hoveredSeverity !== seg.key && "opacity-75 hover:opacity-100",
                    )}
                    onMouseEnter={() => setHoveredSeverity(seg.key)}
                  />
                ))}
              </svg>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="font-mono text-2xl font-semibold text-fg tabular-nums">
                  {activeItem.count}
                </span>
                <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted">
                  {activeItem.label}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-2 border-t border-line pt-4">
            {SEVERITY_DATA.map((item) => (
              <button
                key={item.key}
                type="button"
                onMouseEnter={() => setHoveredSeverity(item.key)}
                onFocus={() => setHoveredSeverity(item.key)}
                onClick={() => setHoveredSeverity(item.key)}
                className={cn(
                  "flex w-full items-center justify-between rounded-lg px-2 py-1 text-xs transition-colors",
                  hoveredSeverity === item.key
                    ? "bg-surface-2 text-fg"
                    : "text-muted hover:text-fg",
                )}
              >
                <span className="flex items-center gap-2">
                  <span className={cn("size-2 rounded-full", item.barClass)} aria-hidden="true" />
                  <span className="font-medium">{item.label}</span>
                </span>
                <span className="font-mono text-[11px] tabular-nums">
                  {item.count} · {item.sla}
                </span>
              </button>
            ))}
          </div>
        </Card>

        {/* Card 2: Regulator Coverage Bar Chart */}
        <Card className="flex flex-col justify-between p-6">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ChartBar
                size={18}
                weight="bold"
                aria-hidden="true"
                className="text-brand dark:text-accent"
              />
              <h3 className="text-sm font-semibold text-fg">Regulator coverage matrix</h3>
            </div>
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
              Clauses → Gaps
            </span>
          </div>

          <div className="my-5 space-y-4">
            {REGULATOR_COVERAGE.map((row) => {
              const pct = Math.round((row.findings / 6) * 100);
              return (
                <div key={row.name} className="space-y-1.5">
                  <div className="flex items-baseline justify-between gap-2 text-xs">
                    <span className="font-medium text-fg">{row.name}</span>
                    <span className="font-mono text-[11px] text-muted tabular-nums">
                      {row.clauses} clauses · {row.findings} mapped
                    </span>
                  </div>
                  <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-surface-2">
                    <div
                      className="h-full rounded-full bg-brand transition-all duration-500 ease-out dark:bg-support"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
                    Primary policy: {row.mapped}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="rounded-xl border border-line bg-surface-2/60 px-4 py-3 text-xs text-muted">
            Every extracted obligation links to a verified clause and a specific policy or control
            owner.
          </div>
        </Card>

        {/* Card 3: SLA Compression & Confidence Formula */}
        <Card className="flex flex-col justify-between p-6">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ClockCountdown
                size={18}
                weight="bold"
                aria-hidden="true"
                className="text-brand dark:text-accent"
              />
              <h3 className="text-sm font-semibold text-fg">SLA delta detection</h3>
            </div>
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
              Redline impact
            </span>
          </div>

          <div className="my-5 space-y-4">
            {SLA_COMPRESSIONS.map((item) => (
              <div
                key={item.regulator}
                className="rounded-xl border border-line bg-canvas/60 p-3.5 transition-colors hover:border-brand/40"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-brand dark:text-accent">
                    {item.regulator}
                  </span>
                  <span className="font-mono text-[10px] text-muted">{item.policy}</span>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2 text-xs">
                  <span className="text-muted line-through">{item.before}</span>
                  <span className="font-mono font-semibold text-fg">{item.after}</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
                  <div
                    className="h-full rounded-full bg-brand dark:bg-accent"
                    style={{ width: `${item.reductionPct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-line pt-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
              Formula · 40% Citation + 35% Mapping + 25% Rule
            </p>
          </div>
        </Card>
      </div>
    </section>
  );
}
