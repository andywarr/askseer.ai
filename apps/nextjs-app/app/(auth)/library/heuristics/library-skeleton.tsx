import { Skeleton } from "@/apps/nextjs-app/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardFooter,
} from "@/apps/nextjs-app/components/ui/card";

export function LibrarySkeleton() {
  return (
    <div>
      {/* Header Skeleton */}
      <div className="mb-6">
        <Skeleton className="h-12 w-48" />
        <Skeleton className="mt-2 h-5 w-80" />
      </div>

      {/* Heuristics Section Skeleton */}
      <div className="space-y-4">
        <div className="mb-4">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="mt-1 h-4 w-64" />
        </div>
        <div className="grid auto-rows-auto grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="w-full gap-3 overflow-hidden pb-6">
              <CardContent>
                <div className="flex flex-col gap-2">
                  <div>
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="mt-2 h-6 w-48" />
                    <Skeleton className="mt-2 h-4 w-full" />
                  </div>
                </div>
              </CardContent>
              <CardFooter className="pt-0">
                <Skeleton className="h-9 w-16" />
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
