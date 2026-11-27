"use client";

import type { ComponentType, ReactNode } from "react";
import { ArrowClockwise, FolderOpen, LockSimple, WarningCircle } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { Button, LinkButton } from "./button";
import { Card } from "./card";
import { CopyButton } from "./navigation-controls";

export function EmptyState({
  title,
  description,
  icon: Icon = FolderOpen,
  action,
  className,
}: {
  title: string;
  description?: string;
  icon?: ComponentType<{ size?: number; weight?: "bold" | "regular"; className?: string }>;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("px-6 py-12 text-center", className)}>
      <span className="mx-auto inline-flex size-11 items-center justify-center rounded-full border border-line bg-surface-2 text-muted">
        <Icon size={20} weight="bold" aria-hidden="true" />
      </span>
      <h2 className="mt-4 text-base font-semibold text-fg">{title}</h2>
      {description ? (
        <p className="mx-auto mt-1.5 max-w-[46ch] text-sm leading-relaxed text-muted">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-6 flex flex-wrap justify-center gap-3">{action}</div> : null}
    </Card>
  );
}

export function ErrorState({
  title = "Something did not load.",
  message,
  requestId,
  onRetry,
  className,
}: {
  title?: string;
  message: string;
  requestId?: string | null;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <Card role="alert" className={cn("border-danger/35 p-6", className)}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-danger/10 text-danger">
            <WarningCircle size={18} weight="fill" aria-hidden="true" />
          </span>
          <div className="space-y-1">
            <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-fg">Error</p>
            <h2 className="text-base font-semibold text-fg">{title}</h2>
            <p className="max-w-[58ch] text-sm leading-relaxed text-fg">{message}</p>
            {requestId ? (
              <div className="flex flex-wrap items-center gap-2 pt-2">
                <span className="font-mono text-xs text-muted">Request ID: {requestId}</span>
                <CopyButton value={requestId} label="Copy ID" />
              </div>
            ) : null}
          </div>
        </div>
        {onRetry ? (
          <Button variant="secondary" size="sm" onClick={onRetry} className="shrink-0">
            <ArrowClockwise size={14} weight="bold" aria-hidden="true" />
            Retry
          </Button>
        ) : null}
      </div>
    </Card>
  );
}

export function UnauthorizedState({
  title = "You do not have access to this workspace area.",
  body,
  reason,
  signedInAs,
  nextHref = "/app",
  nextLabel = "Back to overview",
}: {
  title?: string;
  body?: string;
  reason?: string;
  signedInAs?: string;
  nextHref?: string;
  nextLabel?: string;
}) {
  const description =
    reason ??
    body ??
    "Your current workspace permissions do not include this area. Ask your workspace owner if you need access.";

  return (
    <div className="mx-auto max-w-[640px] py-12">
      <Card className="p-7 sm:p-8">
        <span className="inline-flex size-10 items-center justify-center rounded-full bg-brand/10 text-brand">
          <LockSimple size={20} weight="bold" aria-hidden="true" />
        </span>
        <p className="mt-5 font-mono text-[11px] uppercase tracking-[0.12em] text-muted">403</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-[-0.02em] text-fg">{title}</h1>
        <p className="mt-2.5 text-sm leading-relaxed text-muted">{description}</p>
        {signedInAs ? (
          <p className="mt-4 font-mono text-xs text-muted">Signed in as {signedInAs}</p>
        ) : null}
        <div className="mt-6 flex flex-wrap gap-3">
          <LinkButton href={nextHref}>{nextLabel}</LinkButton>
        </div>
      </Card>
    </div>
  );
}

export function PageHeaderSkeleton() {
  return (
    <div aria-hidden="true" className="space-y-3 border-b border-line pb-5">
      <div className="pp-skeleton h-3 w-32 rounded-full" />
      <div className="pp-skeleton h-8 w-64 max-w-full rounded-xl" />
      <div className="pp-skeleton h-4 w-96 max-w-full rounded-lg" />
    </div>
  );
}

export function CardGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div aria-busy="true" aria-live="polite" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="h-28 rounded-2xl border border-line bg-surface p-5">
          <div className="pp-skeleton h-3 w-24 rounded-full" />
          <div className="pp-skeleton mt-4 h-7 w-16 rounded-lg" />
          <div className="pp-skeleton mt-3 h-3 w-36 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className="overflow-hidden rounded-2xl border border-line bg-surface"
    >
      <div className="border-b border-line bg-surface-2 px-4 py-3">
        <div className="pp-skeleton h-3 w-48 rounded-full" />
      </div>
      <div className="divide-y divide-line">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="flex items-center justify-between gap-4 px-4 py-3.5">
            <div className="pp-skeleton h-4 w-1/3 rounded-lg" />
            <div className="pp-skeleton h-4 w-1/4 rounded-lg" />
            <div className="pp-skeleton h-5 w-20 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function DetailRailSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite" className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <div className="space-y-4 rounded-2xl border border-line bg-surface p-5">
        <div className="pp-skeleton h-4 w-28 rounded-full" />
        <div className="pp-skeleton h-20 w-full rounded-xl" />
        <div className="pp-skeleton h-24 w-full rounded-xl" />
      </div>
      <div className="h-[460px] rounded-2xl border border-line bg-surface p-5">
        <div className="pp-skeleton h-9 w-44 rounded-full" />
        <div className="pp-skeleton mt-4 h-[360px] w-full rounded-xl" />
      </div>
    </div>
  );
}
