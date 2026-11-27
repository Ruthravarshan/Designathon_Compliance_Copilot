"use client";

import { ArrowClockwise } from "@phosphor-icons/react";

export default function AppError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-[640px] py-16">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-brand">Workbench error</p>
      <h1 className="mt-4 text-3xl font-medium tracking-[-0.03em]">That view could not load.</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        The failure was logged. Retry the view. If it repeats, check that the database is running
        and the workspace is seeded.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-7 inline-flex h-11 items-center gap-2 rounded-full bg-brand px-5 text-sm font-medium text-brand-ink hover:bg-brand-hover"
      >
        <ArrowClockwise size={16} weight="bold" aria-hidden="true" />
        Retry
      </button>
    </div>
  );
}
