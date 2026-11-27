export default function AppLoading() {
  return (
    <div aria-busy="true" aria-live="polite" className="space-y-5">
      <div className="h-3 w-32 rounded-full bg-line/60" />
      <div className="h-9 w-2/3 max-w-[420px] rounded-xl bg-surface-2" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="h-28 rounded-2xl border border-line bg-surface" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="h-80 rounded-2xl border border-line bg-surface lg:col-span-2" />
        <div className="h-80 rounded-2xl border border-line bg-surface" />
      </div>
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
        Loading workspace data
      </p>
    </div>
  );
}
