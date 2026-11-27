import { ArrowDown, CheckCircle, LockKey } from "@phosphor-icons/react/dist/ssr";
import { SeverityBadge } from "@/components/severity-badge";

export function HeroReceiptSnapshot() {
  return (
    <div className="pp-card-shadow overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-surface-2/70 px-4 py-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="relative flex size-2 shrink-0 items-center justify-center"
            aria-hidden="true"
          >
            <span className="pp-pulse-ring absolute inline-flex size-2 rounded-full bg-brand dark:bg-support" />
            <span className="relative inline-flex size-1.5 rounded-full bg-brand dark:bg-support" />
          </span>
          <span className="truncate font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
            IRDAI/IT/CYBER/2023 · Sec 4.2
          </span>
        </div>
        <SeverityBadge severity="CRITICAL" />
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        <blockquote className="border-l-2 border-brand pl-3.5 text-xs leading-relaxed text-fg sm:text-[13px] dark:border-support">
          “Critical and cyber security incidents shall be reported to the IRDAI within six hours of
          detection, along with the root cause and containment actions.”
        </blockquote>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <div className="rounded-xl border border-line bg-surface-2/65 px-3.5 py-2.5">
            <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted">
              Mapped policy
            </p>
            <p className="mt-1 truncate text-xs font-semibold text-fg">
              POL-SEC-02 · Incident response
            </p>
            <p className="mt-0.5 font-mono text-[11px] font-semibold text-brand dark:text-support">
              SLA delta: 72h → 6h
            </p>
          </div>

          <div className="rounded-xl border border-line bg-surface-2/65 px-3.5 py-2.5">
            <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted">
              Verification score
            </p>
            <p className="mt-1 font-mono text-xs font-semibold text-fg tabular-nums">
              88% deterministic confidence
            </p>
            <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-muted">
              <CheckCircle
                size={12}
                weight="bold"
                aria-hidden="true"
                className="shrink-0 text-brand dark:text-support"
              />
              Exact quote verified
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
          <span className="inline-flex items-center gap-1.5 text-xs text-muted">
            <LockKey size={13} weight="bold" aria-hidden="true" />
            Human sign-off required
          </span>
          <a
            href="#workbench"
            className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-line bg-surface-2 px-3 py-1 text-xs font-medium text-fg transition-colors hover:border-brand/40 hover:text-brand dark:hover:text-support"
          >
            Try redline preview
            <ArrowDown size={12} weight="bold" aria-hidden="true" />
          </a>
        </div>
      </div>
    </div>
  );
}
