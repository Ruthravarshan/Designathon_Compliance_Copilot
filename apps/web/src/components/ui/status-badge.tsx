import {
  CheckCircle,
  Clock,
  Eye,
  LockSimple,
  MinusCircle,
  Plug,
  Prohibit,
  Pulse,
  ShieldCheck,
  UserCircle,
  Warning,
  WarningCircle,
} from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/cn";
import { humanize } from "@/lib/format";

const STATUS_MAP: Record<
  string,
  { label: string; tone: string; icon: typeof CheckCircle; pulse?: boolean }
> = {
  READY: { label: "Ready", tone: "border-brand/25 bg-brand/10 text-brand", icon: CheckCircle },
  PUBLISHED: {
    label: "Published",
    tone: "border-brand/25 bg-brand/10 text-brand",
    icon: CheckCircle,
  },
  APPROVED: {
    label: "Approved",
    tone: "border-brand/25 bg-brand/10 text-brand",
    icon: CheckCircle,
  },
  APPROVED_WITH_EDITS: {
    label: "Approved with edits",
    tone: "border-brand/25 bg-brand/10 text-brand",
    icon: CheckCircle,
  },
  ACKNOWLEDGED: {
    label: "Acknowledged",
    tone: "border-brand/25 bg-brand/10 text-brand",
    icon: CheckCircle,
  },
  CONNECTED: { label: "Connected", tone: "border-brand/25 bg-brand/10 text-brand", icon: Plug },
  ACTIVE: { label: "Active", tone: "border-brand/25 bg-brand/10 text-brand", icon: CheckCircle },
  DONE: { label: "Done", tone: "border-brand/25 bg-brand/10 text-brand", icon: CheckCircle },

  PENDING_REVIEW: {
    label: "Pending review",
    tone: "border-line bg-surface-2 text-fg",
    icon: Clock,
  },
  DRAFT: { label: "Draft", tone: "border-line bg-surface-2 text-fg", icon: Clock },
  OPEN: { label: "Open", tone: "border-line bg-surface-2 text-fg", icon: Clock },
  INVITED: { label: "Invited", tone: "border-line bg-surface-2 text-fg", icon: Clock },
  QUEUED: { label: "Queued", tone: "border-line bg-surface-2 text-fg", icon: Clock },
  RUNNING: {
    label: "Running",
    tone: "border-brand/30 bg-brand/10 text-fg",
    icon: Pulse,
    pulse: true,
  },
  NEEDS_REVIEW: {
    label: "Needs review",
    tone: "border-danger/35 bg-danger/10 text-fg",
    icon: Warning,
  },
  OVERDUE: { label: "Overdue", tone: "border-danger/35 bg-danger/10 text-fg", icon: WarningCircle },
  REJECTED: { label: "Rejected", tone: "border-danger/35 bg-danger/10 text-fg", icon: Prohibit },
  FAILED: { label: "Failed", tone: "border-danger/35 bg-danger/10 text-fg", icon: WarningCircle },
  ERROR: { label: "Error", tone: "border-danger/35 bg-danger/10 text-fg", icon: WarningCircle },
  SUSPENDED: { label: "Suspended", tone: "border-danger/35 bg-danger/10 text-fg", icon: Prohibit },

  UNCONFIGURED: {
    label: "Not configured",
    tone: "border-line bg-surface text-muted",
    icon: MinusCircle,
  },
  SKIPPED: { label: "Skipped", tone: "border-line bg-surface text-muted", icon: MinusCircle },
  ARCHIVED: { label: "Archived", tone: "border-line bg-surface text-muted", icon: MinusCircle },
};

export function StatusBadge({
  status,
  labelOverride,
  className,
}: {
  status: string;
  labelOverride?: string;
  className?: string;
}) {
  const entry = STATUS_MAP[status] ?? {
    label: humanize(status),
    tone: "border-line bg-surface text-fg",
    icon: MinusCircle,
  };
  const Icon = entry.icon;
  const isErrorTone =
    status === "ERROR" ||
    status === "FAILED" ||
    status === "REJECTED" ||
    status === "OVERDUE" ||
    status === "NEEDS_REVIEW" ||
    status === "SUSPENDED";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.12em]",
        entry.tone,
        className,
      )}
    >
      <Icon
        size={12}
        weight="bold"
        aria-hidden="true"
        className={cn(isErrorTone ? "text-danger" : entry.pulse ? "text-accent" : "text-current")}
      />
      <span>{labelOverride ?? entry.label}</span>
    </span>
  );
}

export function RoleBadge({
  role,
  isGuest = false,
  className,
}: {
  role: string;
  isGuest?: boolean;
  className?: string;
}) {
  const Icon = isGuest ? Eye : role === "OWNER" || role === "ADMIN" ? ShieldCheck : UserCircle;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.12em] text-fg",
        className,
      )}
    >
      <Icon size={12} weight="bold" aria-hidden="true" className="text-brand dark:text-support" />
      <span>{humanize(role)}</span>
    </span>
  );
}

const SCOPE_LABELS: Record<string, string> = {
  all: "All departments",
  team: "Your team",
  own: "Assigned only",
  none: "No compliance access",
  readonly: "Read-only oversight",
  sample: "Sample scope",
};

export function ScopeBadge({
  scope,
  labelOverride,
  className,
}: {
  scope: string;
  labelOverride?: string;
  className?: string;
}) {
  const Icon = scope === "none" ? LockSimple : Eye;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.12em] text-muted",
        className,
      )}
    >
      <Icon size={12} weight="bold" aria-hidden="true" className="text-brand" />
      <span>{labelOverride ?? SCOPE_LABELS[scope] ?? humanize(scope)}</span>
    </span>
  );
}
