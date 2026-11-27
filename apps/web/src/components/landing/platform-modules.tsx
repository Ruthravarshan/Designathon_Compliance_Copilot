"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Books,
  ChatsCircle,
  CheckCircle,
  HardDrives,
  Pulse,
} from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { SpotlightCard } from "./reveal";

interface PlatformModule {
  id: string;
  index: string;
  label: string;
  route: string;
  badge: string;
  headline: string;
  summary: string;
  guarantees: readonly string[];
  telemetry: readonly { label: string; value: string }[];
  icon: typeof Pulse;
}

const MODULES: readonly PlatformModule[] = [
  {
    id: "watch",
    index: "01",
    label: "Regulatory Watch",
    route: "/app/watch",
    badge: "Weekly cron + on-demand",
    headline: "Monitor regulator feeds and capture checksum-verified revisions.",
    summary:
      "Fetches public RBI, SEBI, IRDAI, and MeitY circular pages on a weekly schedule or on demand. SSRF-guarded downloads, PDF/HTML extraction, and SHA-256 revision diffs keep every update traceable.",
    guarantees: [
      "DNS/IP allowlist, redirect cap, and payload size limits on every fetch",
      "SHA-256 deduplication skips unchanged circulars and tracks republished revisions",
      "Weekly workspace owner digest highlights posture score and overdue findings",
    ],
    telemetry: [
      { label: "Schedule", value: "Mon 04:00 UTC + manual" },
      { label: "Extraction", value: "PDF (unpdf) & HTML" },
      { label: "Revision log", value: "SHA-256 diff trail" },
    ],
    icon: Pulse,
  },
  {
    id: "policies",
    index: "02",
    label: "Policy Checks & Posture",
    route: "/app/policies",
    badge: "0–100 posture scoring",
    headline: "Score internal policies against mapped regulatory gaps.",
    summary:
      "Evaluate any corporate policy on demand without mutating policy text. Checks aggregate open critical, high, and overdue findings into COMPLIANT, AT_RISK, or GAPS states.",
    guarantees: [
      "Records an immutable PolicyCheck row with actor, trigger, and timestamp",
      "Separates satisfied mappings from open gaps for accurate HR & CISO reporting",
      "Queues owner + workspace owner email alerts automatically when gaps exist",
    ],
    telemetry: [
      { label: "Outcomes", value: "COMPLIANT · AT_RISK · GAPS" },
      { label: "Who can run", value: "Owner, Admin, HR Member" },
      { label: "Mutation", value: "Zero autonomous policy edit" },
    ],
    icon: Books,
  },
  {
    id: "assistant",
    index: "03",
    label: "Grounded Q&A & DPDP",
    route: "/app/assistant",
    badge: "Verbatim citation lock",
    headline: "Ask the policy register and scan personal data fields for DPDP risk.",
    summary:
      "A workspace-scoped assistant answers compliance questions from stored policies, controls, and circular clauses—refusing any answer without a verified quote—paired with DPDP consent and encryption scanning.",
    guarantees: [
      "Every generated or retrieved answer cites exact stored clauses verbatim",
      "Refuses and instructs escalation when no supporting passage exists",
      "DPDP data discovery flags unconsented or unencrypted sensitive fields",
    ],
    telemetry: [
      { label: "Grounding", value: "Gemini + retrieval fallback" },
      { label: "Tenant scope", value: "Strict workspaceId filter" },
      { label: "DPDP scan", value: "Consent & encryption check" },
    ],
    icon: ChatsCircle,
  },
  {
    id: "integrations",
    index: "04",
    label: "Storage, Gmail & Exports",
    route: "/app/settings/storage",
    badge: "Primary + automatic fallback",
    headline: "Enterprise storage failover, encrypted Gmail outbox, and CSV evidence.",
    summary:
      "Route circular PDFs to Microsoft SharePoint / Graph with automatic failover to Google Drive or Supabase Storage, deliver alerts via Gmail OAuth, and export formula-safe audit CSVs.",
    guarantees: [
      "Failover triggers only on provider unavailability; duplicates never fall back",
      "AES-256-GCM encrypted Gmail OAuth tokens with live probe & disconnect controls",
      "Formula-injection guarded CSV export for board auditors and regulators",
    ],
    telemetry: [
      { label: "Primary / Fallback", value: "SharePoint → Drive / Supabase" },
      { label: "Mail outbox", value: "Gmail OAuth · escaped HTML" },
      { label: "Audit export", value: "GET /api/export/findings" },
    ],
    icon: HardDrives,
  },
] as const;

