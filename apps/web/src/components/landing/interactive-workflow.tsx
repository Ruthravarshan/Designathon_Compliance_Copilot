"use client";

import { useState } from "react";
import { CheckCircle, LockKey, Scales, ShieldCheck } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { SpotlightCard } from "./reveal";

interface WorkflowStage {
  step: string;
  title: string;
  body: string;
  artifactLabel: string;
  artifactLines: readonly string[];
}

const WORKFLOW_STAGES: readonly WorkflowStage[] = [
  {
    step: "01",
    title: "Ingest",
    body: "Upload regulatory PDFs or monitor allowlisted circular feeds with SHA-256 deduplication.",
    artifactLabel: "SHA-256 + Clause Split",
    artifactLines: [
      "source: https://irdai.gov.in/document-detail",
      "checksum: 8f94e2c1a04d... · deduplicated",
      "clauses_parsed: 6 blank-line verified blocks",
    ],
  },
  {
    step: "02",
    title: "Extract",
    body: "Structure clauses into atomic obligations with SLA deadlines, applicability, and source quotes.",
    artifactLabel: "Verified Obligation + Quote",
    artifactLines: [
      "obligation: incident_reporting_hours (6h SLA)",
      "citation_verified: true (exact substring ≥ 12 chars)",
      "applicable_to: Regulated entities & CISO",
    ],
  },
  {
    step: "03",
    title: "Assess",
    body: "Map obligations against your internal policy register and surface severity-ranked gaps.",
    artifactLabel: "Mapping + Severity Rubric",
    artifactLines: [
      "mapped_policy: POL-SEC-02 (Incident response)",
      "gap_status: CRITICAL_GAP (72h internal vs 6h mandate)",
      "confidence: 0.88 (0.40 cite + 0.35 map + 0.13 rule)",
    ],
  },
  {
    step: "04",
    title: "Sign off",
    body: "Approve, edit, or reject drafted redlines. Every decision writes an immutable audit row.",
    artifactLabel: "Audit Spine + Outbox Queue",
    artifactLines: [
      "decision: APPROVED · actor: Rajeshwari (OWNER)",
      "audit_row: finding.reviewed · append-only",
      "outbox_email: queued to policy owner · escaped HTML",
    ],
  },
] as const;

