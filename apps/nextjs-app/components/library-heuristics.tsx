"use client";

import Link from "next/link";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/apps/nextjs-app/components/ui/accordion";
import { Button } from "@/apps/nextjs-app/components/ui/button";
import { Badge } from "@/apps/nextjs-app/components/ui/badge";
import { Separator } from "@/apps/nextjs-app/components/ui/separator";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/apps/nextjs-app/components/ui/card";
import { Plus } from "lucide-react";

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
  // Use initialFamilies from server-side fetch
  const families = initialFamilies || [];

  // Group families by global vs company-specific
  const globalFamilies = families.filter((f) => !f.companyId);
  const companyFamilies = families.filter((f) => f.companyId);

  return (
    <div>
      {/* Seer Heuristics Section */}
      <div className="space-y-4">
        <div>
          <h2 className="text-2xl font-semibold">Heuristics</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Industry-standard heuristic families available to all users.
          </p>
        </div>
        {globalFamilies.length > 0 ? (
          <HeuristicFamilyAccordion families={globalFamilies} />
        ) : (
          <p className="text-muted-foreground py-4 text-sm">
            No Seer heuristics available.
          </p>
        )}
      </div>

      {/* Custom Heuristics Section */}
      <Separator className="my-4" />

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold">Company Heuristics</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Custom heuristics added for your company
            </p>
          </div>
          {isCompanyAdmin && companyId && (
            <Button variant="outline" asChild>
              <Link href="/library/heuristics/new">Add Heuristics</Link>
            </Button>
          )}
        </div>
        {companyFamilies.length > 0 ? (
          <HeuristicFamilyAccordion families={companyFamilies} />
        ) : (
          <p className="text-muted-foreground py-4 text-sm text-zinc-500">
            No company heuristics.{" "}
            {isCompanyAdmin &&
              companyId &&
              "Add your first heuristic set to get started."}
          </p>
        )}
      </div>
    </div>
  );
}

function HeuristicFamilyAccordion({
  families,
}: {
  families: HeuristicFamily[];
}) {
  return (
    <Accordion type="multiple" className="w-full">
      {families.map((family) => (
        <AccordionItem key={family.id} value={family.id}>
          <AccordionTrigger className="hover:no-underline">
            <div className="flex w-full items-center justify-between gap-4">
              <div className="text-left">
                <span className="text-base font-semibold">{family.name}</span>
                {family.description && (
                  <p className="text-muted-foreground mt-1 text-sm">
                    {family.description}
                  </p>
                )}
              </div>
              <Badge variant="outline" className="mr-4">
                {family.heuristics?.length || 0} heuristics
              </Badge>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            {family.heuristics && family.heuristics.length > 0 ? (
              <div className="grid auto-rows-auto grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {family.heuristics.map((heuristic) => (
                  <Card key={heuristic.id} className="break-inside-avoid">
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

                      {heuristic.examples && heuristic.examples.length > 0 && (
                        <div className="space-y-2 pt-2">
                          <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                            Examples:
                          </p>
                          <ul className="space-y-1.5">
                            {heuristic.examples.map((example) => (
                              <li
                                key={example.id}
                                className="border-l-2 border-zinc-200 pl-3 text-xs text-zinc-600 dark:border-zinc-700 dark:text-zinc-400"
                              >
                                {example.title && (
                                  <span className="font-medium">
                                    {example.title}:{" "}
                                  </span>
                                )}
                                {example.example}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground py-4 text-sm">
                No heuristics in this family yet.
              </p>
            )}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
