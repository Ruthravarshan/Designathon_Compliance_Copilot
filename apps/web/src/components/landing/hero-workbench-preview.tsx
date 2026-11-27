"use client";

import { useState } from "react";
import { Check, CheckCircle, GitDiff, LockKey, SealCheck } from "@phosphor-icons/react";
import { SeverityBadge } from "@/components/severity-badge";
import { cn } from "@/lib/cn";
import type { Severity } from "@/lib/compliance/types";
import { SpotlightCard } from "./reveal";

interface FixtureCase {
  id: string;
  tag: string;
  regulator: string;
  title: string;
  ref: string;
  severity: Severity;
  quote: string;
  policyCode: string;
  policyTitle: string;
  owner: string;
  deltaLabel: string;
  redlineBefore: string;
  redlineAfter: string;
  redlinePrefix: string;
  redlineSuffix: string;
  confidence: number;
  ruleScore: number;
}

const FIXTURES: readonly FixtureCase[] = [
  {
    id: "irdai",
    tag: "IRDAI · 6h SLA",
    regulator: "IRDAI",
    title: "Cyber incident reporting SLA",
    ref: "IRDAI/IT/CYBER/2023 · Sec 4.2",
    severity: "CRITICAL",
    quote:
      "Critical and cyber security incidents shall be reported to the IRDAI within six hours of detection, along with the root cause and containment actions.",
    policyCode: "POL-SEC-02",
    policyTitle: "Incident response",
    owner: "Ruthravarshan · CISO",
    deltaLabel: "72h → 6h",
    redlinePrefix: "Report cyber security incidents to IRDAI and CERT-In",
    redlineBefore: "within 72 hours",
    redlineAfter: "within 6 hours",
    redlineSuffix: "of detection.",
    confidence: 88,
    ruleScore: 13,
  },
  {
    id: "rbi",
    tag: "RBI · Residency",
    regulator: "RBI",
    title: "India-only payment data storage",
    ref: "RBI/IT/2023/07 · Sec 4.1",
    severity: "CRITICAL",
    quote:
      "All regulated entities shall ensure that payment system data is stored only on servers located within India and shall not be replicated outside India.",
    policyCode: "POL-CLOUD-05",
    policyTitle: "Cloud & data residency",
    owner: "Ruthravarshan · CISO",
    deltaLabel: "SG → India",
    redlinePrefix: "Regulated payment system records shall be stored",
    redlineBefore: "in ap-southeast-1 with cross-region replicas",
    redlineAfter: "exclusively on servers located within India",
    redlineSuffix: "without external replication.",
    confidence: 92,
    ruleScore: 17,
  },
  {
    id: "dpdp",
    tag: "DPDP · Consent",
    regulator: "MeitY · DPDP",
    title: "Comparable ease of withdrawal",
    ref: "DPDP Act 2023 · Sec 6(4)",
    severity: "HIGH",
    quote:
      "The Data Principal shall have the right to withdraw her consent at any time, and the ease of doing so shall be comparable to the ease with which such consent was given.",
    policyCode: "POL-PRIV-01",
    policyTitle: "Consent & erasure",
    owner: "Rajeshwari · Head of Compliance",
    deltaLabel: "14d → Immediate",
    redlinePrefix: "Data Principals may withdraw consent",
    redlineBefore: "by emailing support within 14 business days",
    redlineAfter: "through the same interface with immediate effect",
    redlineSuffix: "and trigger erasure.",
    confidence: 85,
    ruleScore: 10,
  },
] as const;

