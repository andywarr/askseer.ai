import { Skeleton } from "@/apps/nextjs-app/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/apps/nextjs-app/components/ui/card";

export default function Loading() {
  return (
    <section>
      <div className="mb-6">
        <h1 className="scroll-m-20 text-4xl font-extrabold tracking-tight md:text-5xl">
          Teams
        </h1>
        <p className="text-muted-foreground mt-2">
          Browse and join teams in your company
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Card key={i} className="flex flex-col">
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <Skeleton className="h-6 w-3/5" />
                <Skeleton className="h-4 w-16" />
              </div>
              <Skeleton className="mt-2 h-4 w-full" />
            </CardHeader>
            <CardContent className="flex-1" />
            <CardFooter className="min-h-[52px]">
              <Skeleton className="h-6 w-20" />
            </CardFooter>
          </Card>
        ))}
      </div>
    </section>
  );
}
