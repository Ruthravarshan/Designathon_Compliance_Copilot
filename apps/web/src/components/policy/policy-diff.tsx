import Link from "next/link";
import { ArrowRight, MinusCircle, PlusCircle } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";

export function PolicyDiff({
  beforeText,
  afterText,
  beforeLabel = "Before (current policy)",
  afterLabel = "After (proposed change)",
  className,
}: {
  beforeText: string;
  afterText: string;
  beforeLabel?: string;
  afterLabel?: string;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-4 lg:grid-cols-2", className)}>
      <div className="rounded-2xl border border-danger/30 bg-danger/5 p-4">
        <div className="flex items-center gap-2 border-b border-danger/20 pb-2.5">
          <MinusCircle size={15} weight="bold" aria-hidden="true" className="text-danger" />
          <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-fg">
            Removed · {beforeLabel}
          </span>
        </div>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-fg">{beforeText}</p>
      </div>

      <div className="rounded-2xl border border-brand/30 bg-brand/5 p-4">
        <div className="flex items-center gap-2 border-b border-brand/20 pb-2.5">
          <PlusCircle size={15} weight="bold" aria-hidden="true" className="text-brand" />
          <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-fg">
            Added · {afterLabel}
          </span>
        </div>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-fg">{afterText}</p>
      </div>
    </div>
  );
}

export interface PolicyChangeRowItem {
  id: string;
  policyTitle: string;
  policyCode: string;
  changeType: string;
  fromVersion: string;
  toVersion: string;
  effectiveAt?: string | null;
  status: string;
  departments?: readonly string[];
  isNewSinceLastVisit?: boolean;
}

export function PolicyChangeRow({ item }: { item: PolicyChangeRowItem }) {
  return (
    <Link
      href={`/app/policies/${item.id}`}
      className="group block transition-colors duration-150 hover:bg-surface-2/60"
    >
      <Card className="rounded-none border-x-0 border-t-0 shadow-none">
        <div className="flex flex-col justify-between gap-3 px-5 py-4 sm:flex-row sm:items-center">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted">
                {item.policyCode} · {item.fromVersion} → {item.toVersion}
              </span>
              {item.isNewSinceLastVisit ? (
                <span className="rounded-full bg-brand px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-brand-ink">
                  New
                </span>
              ) : null}
            </div>
            <p className="truncate text-sm font-semibold text-fg group-hover:text-brand">
              {item.policyTitle}
            </p>
            <p className="text-xs text-muted">
              {item.changeType}
              {item.departments && item.departments.length > 0
                ? ` · ${item.departments.join(", ")}`
                : ""}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <div className="text-left sm:text-right">
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
                Effective
              </p>
              <p className="font-mono text-xs text-fg tabular-nums">
                {formatDate(item.effectiveAt)}
              </p>
            </div>
            <StatusBadge status={item.status} />
            <ArrowRight
              size={15}
              weight="bold"
              aria-hidden="true"
              className="hidden text-muted transition-colors group-hover:text-brand sm:block"
            />
          </div>
        </div>
      </Card>
    </Link>
  );
}
