import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/apps/nextjs-app/lib/db/user";
import { getHeuristicFamily } from "@/apps/nextjs-app/lib/db/data";
import { Badge } from "@/apps/nextjs-app/components/ui/badge";
import { Button } from "@/apps/nextjs-app/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/apps/nextjs-app/components/ui/card";

interface Heuristic {
  id: string;
  category?: string;
  label?: string;
  heuristic: string;
  description?: string;
}

export default async function HeuristicFamilyPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { user } = await getCurrentUser();
  const params = await props.params;

  // Fetch the specific heuristic family
  const family = await getHeuristicFamily(params.id);

  if (!family) {
    redirect("/library");
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="scroll-m-20 text-4xl font-extrabold tracking-tight md:text-5xl">
          {family.name}
        </h1>
        {family.description && (
          <p className="text-muted-foreground mt-2 text-lg">
            {family.description}
          </p>
        )}
      </div>

      {/* Heuristics List */}
      <div>
        {family.heuristics && family.heuristics.length > 0 ? (
          <div className="grid auto-rows-auto grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {family.heuristics.map((heuristic: Heuristic) => (
              <Card key={heuristic.id} className="break-inside-avoid pb-6">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <CardTitle className="flex-1 text-base leading-tight">
                      {heuristic.label || heuristic.heuristic}
                    </CardTitle>
                    {heuristic.category && (
                      <Badge
                        variant="secondary"
                        className="flex-shrink-0 text-xs"
                      >
                        {heuristic.category}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {heuristic.label && (
                    <p className="text-sm text-zinc-700 dark:text-zinc-300">
                      {heuristic.heuristic}
                    </p>
                  )}

                  {heuristic.description && (
                    <CardDescription className="text-sm leading-relaxed">
                      {heuristic.description}
                    </CardDescription>
                  )}
                </CardContent>
                <CardFooter className="pt-0">
                  <Button variant="outline" asChild>
                    <Link
                      href={`/library/heuristics/${params.id}/${heuristic.id}`}
                    >
                      View
                    </Link>
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground py-4 text-sm">
            No heuristics in this family yet.
          </p>
        )}
      </div>
    </div>
  );
}
