import type { ReactNode } from "react";
import { ArrowCounterClockwise } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/cn";
import { Button } from "./button";

export function PageHeader({
  title,
  subtitle,
  meta,
  action,
  className,
}: {
  title: string;
  subtitle?: string;
  meta?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex flex-col justify-between gap-4 border-b border-line pb-5 md:flex-row md:items-end",
        className,
      )}
    >
      <div className="min-w-0 space-y-1.5">
        {meta ? <div className="flex flex-wrap items-center gap-2">{meta}</div> : null}
        <h1 className="line-clamp-2 text-[28px] leading-[32px] font-semibold tracking-[-0.025em] text-fg sm:text-[32px] sm:leading-[36px]">
          {title}
        </h1>
        {subtitle ? (
          <p className="max-w-[65ch] text-sm leading-relaxed text-muted">{subtitle}</p>
        ) : null}
      </div>
      {action ? <div className="flex shrink-0 flex-wrap items-center gap-2.5">{action}</div> : null}
    </header>
  );
}

export function Toolbar({
  left,
  right,
  className,
}: {
  left?: ReactNode;
  right?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn("flex flex-col justify-between gap-3 sm:flex-row sm:items-center", className)}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-2.5">{left}</div>
      {right ? <div className="flex shrink-0 flex-wrap items-center gap-2.5">{right}</div> : null}
    </div>
  );
}

export function FilterBar({
  children,
  hasActiveFilters = false,
  onReset,
  className,
}: {
  children: ReactNode;
  hasActiveFilters?: boolean;
  onReset?: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-2xl border border-line bg-surface p-3.5 lg:flex-row lg:items-end lg:justify-between",
        className,
      )}
    >
      <div className="grid flex-1 gap-3 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-end">
        {children}
      </div>
      {hasActiveFilters && onReset ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={onReset}
          className="shrink-0 self-start lg:self-end"
        >
          <ArrowCounterClockwise size={14} weight="bold" aria-hidden="true" />
          Reset
        </Button>
      ) : null}
    </div>
  );
}