export function InteractiveWorkflow() {
  const [activeStep, setActiveStep] = useState(0);
  const current = WORKFLOW_STAGES[activeStep] ?? WORKFLOW_STAGES[0]!;

  return (
    <div className="mt-10 space-y-4">
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
        {WORKFLOW_STAGES.map((item, index) => {
          const isActive = index === activeStep;
          return (
            <button
              key={item.step}
              type="button"
              aria-pressed={isActive}
              onClick={() => setActiveStep(index)}
              className={cn(
                "group relative flex min-h-14 flex-col rounded-2xl border p-3.5 text-left transition-all duration-200 sm:p-5",
                isActive
                  ? "border-brand bg-surface pp-card-shadow dark:border-support"
                  : "border-line bg-surface/60 hover:border-brand/35 hover:bg-surface dark:hover:border-support/40",
              )}
            >
              <div className="flex w-full items-center justify-between gap-2">
                <span
                  className={cn(
                    "font-mono text-[11px] tracking-[0.14em]",
                    isActive ? "text-brand dark:text-support" : "text-muted",
                  )}
                >
                  {item.step}
                </span>
                <span
                  aria-hidden="true"
                  className={cn(
                    "h-1.5 w-6 rounded-full transition-colors duration-200 sm:w-8",
                    isActive ? "bg-brand dark:bg-support" : "bg-line",
                  )}
                />
              </div>
              <h3 className="mt-2.5 text-sm font-semibold tracking-[-0.015em] text-fg sm:mt-4 sm:text-lg">
                {item.title}
              </h3>
              <p className="mt-2 hidden text-sm leading-relaxed text-muted sm:block">{item.body}</p>
            </button>
          );
        })}
      </div>

      {/* Live stage artifact output */}
      <div className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
        <p className="mb-3 text-xs leading-relaxed text-muted sm:hidden">{current.body}</p>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-brand dark:text-support">
            Stage {current.step} output · {current.artifactLabel}
          </span>
          <span className="font-mono text-[10px] text-muted">
            Step {activeStep + 1} of {WORKFLOW_STAGES.length}
          </span>
        </div>
        <div className="mt-3 grid gap-2 font-mono text-xs text-fg sm:grid-cols-3">
          {current.artifactLines.map((line) => (
            <div
              key={line}
              className="min-w-0 rounded-xl border border-line bg-surface-2/60 px-3 py-2.5 [overflow-wrap:anywhere]"
            >
              {line}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

interface RolePreviewSpec {
  id: string;
  label: string;
  scope: string;
  capabilities: readonly { name: string; allowed: boolean }[];
}

const ROLE_PREVIEWS: readonly RolePreviewSpec[] = [
  {
    id: "owner",
    label: "Owner",
    scope: "Full workspace governance, OAuth mailbox, storage failover, and redline sign-off",
    capabilities: [
      { name: "Ingest circulars & run watch", allowed: true },
      { name: "Approve / reject redlines", allowed: true },
      { name: "Run policy & DPDP scans", allowed: true },
      { name: "Gmail OAuth, storage & CSV export", allowed: true },
    ],
  },
  {
    id: "admin",
    label: "Admin (CISO)",
    scope: "Security ops, ingestion, watch runs, storage failover, and redline sign-off",
    capabilities: [
      { name: "Ingest circulars & run watch", allowed: true },
      { name: "Approve / reject redlines", allowed: true },
      { name: "Configure SharePoint / Drive", allowed: true },
      { name: "Read audit trail & export CSV", allowed: true },
    ],
  },
  {
    id: "member",
    label: "Member (HR)",
    scope: "Read circulars, run assigned policy checks, and query grounded Q&A",
    capabilities: [
      { name: "Run policy check (POL-HR-01)", allowed: true },
      { name: "Ask grounded Policy Q&A", allowed: true },
      { name: "Approve / reject redlines", allowed: false },
      { name: "Run watch or storage admin", allowed: false },
    ],
  },
  {
    id: "auditor",
    label: "Auditor",
    scope: "Read-only evidence inspection across circulars, findings, and policies",
    capabilities: [
      { name: "Read circulars & findings", allowed: true },
      { name: "Approve / reject redlines", allowed: false },
      { name: "Run policy checks or watch", allowed: false },
      { name: "Read restricted audit log", allowed: false },
    ],
  },
] as const;

const ENTERPRISE_CONTROLS = [
  {
    title: "OAuth 2.0 & SAML SSO",
    detail: "Google Workspace, Microsoft Entra ID, and domain-bound SAML identity support.",
    icon: ShieldCheck,
  },
  {
    title: "Server-side RBAC",
    detail: "Granular permissions across Owners, Admins, Policy Members, and Read-Only Auditors.",
    icon: LockKey,
  },
  {
    title: "Deterministic scoring",
    detail:
      "Published confidence formula combining citation verification, mapping, and rule certainty.",
    icon: Scales,
  },
  {
    title: "Append-only audit spine",
    detail:
      "Every review decision, policy check, watch run, and data scan writes an attributable record.",
    icon: CheckCircle,
  },
] as const;

export function SecurityArchitectureGrid() {
  const [roleId, setRoleId] = useState<string>("owner");
  const activeRole = ROLE_PREVIEWS.find((r) => r.id === roleId) ?? ROLE_PREVIEWS[0]!;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {ENTERPRISE_CONTROLS.map((item) => {
          const Icon = item.icon;
          return (
            <SpotlightCard key={item.title} className="p-5">
              <Icon
                size={18}
                weight="bold"
                aria-hidden="true"
                className="text-brand dark:text-support"
              />
              <h3 className="mt-3.5 text-sm font-semibold text-fg">{item.title}</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-muted">{item.detail}</p>
            </SpotlightCard>
          );
        })}
      </div>

      {/* Interactive RBAC Enforcement Preview */}
      <SpotlightCard className="p-4 sm:p-5">
        <div className="flex flex-col gap-3 border-b border-line pb-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
              Server-enforced RBAC preview
            </p>
            <p className="mt-1 text-xs text-muted">{activeRole.scope}</p>
          </div>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Role capability preview">
            {ROLE_PREVIEWS.map((role) => {
              const selected = role.id === activeRole.id;
              return (
                <button
                  key={role.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setRoleId(role.id)}
                  className={cn(
                    "min-h-9 rounded-full px-3 py-1 text-xs font-medium transition-colors",
                    selected
                      ? "bg-brand text-brand-ink"
                      : "border border-line bg-surface-2 text-muted hover:text-fg",
                  )}
                >
                  {role.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-3.5 grid gap-2 sm:grid-cols-2">
          {activeRole.capabilities.map((cap) => (
            <div
              key={cap.name}
              className="flex min-w-0 items-center justify-between gap-2 rounded-xl border border-line bg-canvas/60 px-3 py-2.5 text-xs"
            >
              <span
                className={cn(
                  "min-w-0 truncate",
                  cap.allowed ? "text-fg" : "text-muted line-through",
                )}
              >
                {cap.name}
              </span>
              <span
                className={cn(
                  "shrink-0 font-mono text-[10px] uppercase tracking-[0.1em]",
                  cap.allowed ? "text-brand dark:text-support" : "text-muted",
                )}
              >
                {cap.allowed ? "Allowed" : "403 Blocked"}
              </span>
            </div>
          ))}
        </div>
      </SpotlightCard>
    </div>
  );
}
