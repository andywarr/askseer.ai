import { Skeleton } from "@/apps/nextjs-app/components/ui/skeleton";

export function CognitiveWalkthroughResultsSkeleton() {
  return (
    <div className="space-y-4">
      {/* Header skeleton */}
      <div className="flex flex-row items-baseline justify-between">
        <Skeleton className="h-8 w-24" />
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-6 w-48" />
        </div>
      </div>

      {/* Step skeletons */}
      {[1, 2, 3].map((i) => (
        <div key={i} className="w-full">
          <div className="flex w-full items-center justify-between">
            <Skeleton className="h-7 w-32" />
            <Skeleton className="h-4 w-4" />
          </div>
          <div className="mt-2 flex gap-4">
            <Skeleton className="h-48 w-1/2" />
            <div className="flex w-1/2 flex-col gap-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </div>
          <Skeleton className="mt-4 h-px w-full" />
        </div>
      ))}
    </div>
  );
}
