import { useRef, useState } from "react";
import { ViolatedType } from "@prisma/client";
import { HEResultData } from "@/apps/nextjs-app/types/types";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/apps/nextjs-app/components/ui/accordion";
import { Button } from "@/apps/nextjs-app/components/ui/button";
import { Separator } from "@/apps/nextjs-app/components/ui/separator";
import { IssueItem } from "@/apps/nextjs-app/components/issue-item";
import { AddIssueDialog } from "@/apps/nextjs-app/components/add-issue-dialog";
import {
  getDefaultOpenAccordionValues,
  findFileIdForStep,
} from "@/apps/nextjs-app/utils/heuristic-helpers";
import {
  handleCreateIssue,
  checkIfFirstViolationForHeuristic,
} from "@/apps/nextjs-app/lib/heuristic-actions";
import { toast } from "sonner";

interface HeuristicAccordionProps {
  groupedResults: { [key: string]: HEResultData[] };
  presignedUrls: string[];
  files: any[];
  studyId: string;
  userId: string;
  heuristicEvaluationId: string;
  onDeleteIssue: (heuristicKey: string, issueId: string) => void;
  onDeleteRecommendation: (
    heuristicKey: string,
    issueId: string,
    recommendationId: string,
  ) => void;
  onRefreshResults: () => Promise<void>;
  onUpdateViolatedCount: (updater: (prev: number) => number) => void;
}

export function HeuristicAccordion({
  groupedResults,
  presignedUrls,
  files,
  heuristicEvaluationId,
  onDeleteIssue,
  onDeleteRecommendation,
  onRefreshResults,
  onUpdateViolatedCount,
}: HeuristicAccordionProps) {
  const [addDialogOpen, setAddDialogOpen] = useState<{
    [key: string]: boolean;
  }>({});
  const [selectedHeuristicKey, setSelectedHeuristicKey] = useState<
    string | null
  >(null);
  const addIssueButtonRefs = useRef<{
    [key: string]: HTMLButtonElement | null;
  }>({});

  const handleAddIssue = async (stepIndex: number, description: string) => {
    if (!selectedHeuristicKey) return;

    try {
      const heuristicId = selectedHeuristicKey;
      const isFirstViolation = checkIfFirstViolationForHeuristic(
        groupedResults,
        selectedHeuristicKey,
      );

      const fileId = findFileIdForStep(
        groupedResults,
        selectedHeuristicKey,
        stepIndex,
        files,
      );
      if (!fileId) {
        throw new Error("No fileId found for selected step");
      }

      await handleCreateIssue(
        heuristicEvaluationId,
        heuristicId,
        stepIndex,
        fileId,
        description,
        onRefreshResults,
      );

      if (isFirstViolation) {
        onUpdateViolatedCount((prev) => prev + 1);
      }

      setAddDialogOpen((prev) => ({ ...prev, [selectedHeuristicKey]: false }));
      setSelectedHeuristicKey(null);

      toast.success("Successfully added issue.");
    } catch (error) {
      toast.error("Failed to add issue. Please try again.");
    }
  };

  return (
    <>
      <Accordion
        type="multiple"
        className="w-full"
        defaultValue={getDefaultOpenAccordionValues(groupedResults)}
      >
        {Object.entries(groupedResults).map(([key, items]) => {
          const isViolated = items.some(
            (item) => item.violated === ViolatedType.YES,
          );
          const violatedItems = items.filter(
            (item) => item.violated === ViolatedType.YES,
          );

          return (
            <AccordionItem key={key} value={key}>
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-4">
                  <span
                    className={`font-medium ${isViolated ? "text-red-500" : ""}`}
                  >
                    {items[0].heuristic?.heuristic || "N/A"}
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                {!isViolated ? (
                  <p className="py-4 text-zinc-500">No issues found.</p>
                ) : (
                  <div className="space-y-6 py-4">
                    {violatedItems.map((item, index) => {
                      const isFirstForStep =
                        violatedItems.findIndex((i) => i.step === item.step) ===
                        index;

                      return [
                        index > 0 && (
                          <Separator
                            className="mx-auto w-1/2"
                            key={`sep-${item.id}`}
                          />
                        ),
                        <IssueItem
                          key={item.id}
                          item={item}
                          heuristicKey={key}
                          isFirstForStep={isFirstForStep}
                          presignedUrls={presignedUrls}
                          onDeleteIssue={onDeleteIssue}
                          onDeleteRecommendation={onDeleteRecommendation}
                          refreshResults={onRefreshResults}
                        />,
                      ];
                    })}
                  </div>
                )}
                <Separator className="mx-auto w-1/2" />
                <div className="flex justify-center">
                  <AddIssueDialog
                    open={addDialogOpen[key] || false}
                    onOpenChange={(open) => {
                      setAddDialogOpen((prev) => ({ ...prev, [key]: open }));
                      if (!open) {
                        setTimeout(() => {
                          addIssueButtonRefs.current[key]?.focus();
                        }, 0);
                      }
                    }}
                    onSubmit={handleAddIssue}
                    presignedUrls={presignedUrls}
                    triggerButton={
                      <Button
                        ref={(el) => {
                          addIssueButtonRefs.current[key] = el;
                        }}
                        className="mt-4"
                        variant="outline"
                        onClick={() => setSelectedHeuristicKey(key)}
                      >
                        Add issue
                      </Button>
                    }
                  />
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </>
  );
}
