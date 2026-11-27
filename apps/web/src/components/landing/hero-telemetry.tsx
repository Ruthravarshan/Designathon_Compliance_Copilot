"use client";

import { useState } from "react";
import { Check, CheckCircle, FlowArrow, GitDiff, ShieldCheck } from "@phosphor-icons/react";
import { SeverityBadge } from "@/components/severity-badge";
import { cn } from "@/lib/cn";

const PIPELINE_STAGES = [
  {
    id: "ingest",
    step: "01",
    label: "Ingest",
    metric: "SHA-256",
    detail: "Circular text & source URL checksummed and split on blank lines into citable clauses.",
  },
  {
    id: "extract",
    step: "02",
    label: "Extract",
    metric: "100% cited",
    detail: "Atomic obligations parsed with SLA thresholds, audience, and verbatim source quotes.",
  },
  {
    id: "map",
    step: "03",
    label: "Map + Gap",
    metric: "0.88 conf",
    detail: "Deterministic tag + attribute scoring links clauses to internal policies & controls.",
  },
  {
    id: "review",
    step: "04",
    label: "Sign-off",
    metric: "Human gate",
    detail: "Compliance officer approves, edits, or rejects. Audit row + outbox email queued.",
  },
] as const;

export function HeroTelemetry() {
  const [tab, setTab] = useState<"pipeline" | "finding">("pipeline");
  const [activeStage, setActiveStage] = useState<string>("map");

  const currentStage =
    PIPELINE_STAGES.find((item) => item.id === activeStage) ?? PIPELINE_STAGES[2];

  return (
    <div className="pp-card-shadow overflow-hidden rounded-2xl border border-line bg-surface">
      {/* Header bar with real segmented toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface-2/60 px-5 py-3">
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="size-2 rounded-full bg-brand dark:bg-support motion-safe:animate-pulse"
          />
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
            PolicyPulse Engine · Verification Pipeline
          </span>
        </div>

        <div
          role="group"
          aria-label="Preview mode"
          className="inline-flex rounded-full border border-line bg-surface p-0.5"
        >
          <button
            type="button"
            aria-pressed={tab === "pipeline"}
            onClick={() => setTab("pipeline")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors duration-150",
              tab === "pipeline" ? "bg-brand text-brand-ink" : "text-muted hover:text-fg",
            )}
          >
            <FlowArrow size={13} weight="bold" aria-hidden="true" />
            Pipeline
          </button>
          <button
            type="button"
            aria-pressed={tab === "finding"}
            onClick={() => setTab("finding")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors duration-150",
              tab === "finding" ? "bg-brand text-brand-ink" : "text-muted hover:text-fg",
            )}
          >
            <GitDiff size={13} weight="bold" aria-hidden="true" />
            Redline
          </button>
        </div>
      </div>

      {tab === "pipeline" ? (
        <div className="space-y-5 p-5">
          {/* Animated SVG Signal Flow Diagram */}
          <div className="rounded-xl border border-line bg-canvas/70 p-4">
            <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.14em] text-muted">
              <span>Deterministic Verification Flow</span>
              <span className="text-brand dark:text-accent">Zero autonomous publish</span>
            </div>

            <svg
              viewBox="0 0 520 132"
              className="mt-3 h-auto w-full overflow-visible"
              role="img"
              aria-label="PolicyPulse verification pipeline diagram from circular ingestion to human sign-off"
            >
              {/* Connector lines */}
              <path d="M 78 54 H 168" className="stroke-line" strokeWidth="2" fill="none" />
              <path
                d="M 78 54 H 168"
                className="pp-signal-line stroke-brand dark:stroke-accent"
                strokeWidth="2"
                fill="none"
              />
              <path d="M 218 54 H 308" className="stroke-line" strokeWidth="2" fill="none" />
              <path
                d="M 218 54 H 308"
                className="pp-signal-line stroke-brand dark:stroke-accent"
                strokeWidth="2"
                fill="none"
              />
              <path d="M 358 54 H 442" className="stroke-line" strokeWidth="2" fill="none" />
              <path
                d="M 358 54 H 442"
                className="pp-signal-line stroke-brand dark:stroke-accent"
                strokeWidth="2"
                fill="none"
              />

              {/* Nodes */}
              {PIPELINE_STAGES.map((stage, idx) => {
                const cx = 56 + idx * 136;
                const selected = stage.id === activeStage;
                return (
                  <g
                    key={stage.id}
                    role="button"
                    tabIndex={0}
                    aria-pressed={selected}
                    aria-label={`Inspect stage ${stage.step}: ${stage.label}`}
                    className="cursor-pointer focus:outline-none"
                    onClick={() => setActiveStage(stage.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setActiveStage(stage.id);
                      }
                    }}
                  >
                    <rect
                      x={cx - 34}
                      y={24}
                      width="68"
                      height="60"
                      rx="14"
                      className={cn(
                        "transition-colors duration-150",
                        selected
                          ? "fill-brand stroke-brand"
                          : "fill-surface stroke-line hover:stroke-brand",
                      )}
                      strokeWidth="1.5"
                    />
                    <text
                      x={cx}
                      y={46}
                      textAnchor="middle"
                      className={cn(
                        "font-mono text-[10px] font-medium",
                        selected ? "fill-brand-ink/80" : "fill-muted",
                      )}
                    >
                      {stage.step}
                    </text>
                    <text
                      x={cx}
                      y={65}
                      textAnchor="middle"
                      className={cn(
                        "text-[11px] font-semibold",
                        selected ? "fill-brand-ink" : "fill-fg",
                      )}
                    >
                      {stage.label}
                    </text>
                    <text
                      x={cx}
                      y={108}
                      textAnchor="middle"
                      className="fill-muted font-mono text-[9px] uppercase tracking-[0.08em]"
                    >
                      {stage.metric}
                    </text>
                  </g>
                );
              })}
            </svg>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {PIPELINE_STAGES.map((stage) => {
                const selected = stage.id === activeStage;
                return (
                  <button
                    key={stage.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setActiveStage(stage.id)}
                    className={cn(
                      "min-h-8 rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-[0.1em] transition-colors",
                      selected
                        ? "bg-brand text-brand-ink"
                        : "border border-line bg-surface text-muted hover:border-muted/50 hover:text-fg",
                    )}
                  >
                    {stage.step} · {stage.label}
                  </button>
                );
              })}
            </div>

            <div className="mt-2.5 rounded-xl border border-line bg-surface px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-brand dark:text-accent">
                  Stage {currentStage.step} · {currentStage.label}
                </span>
                <span className="font-mono text-[10px] text-muted">{currentStage.metric}</span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-muted">{currentStage.detail}</p>
            </div>
          </div>

          {/* Confidence & Coverage Mini Breakdown */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-line bg-surface-2/60 p-3.5">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
                  Citation Integrity
                </span>
                <CheckCircle
                  size={14}
                  weight="bold"
                  aria-hidden="true"
                  className="text-brand dark:text-accent"
                />
              </div>
              <p className="mt-2 font-mono text-2xl font-medium text-fg tabular-nums">100%</p>
              <p className="mt-0.5 text-xs text-muted">
                Exact substring verified against source clause
              </p>
            </div>

            <div className="rounded-xl border border-line bg-surface-2/60 p-3.5">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
                  Audit Spine
                </span>
                <ShieldCheck
                  size={14}
                  weight="bold"
                  aria-hidden="true"
                  className="text-brand dark:text-accent"
                />
              </div>
              <p className="mt-2 font-mono text-2xl font-medium text-fg tabular-nums">RBAC + Log</p>
              <p className="mt-0.5 text-xs text-muted">
                Tenant-isolated mutations with actor provenance
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4 p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
              IRDAI/IT/CYBER/2023 · Section 4.2
            </p>
            <SeverityBadge severity="CRITICAL" />
          </div>

          <blockquote className="border-l-2 border-brand pl-4 text-sm leading-relaxed text-fg">
            “Critical and cyber security incidents shall be reported to the IRDAI within six hours
            of detection, along with the root cause and containment actions.”
          </blockquote>

          <div className="grid grid-cols-[1fr_auto] gap-3 rounded-xl bg-surface-2 p-3.5">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
                Mapped Policy
              </p>
              <p className="mt-1 text-sm font-medium text-fg">POL-SEC-02 · Incident response</p>
              <p className="mt-0.5 text-xs text-muted">Owner: Ruthravarshan · CISO</p>
            </div>
            <div className="text-right">
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
                SLA Gap
              </p>
              <p className="mt-1 font-mono text-xs font-semibold text-fg">72h → 6h</p>
            </div>
          </div>

          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
              Drafted Redline
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-fg">
              Report cyber security incidents to IRDAI and CERT-In{" "}
              <del className="rounded bg-danger/10 px-1 text-muted line-through decoration-danger/70">
                within 72 hours
              </del>{" "}
              <ins className="rounded bg-brand/15 px-1 text-fg no-underline dark:bg-accent/20">
                within 6 hours
              </ins>{" "}
              of detection.
            </p>
          </div>

          {/* Formula bar */}
          <div className="space-y-2 border-t border-line pt-3.5">
            <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.14em]">
              <span className="inline-flex items-center gap-1.5 text-brand dark:text-accent">
                <Check size={12} weight="bold" aria-hidden="true" />
                Citation verified
              </span>
              <span className="text-muted tabular-nums">Confidence 88% · Pending review</span>
            </div>
            <div className="flex h-2 w-full overflow-hidden rounded-full bg-surface-2">
              <div
                className="h-full bg-brand"
                style={{ width: "40%" }}
                title="40% Citation verification"
              />
              <div
                className="h-full bg-support"
                style={{ width: "35%" }}
                title="35% Policy mapping"
              />
              <div
                className="h-full bg-accent/80"
                style={{ width: "13%" }}
                title="Rule certainty"
              />
            </div>
          </div>
        </div>
      )}

      <div className="border-t border-line bg-surface-2/60 px-5 py-3">
        <p className="text-xs text-muted">
          Deterministic engine output from the bundled IRDAI fixture. Reviewed and signed off inside
          PolicyPulse.
        </p>
      </div>
    </div>
  );
}
