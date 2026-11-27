export default function Loading() {
  return (
    <main
      aria-busy="true"
      aria-live="polite"
      className="relative flex min-h-dvh w-full items-center justify-center overflow-hidden bg-canvas px-5 sm:px-8"
    >
      <div aria-hidden="true" className="pp-backdrop-grid" />

      {/* Top indeterminate sweep */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-0 z-50 h-[2px] overflow-hidden bg-line/40"
      >
        <div className="pp-indeterminate-bar h-full w-1/3 bg-brand dark:bg-support" />
      </div>

      <div className="w-full max-w-[680px] space-y-6">
        <div className="inline-flex items-center gap-2.5 rounded-full border border-line bg-surface px-3.5 py-1.5 pp-card-shadow">
          <span
            className="relative flex size-2 shrink-0 items-center justify-center"
            aria-hidden="true"
          >
            <span className="pp-pulse-ring absolute inline-flex size-2 rounded-full bg-brand dark:bg-support" />
            <span className="relative inline-flex size-1.5 rounded-full bg-brand dark:bg-support" />
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-fg">
            PolicyPulse · Loading workspace
          </span>
        </div>

        <div className="pp-card-shadow overflow-hidden rounded-2xl border border-line bg-surface p-5 sm:p-6">
          <div className="flex items-center justify-between gap-4 border-b border-line pb-4">
            <div className="pp-skeleton h-3 w-36 rounded-full" />
            <div className="pp-skeleton h-5 w-20 rounded-full" />
          </div>

          <div className="mt-5 space-y-3">
            <div className="pp-skeleton h-7 w-4/5 rounded-lg" />
            <div className="pp-skeleton h-4 w-3/5 rounded-md" />
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-line bg-surface-2/50 p-3.5">
              <div className="pp-skeleton h-2.5 w-24 rounded-full" />
              <div className="pp-skeleton mt-2.5 h-4 w-4/5 rounded-md" />
            </div>
            <div className="rounded-xl border border-line bg-surface-2/50 p-3.5">
              <div className="pp-skeleton h-2.5 w-24 rounded-full" />
              <div className="pp-skeleton mt-2.5 h-4 w-3/4 rounded-md" />
            </div>
          </div>

          <div className="mt-5 h-1 w-full overflow-hidden rounded-full bg-surface-2">
            <div className="pp-indeterminate-bar h-full w-1/3 rounded-full bg-brand/80 dark:bg-support/85" />
          </div>
        </div>

        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
          Verifying tenant session · Preparing regulatory register
        </p>
      </div>
    </main>
  );
}
