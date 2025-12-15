"use client";

import Link from "next/link";
import { Button } from "@/apps/nextjs-app/components/ui/button";
import { Separator } from "@/apps/nextjs-app/components/ui/separator";
import {
  Card,
  CardContent,
  CardFooter,
} from "@/apps/nextjs-app/components/ui/card";
import { useIsMobile } from "@/apps/nextjs-app/hooks/use-mobile";

interface HeuristicExample {
  id: string;
  title?: string;
  example: string;
}

interface Heuristic {
  id: string;
  category?: string;
  label?: string;
  heuristic: string;
  description?: string;
  examples?: HeuristicExample[];
}

interface HeuristicFamily {
  id: string;
  name: string;
  key: string;
  description?: string;
  companyId?: string | null;
  heuristics: Heuristic[];
}

interface LibraryHeuristicsProps {
  userId: string;
  companyId: string | null;
  isCompanyAdmin: boolean;
  initialFamilies: HeuristicFamily[];
}

export function LibraryHeuristics({
  userId,
  companyId,
  isCompanyAdmin,
  initialFamilies,
}: LibraryHeuristicsProps) {
  const isMobile = useIsMobile();
  // Use initialFamilies from server-side fetch
  const families = initialFamilies || [];

  // Group families by global vs company-specific
  const globalFamilies = families.filter((f) => !f.companyId);
  const companyFamilies = families.filter((f) => f.companyId);

  return (
    <div>
      {/* Seer Heuristics Section */}
      <div className="space-y-4">
        <div className="mb-4">
          <h2 className="text-2xl font-semibold">Heuristics</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Industry-standard heuristic families available to all users.
          </p>
        </div>
        {globalFamilies.length > 0 ? (
          <div className="grid auto-rows-auto grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {globalFamilies.map((family) => (
              <HeuristicFamilyCard key={family.id} family={family} />
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground py-4 text-sm">
            No Seer heuristics available.
          </p>
        )}
      </div>

      {/* Custom Heuristics Section - Only show if user is part of a company */}
      {companyId && (
        <>
          <Separator className="my-4" />

          <div className="space-y-4">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-semibold">Company Heuristics</h2>
                <p className="text-muted-foreground mt-1 text-sm">
                  Custom heuristics added for your company
                </p>
              </div>
              {isCompanyAdmin && !isMobile && (
                <Button variant="outline" asChild>
                  <Link href="/library/heuristics/new">Add Heuristics</Link>
                </Button>
              )}
            </div>
            {companyFamilies.length > 0 ? (
              <div className="grid auto-rows-auto grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {companyFamilies.map((family) => (
                  <HeuristicFamilyCard key={family.id} family={family} />
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground py-4 text-sm text-zinc-500">
                No company heuristics.{" "}
                {isCompanyAdmin &&
                  "Add your first heuristic set to get started."}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function HeuristicFamilyCard({ family }: { family: HeuristicFamily }) {
  return (
    <Card className="w-full gap-3 overflow-hidden pb-6">
      <CardContent>
        <div className="flex flex-col gap-2">
          <div>
            <small className="text-sm leading-none font-bold text-zinc-500 uppercase">
              {family.heuristics?.length || 0} heuristics
            </small>
            <h3 className="scroll-m-20 text-xl font-semibold tracking-tight">
              {family.name}
            </h3>
            {family.description && (
              <p className="text-muted-foreground mt-2 text-sm">
                {family.description}
              </p>
            )}
          </div>
        </div>
      </CardContent>
      <CardFooter className="pt-0">
        <Button variant="outline" asChild>
          <Link href={`/library/heuristics/${family.id}`}>View</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