export function HeroWorkbenchPreview() {
  const [selectedId, setSelectedId] = useState<string>("irdai");
  const [signedOff, setSignedOff] = useState<Record<string, boolean>>({});
  const [scanTick, setScanTick] = useState(0);

  const active = FIXTURES.find((item) => item.id === selectedId) ?? FIXTURES[0]!;
  const isApproved = Boolean(signedOff[active.id]);

  function selectFixture(id: string) {
    setSelectedId(id);
    setScanTick((prev) => prev + 1);
  }

  return (
    <div className="mt-10 grid gap-6 lg:grid-cols-[0.38fr_0.62fr] lg:items-start">
      {/* Left rail: Scenario selector + Confidence formula */}
      <div className="space-y-4 min-w-0">
        <div
          role="group"
          aria-label="Regulatory scenarios"
          className="grid gap-2.5 sm:grid-cols-3 lg:grid-cols-1"
        >
          {FIXTURES.map((item) => {
            const isSelected = item.id === active.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={isSelected}
                onClick={() => selectFixture(item.id)}
                className={cn(
                  "flex min-h-11 flex-col items-start rounded-2xl border p-4 text-left transition-colors duration-150",
                  isSelected
                    ? "border-brand bg-surface pp-card-shadow dark:border-support"
                    : "border-line bg-surface/65 hover:border-brand/35 hover:bg-surface dark:hover:border-support/40",
                )}
              >
                <div className="flex w-full items-center justify-between gap-2">
                  <span
                    className={cn(
                      "font-mono text-[10px] uppercase tracking-[0.14em]",
                      isSelected ? "text-brand dark:text-support" : "text-muted",
                    )}
                  >
                    {item.tag}
                  </span>
                  <span className="font-mono text-[10px] text-muted tabular-nums">
                    {item.deltaLabel}
                  </span>
                </div>
                <p className="mt-1.5 text-sm font-semibold text-fg">{item.title}</p>
                <p className="mt-0.5 truncate w-full text-xs text-muted">
                  {item.policyCode} · {item.policyTitle}
                </p>
              </button>
            );
          })}
        </div>

        <div className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
              Confidence rubric
            </span>
            <span className="font-mono text-xs font-semibold text-brand dark:text-support tabular-nums">
              {active.confidence}%
            </span>
          </div>
          <div className="mt-3 flex h-2 w-full overflow-hidden rounded-full bg-surface-2">
            <div className="h-full bg-brand" style={{ width: "40%" }} title="40% Citation" />
            <div className="h-full bg-support" style={{ width: "35%" }} title="35% Mapping" />
            <div
              className="h-full bg-fg/50 dark:bg-fg/60"
              style={{ width: `${active.ruleScore}%` }}
              title="Rule certainty"
            />
          </div>
          <dl className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
            <div>
              <dt className="font-mono text-[9px] uppercase tracking-[0.1em] text-muted">Quote</dt>
              <dd className="font-mono font-semibold text-fg tabular-nums">40%</dd>
            </div>
            <div>
              <dt className="font-mono text-[9px] uppercase tracking-[0.1em] text-muted">
                Mapping
              </dt>
              <dd className="font-mono font-semibold text-fg tabular-nums">35%</dd>
            </div>
            <div>
              <dt className="font-mono text-[9px] uppercase tracking-[0.1em] text-muted">Rule</dt>
              <dd className="font-mono font-semibold text-fg tabular-nums">{active.ruleScore}%</dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Right stage: Redline & Human Sign-off Simulator */}
      <SpotlightCard className="min-w-0 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-surface-2/70 px-4 py-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-2">
            <GitDiff
              size={15}
              weight="bold"
              aria-hidden="true"
              className="shrink-0 text-brand dark:text-support"
            />
            <span className="truncate font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
              {active.ref}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <SeverityBadge severity={active.severity} />
            <span className="inline-flex items-center gap-1 rounded-full border border-brand/25 bg-brand/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-brand dark:border-support/35 dark:bg-support/15 dark:text-support">
              <CheckCircle size={11} weight="bold" aria-hidden="true" />
              Verified
            </span>
          </div>
        </div>

        <div className="relative overflow-hidden p-4 sm:p-6">
          <div
            key={`beam-${scanTick}`}
            aria-hidden="true"
            className="pp-scan-beam pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-transparent via-brand/10 to-transparent dark:via-support/15"
          />

          <div className="space-y-4">
            <blockquote className="border-l-2 border-brand pl-3.5 text-xs leading-relaxed text-fg sm:text-sm dark:border-support">
              “{active.quote}”
            </blockquote>

            <div className="grid grid-cols-1 gap-2.5 rounded-xl border border-line bg-surface-2/70 px-3.5 py-3 sm:grid-cols-[1fr_auto] sm:items-center">
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-fg sm:text-sm">
                  {active.policyCode} · {active.policyTitle}
                </p>
                <p className="truncate text-xs text-muted">Owner: {active.owner}</p>
              </div>
              <div className="sm:text-right">
                <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted">Delta</p>
                <p className="font-mono text-xs font-semibold text-brand dark:text-support">
                  {active.deltaLabel}
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-line bg-canvas/70 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
                  Drafted policy redline
                </span>
                <span className="font-mono text-[10px] text-muted tabular-nums">
                  Substring ≥ 12 chars matched
                </span>
              </div>
              <p className="mt-2.5 text-xs leading-6 text-fg sm:text-sm sm:leading-7">
                {active.redlinePrefix}{" "}
                <del className="rounded bg-danger/10 px-1 text-muted line-through decoration-danger/70">
                  {active.redlineBefore}
                </del>{" "}
                <ins className="rounded bg-brand/12 px-1 text-fg no-underline dark:bg-support/20">
                  {active.redlineAfter}
                </ins>{" "}
                {active.redlineSuffix}
              </p>
            </div>

            <div className="flex flex-col items-start justify-between gap-3 border-t border-line pt-4 sm:flex-row sm:items-center">
              <div className="flex min-w-0 items-center gap-2 text-xs">
                {isApproved ? (
                  <span className="inline-flex items-center gap-1.5 font-medium text-brand dark:text-support">
                    <SealCheck size={15} weight="bold" aria-hidden="true" className="shrink-0" />
                    <span>Approved · Audit event + outbox email queued</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-muted">
                    <LockKey size={14} weight="bold" aria-hidden="true" className="shrink-0" />
                    <span>Awaiting officer sign-off</span>
                  </span>
                )}
              </div>

              <button
                type="button"
                aria-pressed={isApproved}
                onClick={() => setSignedOff((prev) => ({ ...prev, [active.id]: !prev[active.id] }))}
                className={cn(
                  "inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-full px-4 text-xs font-medium transition-[background-color,transform] duration-150 active:scale-[0.98] sm:w-auto",
                  isApproved
                    ? "border border-line bg-surface-2 text-fg hover:bg-surface"
                    : "bg-brand text-brand-ink hover:bg-brand-hover",
                )}
              >
                <Check size={13} weight="bold" aria-hidden="true" />
                {isApproved ? "Reset preview" : "Simulate sign-off"}
              </button>
            </div>
          </div>
        </div>
      </SpotlightCard>
    </div>
  );
}
