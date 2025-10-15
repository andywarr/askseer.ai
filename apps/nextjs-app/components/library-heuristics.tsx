"use client";

import { useState } from "react";
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
import { CreateHeuristicFamilyDialog } from "@/apps/nextjs-app/components/create-heuristic-family-dialog";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";

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
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  // Use initialFamilies from server-side fetch
  const families = initialFamilies || [];

  const handleCreateFamily = async (
    name: string,
    key: string,
    description?: string,
  ) => {
    if (!companyId) {
      toast.error("You must be part of a company to create heuristic families");
      return;
    }

    try {
      const response = await fetch("/api/heuristic-families", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          key,
          description,
          companyId,
          userId,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success("Heuristic family created successfully");
        setCreateDialogOpen(false);
        // Reload the page to show the new family
        window.location.reload();
      } else {
        toast.error(data.message || "Failed to create heuristic family");
      }
    } catch (error) {
      console.error("Error creating heuristic family:", error);
      toast.error("Failed to create heuristic family");
    }
  };

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

      {/* Custom Heuristics Section - Hidden for now */}
      {/* <Separator className="my-4" />

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold">Custom Heuristics</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Custom heuristic families created for your company
            </p>
          </div>
          {isCompanyAdmin && companyId && (
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Heuristic Set
            </Button>
          )}
        </div>
        {companyFamilies.length > 0 ? (
          <HeuristicFamilyAccordion families={companyFamilies} />
        ) : (
          <p className="text-muted-foreground py-4 text-sm text-zinc-500">
            No custom heuristics yet.{" "}
            {isCompanyAdmin &&
              companyId &&
              "Create your first heuristic set to get started."}
          </p>
        )}
      </div>

      <CreateHeuristicFamilyDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSubmit={handleCreateFamily}
      /> */}
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
