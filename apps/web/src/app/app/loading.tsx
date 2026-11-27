import { CardGridSkeleton, PageHeaderSkeleton, TableSkeleton } from "@/components/ui/states";

export default function AppLoading() {
  return (
    <div aria-busy="true" aria-live="polite" className="space-y-6">
      <PageHeaderSkeleton />
      <CardGridSkeleton count={4} />
      <TableSkeleton rows={5} />
    </div>
  );
}
