import { Skeleton } from "@/apps/nextjs-app/components/ui/skeleton";

export function HeuristicResultsSkeleton() {
  return (
    <div className="space-y-4">
      {/* Header skeleton */}
      <div className="flex flex-row items-baseline justify-between">
        <Skeleton className="h-8 w-24" />
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-16" />
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-6 w-32" />
        </div>
      </div>

      {/* Accordion items skeleton */}
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-64" />
            <div className="flex items-center gap-4">
              <Skeleton className="h-6 w-16" />
              <Skeleton className="h-4 w-4" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
