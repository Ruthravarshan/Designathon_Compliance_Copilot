"use client";

import { useState } from "react";
import { Check, CheckCircle, FlowArrow, GitDiff, LockKey, SealCheck } from "@phosphor-icons/react";
import { SeverityBadge } from "@/components/severity-badge";
import { cn } from "@/lib/cn";
import type { Severity } from "@/lib/compliance/types";
import { SpotlightCard } from "./reveal";

interface FixtureCase {
  id: string;
  tag: string;
  regulator: string;
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
    ref: "IRDAI/IT/CYBER/2023 · Sec 4.2",
    severity: "CRITICAL",
    quote:
      "Critical and cyber security incidents shall be reported to the IRDAI within six hours of detection, along with the root cause and containment actions.",
    policyCode: "POL-SEC-02",
    policyTitle: "Incident response",
    owner: "Arjun Mehta · CISO",
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
    ref: "RBI/DPSS/2018/53 · Sec 2.1",
    severity: "CRITICAL",
    quote:
      "All payment system providers shall ensure that the entire data relating to payment systems operated by them are stored in a system only in India.",
    policyCode: "POL-CLOUD-05",
    policyTitle: "Cloud & data residency",
    owner: "Kavita Nair · Infra Lead",
    deltaLabel: "SG → India",
    redlinePrefix: "Regulated payment system records shall be stored",
    redlineBefore: "in ap-southeast-1 with cross-region replicas",
    redlineAfter: "exclusively on servers located within India",
    redlineSuffix: "per RBI DPSS.",
    confidence: 92,
    ruleScore: 17,
  },
  {
    id: "dpdp",
    tag: "DPDP · Consent",
    regulator: "MeitY / DPDP",
    ref: "DPDP Act 2023 · Sec 6(4)",
    severity: "HIGH",
    quote:
      "The ease of doing so shall be comparable to the ease with which such consent was given, and upon withdrawal the Data Fiduciary shall cease processing.",
    policyCode: "POL-PRIV-01",
    policyTitle: "Consent & erasure",
    owner: "Rohan Verma · DPO",
    deltaLabel: "14d → One-click",
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
  const [view, setView] = useState<"redline" | "pipeline">("redline");
  const [signedOff, setSignedOff] = useState<Record<string, boolean>>({});
  const [scanTick, setScanTick] = useState(0);

  const active = FIXTURES.find((item) => item.id === selectedId) ?? FIXTURES[0]!;
  const isApproved = Boolean(signedOff[active.id]);

  function selectFixture(id: string) {
    setSelectedId(id);
    setScanTick((prev) => prev + 1);
  }

  return (
    <SpotlightCard className="overflow-hidden">
      {/* Window chrome */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-surface-2/70 px-4 py-3 sm:px-5">
        <div className="flex items-center gap-2.5">
          <span className="relative flex size-2.5 items-center justify-center" aria-hidden="true">
            <span className="pp-pulse-ring absolute inline-flex size-2.5 rounded-full bg-brand dark:bg-support" />
            <span className="relative inline-flex size-2 rounded-full bg-brand dark:bg-support" />
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
            Verification Preview · Fixture
          </span>
        </div>

        <div
          role="group"
          aria-label="Preview mode"
          className="inline-flex rounded-full border border-line bg-surface p-0.5"
        >
          <button
            type="button"
            aria-pressed={view === "redline"}
            onClick={() => setView("redline")}
            className={cn(
              "inline-flex min-h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors duration-150",
              view === "redline" ? "bg-brand text-brand-ink" : "text-muted hover:text-fg",
            )}
          >
            <GitDiff size={13} weight="bold" aria-hidden="true" />
            Redline
          </button>
          <button
            type="button"
            aria-pressed={view === "pipeline"}
            onClick={() => setView("pipeline")}
            className={cn(
              "inline-flex min-h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors duration-150",
              view === "pipeline" ? "bg-brand text-brand-ink" : "text-muted hover:text-fg",
            )}
          >
            <FlowArrow size={13} weight="bold" aria-hidden="true" />
            Flow
          </button>
        </div>
      </div>

      {/* Fixture selector tabs */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-line bg-canvas/60 px-4 py-2.5 sm:px-5">
        {FIXTURES.map((item) => {
          const isSelected = item.id === active.id;
          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={isSelected}
              onClick={() => selectFixture(item.id)}
              className={cn(
                "min-h-8 rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-[0.1em] transition-colors duration-150",
                isSelected
                  ? "bg-brand text-brand-ink"
                  : "border border-line bg-surface text-muted hover:border-muted/50 hover:text-fg",
              )}
            >
              {item.tag}
            </button>
          );
        })}
      </div>

      {/* Body with subtle scan beam on fixture change */}
      <div className="relative overflow-hidden p-4 sm:p-5">
        <div
          key={`beam-${scanTick}`}
          aria-hidden="true"
          className="pp-scan-beam pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-transparent via-brand/10 to-transparent dark:via-support/15"
        />

        {view === "redline" ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
                {active.ref}
              </span>
              <div className="flex items-center gap-2">
                <SeverityBadge severity={active.severity} />
                <span className="inline-flex items-center gap-1 rounded-full border border-brand/25 bg-brand/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-brand dark:border-support/35 dark:bg-support/15 dark:text-support">
                  <CheckCircle size={11} weight="bold" aria-hidden="true" />
                  Verified
                </span>
              </div>
            </div>

            <blockquote className="border-l-2 border-brand pl-3.5 text-xs leading-relaxed text-fg sm:text-[13px] dark:border-support">
              “{active.quote}”
            </blockquote>

            <div className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-xl border border-line bg-surface-2/70 px-3.5 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-fg">
                  {active.policyCode} · {active.policyTitle}
                </p>
                <p className="truncate text-[11px] text-muted">Owner: {active.owner}</p>
              </div>
              <div className="text-right">
                <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted">Delta</p>
                <p className="font-mono text-xs font-semibold text-brand dark:text-support">
                  {active.deltaLabel}
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-line bg-canvas/70 p-3.5">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
                  Drafted redline
                </span>
                <span className="font-mono text-[10px] text-muted tabular-nums">
                  {active.confidence}% confidence
                </span>
              </div>
              <p className="mt-2 text-xs leading-6 text-fg sm:text-[13px]">
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

            {/* Confidence bar */}
            <div className="space-y-1.5">
              <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                <div className="h-full bg-brand" style={{ width: "40%" }} title="40% Citation" />
                <div className="h-full bg-support" style={{ width: "35%" }} title="35% Mapping" />
                <div
                  className="h-full bg-fg/50 dark:bg-fg/60"
                  style={{ width: `${active.ruleScore}%` }}
                  title="Rule certainty"
                />
              </div>
              <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted">
                40% exact quote · 35% policy map · {active.ruleScore}% rule certainty
              </p>
            </div>

            {/* Interactive Sign-off Preview Button */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3.5">
              <div className="flex items-center gap-2 text-xs">
                {isApproved ? (
                  <span className="inline-flex items-center gap-1.5 font-medium text-brand dark:text-support">
                    <SealCheck size={15} weight="bold" aria-hidden="true" />
                    Approved · Audit event + outbox email queued
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-muted">
                    <LockKey size={14} weight="bold" aria-hidden="true" />
                    Awaiting officer sign-off
                  </span>
                )}
              </div>

              <button
                type="button"
                aria-pressed={isApproved}
                onClick={() => setSignedOff((prev) => ({ ...prev, [active.id]: !prev[active.id] }))}
                className={cn(
                  "inline-flex min-h-9 items-center gap-1.5 rounded-full px-3.5 text-xs font-medium transition-[background-color,transform] duration-150 active:scale-[0.98]",
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
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl border border-line bg-canvas/70 p-3.5">
              <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
                <span>Deterministic Signal Flow</span>
                <span className="text-brand dark:text-support">{active.regulator}</span>
              </div>
              <svg
                viewBox="0 0 460 110"
                className="mt-3 h-auto w-full overflow-visible"
                role="img"
                aria-label="Four-stage verification pipeline from circular ingestion to officer sign-off"
              >
                <path d="M 70 46 H 150" className="stroke-line" strokeWidth="2" fill="none" />
                <path
                  d="M 70 46 H 150"
                  className="pp-signal-line stroke-brand dark:stroke-support"
                  strokeWidth="2"
                  fill="none"
                />
                <path d="M 190 46 H 270" className="stroke-line" strokeWidth="2" fill="none" />
                <path
                  d="M 190 46 H 270"
                  className="pp-signal-line stroke-brand dark:stroke-support"
                  strokeWidth="2"
                  fill="none"
                />
                <path d="M 310 46 H 390" className="stroke-line" strokeWidth="2" fill="none" />
                <path
                  d="M 310 46 H 390"
                  className="pp-signal-line stroke-brand dark:stroke-support"
                  strokeWidth="2"
                  fill="none"
                />

                {[
                  { step: "01", label: "Ingest", cx: 50, active: false },
                  { step: "02", label: "Extract", cx: 170, active: false },
                  { step: "03", label: "Map", cx: 290, active: !isApproved },
                  { step: "04", label: "Sign off", cx: 410, active: isApproved },
                ].map((node) => (
                  <g key={node.step}>
                    <rect
                      x={node.cx - 32}
                      y={20}
                      width="64"
                      height="52"
                      rx="12"
                      className={cn(
                        "transition-colors duration-200",
                        node.active ? "fill-brand stroke-brand" : "fill-surface stroke-line",
                      )}
                      strokeWidth="1.5"
                    />
                    <text
                      x={node.cx}
                      y={40}
                      textAnchor="middle"
                      className={cn(
                        "font-mono text-[9px]",
                        node.active ? "fill-brand-ink/80" : "fill-muted",
                      )}
                    >
                      {node.step}
                    </text>
                    <text
                      x={node.cx}
                      y={57}
                      textAnchor="middle"
                      className={cn(
                        "text-[11px] font-semibold",
                        node.active ? "fill-brand-ink" : "fill-fg",
                      )}
                    >
                      {node.label}
                    </text>
                  </g>
                ))}
              </svg>
            </div>

            <div className="grid gap-2.5 sm:grid-cols-2">
              <div className="rounded-xl border border-line bg-surface-2/60 p-3">
                <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted">
                  Citation gate
                </p>
                <p className="mt-1 font-mono text-sm font-semibold text-fg">100% substring check</p>
                <p className="mt-0.5 text-[11px] text-muted">
                  Unverified quotes flagged before review.
                </p>
              </div>
              <div className="rounded-xl border border-line bg-surface-2/60 p-3">
                <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted">
                  Policy mutation
                </p>
                <p className="mt-1 font-mono text-sm font-semibold text-fg">Human-gated</p>
                <p className="mt-0.5 text-[11px] text-muted">Zero autonomous policy publishing.</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </SpotlightCard>
  );
}
