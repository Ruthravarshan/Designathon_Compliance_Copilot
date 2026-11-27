import type { ReactNode } from "react";
import { Info, Minus, Warning, WarningOctagon } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/cn";
import type { Severity } from "@/lib/compliance/types";
import { humanize } from "@/lib/format";

const severityConfig: Record<
  Severity,
  { className: string; iconClass: string; icon: typeof Warning }
> = {
  CRITICAL: {
    className: "border-danger/35 bg-danger/10 text-fg",
    iconClass: "text-danger",
    icon: WarningOctagon,
  },
  HIGH: {
    className:
      "border-brand/30 bg-brand/10 text-brand dark:border-support/35 dark:bg-support/15 dark:text-support",
    iconClass: "text-brand dark:text-support",
    icon: Warning,
  },
  MEDIUM: {
    className: "border-line bg-surface-2 text-fg",
    iconClass: "text-muted",
    icon: Info,
  },
  LOW: {
    className: "border-line bg-surface text-muted",
    iconClass: "text-muted",
    icon: Minus,
  },
};

export function SeverityBadge({ severity, className }: { severity: Severity; className?: string }) {
  const cfg = severityConfig[severity];
  const Icon = cfg.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.12em]",
        cfg.className,
        className,
      )}
    >
      <Icon size={12} weight="bold" aria-hidden="true" className={cfg.iconClass} />
      <span>{severity}</span>
    </span>
  );
}

const reviewStyles: Record<string, string> = {
  PENDING_REVIEW:
    "border-brand/25 bg-brand/10 text-brand dark:border-support/35 dark:bg-support/15 dark:text-support",
  APPROVED: "border-line bg-surface-2 text-fg",
  APPROVED_WITH_EDITS: "border-line bg-surface-2 text-fg",
  REJECTED: "border-danger/35 bg-danger/10 text-fg",
  NOT_REQUIRED: "border-line bg-surface text-muted",
};

const reviewLabels: Record<string, string> = {
  PENDING_REVIEW: "Pending review",
  APPROVED: "Approved",
  APPROVED_WITH_EDITS: "Approved with edits",
  REJECTED: "Rejected",
  NOT_REQUIRED: "No review needed",
};

export function ReviewStatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.12em]",
        reviewStyles[status] ?? reviewStyles.NOT_REQUIRED,
        className,
      )}
    >
      {reviewLabels[status] ?? humanize(status)}
    </span>
  );
}

const gapStyles: Record<string, string> = {
  CRITICAL_GAP: "text-fg",
  PARTIAL_GAP: "text-brand",
  MISSING_CONTROL: "text-fg",
  COMPLIANT: "text-muted",
};

const gapLabels: Record<string, string> = {
  CRITICAL_GAP: "Critical gap",
  PARTIAL_GAP: "Partial gap",
  MISSING_CONTROL: "Missing control",
  COMPLIANT: "Compliant",
};

export function GapStatusLabel({ status }: { status: string }) {
  return (
    <span className={cn("font-mono text-[11px] uppercase tracking-[0.12em]", gapStyles[status])}>
      {gapLabels[status] ?? humanize(status)}
    </span>
  );
}

export function Meta({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted">{label}</dt>
      <dd className="mt-1 text-sm text-fg">{children}</dd>
    </div>
  );
}
