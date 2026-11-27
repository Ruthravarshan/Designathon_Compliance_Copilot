import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { Severity } from "@/lib/compliance/types";
import { humanize } from "@/lib/format";

const severityStyles: Record<Severity, string> = {
  CRITICAL: "border-danger/30 bg-danger/10 text-danger",
  HIGH: "border-brand/25 bg-brand/10 text-brand",
  MEDIUM: "border-fg/15 bg-surface-2 text-fg",
  LOW: "border-line bg-surface text-muted",
};

export function SeverityBadge({ severity, className }: { severity: Severity; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.16em]",
        severityStyles[severity],
        className,
      )}
    >
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {severity}
    </span>
  );
}

const reviewStyles: Record<string, string> = {
  PENDING_REVIEW: "border-brand/25 bg-brand/10 text-brand",
  APPROVED: "border-fg/15 bg-surface-2 text-fg",
  APPROVED_WITH_EDITS: "border-fg/15 bg-surface-2 text-fg",
  REJECTED: "border-danger/30 bg-danger/10 text-danger",
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
        "inline-flex items-center rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.16em]",
        reviewStyles[status] ?? reviewStyles.NOT_REQUIRED,
        className,
      )}
    >
      {reviewLabels[status] ?? humanize(status)}
    </span>
  );
}

const gapStyles: Record<string, string> = {
  CRITICAL_GAP: "text-danger",
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
    <span className={cn("font-mono text-[11px] uppercase tracking-[0.14em]", gapStyles[status])}>
      {gapLabels[status] ?? humanize(status)}
    </span>
  );
}

export function Meta({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">{label}</dt>
      <dd className="mt-1 text-sm text-fg">{children}</dd>
    </div>
  );
}
