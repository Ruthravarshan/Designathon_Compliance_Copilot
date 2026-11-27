import { CardGridSkeleton, PageHeaderSkeleton, TableSkeleton } from "@/components/ui/states";

export default function AppLoading() {
  return (
    <div aria-busy="true" aria-live="polite" className="space-y-6">
      <div className="flex items-center justify-between gap-4 rounded-xl border border-line bg-surface px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <span
            className="relative flex size-2 shrink-0 items-center justify-center"
            aria-hidden="true"
          >
            <span className="pp-pulse-ring absolute inline-flex size-2 rounded-full bg-brand dark:bg-support" />
            <span className="relative inline-flex size-1.5 rounded-full bg-brand dark:bg-support" />
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
            Syncing workspace records
          </span>
        </div>
        <div className="h-1 w-28 overflow-hidden rounded-full bg-surface-2 sm:w-40">
          <div className="pp-indeterminate-bar h-full w-1/3 rounded-full bg-brand dark:bg-support" />
        </div>
      </div>

      <PageHeaderSkeleton />
      <CardGridSkeleton count={4} />
      <TableSkeleton rows={5} />
    </div>
  );
}
