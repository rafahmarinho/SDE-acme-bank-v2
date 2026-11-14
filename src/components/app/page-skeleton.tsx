import { Skeleton } from "@/components/ui/feedback";

/** Loading state shown while a screen's server data is fetched (route-level loading.tsx). */
export function PageSkeleton({ tiles = 3, rows = 6 }: { tiles?: number; rows?: number }) {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading...</span>
      <Skeleton className="h-8 w-56" />
      <Skeleton className="mt-2 h-4 w-80 max-w-full" />
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: tiles }, (_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
      </div>
      <div className="mt-6 rounded-xl border bg-card p-5">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-4 py-3">
            <Skeleton className="size-9 rounded-full" />
            <div className="flex-1"><Skeleton className="h-4 w-1/2" /><Skeleton className="mt-2 h-3 w-1/4" /></div>
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}
