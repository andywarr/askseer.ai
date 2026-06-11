import { Skeleton } from "@/apps/nextjs-app/components/ui/skeleton";

export function StudiesLoadingSkeleton() {
  return (
    <div className="space-y-4">
      {/* Search bar + view toggle skeleton */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <Skeleton className="h-10 flex-1" />
        <Skeleton className="h-10 w-20" />
      </div>

      {/* Filter bar skeleton */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-20" />
      </div>

      {/* Grid cards skeleton */}
      <div
        className="grid gap-4"
        style={{
          gridTemplateColumns:
            "repeat(auto-fill, minmax(min(320px, 100%), 1fr))",
        }}
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-lg border">
            <Skeleton className="h-56 w-full" />
            <div className="space-y-3 p-4">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-6 w-3/4" />
              <div className="flex items-center justify-between pt-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-20" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