export function PlatformModules() {
  const [activeId, setActiveId] = useState<string>("watch");
  const active = MODULES.find((mod) => mod.id === activeId) ?? MODULES[0]!;
  const ActiveIcon = active.icon;

  return (
    <div className="mt-10 grid gap-6 lg:grid-cols-[0.42fr_0.58fr] lg:items-start">
      {/* Module selector grid: 2x2 compact tabs on small screens, crisp stack on desktop */}
      <div
        role="tablist"
        aria-label="Platform capabilities"
        className="grid grid-cols-2 gap-2.5 lg:grid-cols-1"
      >
        {MODULES.map((mod) => {
          const Icon = mod.icon;
          const selected = mod.id === active.id;
          return (
            <button
              key={mod.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setActiveId(mod.id)}
              className={cn(
                "flex min-h-12 flex-col items-start rounded-2xl border p-3.5 text-left transition-colors duration-150 sm:p-4",
                selected
                  ? "border-brand bg-surface pp-card-shadow dark:border-support"
                  : "border-line bg-surface/60 hover:border-brand/35 hover:bg-surface dark:hover:border-support/40",
              )}
            >
              <div className="flex w-full items-center justify-between gap-2">
                <span
                  className={cn(
                    "font-mono text-[10px] uppercase tracking-[0.14em]",
                    selected ? "text-brand dark:text-support" : "text-muted",
                  )}
                >
                  {mod.index}
                </span>
                <Icon
                  size={16}
                  weight={selected ? "fill" : "bold"}
                  aria-hidden="true"
                  className={selected ? "text-brand dark:text-support" : "text-muted"}
                />
              </div>
              <span className="mt-2 text-xs font-semibold text-fg sm:text-sm">{mod.label}</span>
              <span className="mt-0.5 hidden font-mono text-[10px] text-muted sm:block">
                {mod.badge}
              </span>
            </button>
          );
        })}
      </div>

      {/* Active Module Specification Card */}
      <SpotlightCard className="min-w-0 overflow-hidden" role="tabpanel">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-surface-2/70 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <ActiveIcon
              size={15}
              weight="bold"
              aria-hidden="true"
              className="shrink-0 text-brand dark:text-support"
            />
            <span className="truncate font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
              Module {active.index} · {active.route}
            </span>
          </div>
          <span className="rounded-full border border-brand/25 bg-brand/10 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-brand dark:border-support/35 dark:bg-support/15 dark:text-support">
            {active.badge}
          </span>
        </div>

        <div className="space-y-5 p-4 sm:p-6">
          <div>
            <h3 className="text-lg font-semibold tracking-[-0.02em] text-fg sm:text-xl">
              {active.headline}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">{active.summary}</p>
          </div>

          <ul className="space-y-2.5 border-t border-line pt-4">
            {active.guarantees.map((item) => (
              <li
                key={item}
                className="flex items-start gap-2.5 text-xs leading-relaxed text-fg sm:text-[13px]"
              >
                <CheckCircle
                  size={15}
                  weight="bold"
                  aria-hidden="true"
                  className="mt-0.5 shrink-0 text-brand dark:text-support"
                />
                <span>{item}</span>
              </li>
            ))}
          </ul>

          <dl className="grid gap-2.5 sm:grid-cols-3">
            {active.telemetry.map((spec) => (
              <div
                key={spec.label}
                className="min-w-0 rounded-xl border border-line bg-canvas/70 px-3.5 py-2.5"
              >
                <dt className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted">
                  {spec.label}
                </dt>
                <dd className="mt-1 break-words font-mono text-[11px] font-semibold text-fg">
                  {spec.value}
                </dd>
              </div>
            ))}
          </dl>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
              Server-enforced RBAC &amp; audit trail
            </span>
            <Link
              href="/signin"
              className="inline-flex min-h-9 items-center gap-1.5 text-xs font-semibold text-brand hover:underline dark:text-support"
            >
              Open in workbench
              <ArrowRight size={13} weight="bold" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </SpotlightCard>
    </div>
  );
}
