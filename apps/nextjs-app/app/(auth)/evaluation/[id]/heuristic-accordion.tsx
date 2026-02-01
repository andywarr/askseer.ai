import { useRef, useState, useCallback, memo } from "react";
import { useRouter } from "next/navigation";
import { HEResultData } from "@/apps/nextjs-app/types/types";
import { useIsMobile } from "@/apps/nextjs-app/hooks/use-mobile";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/apps/nextjs-app/components/ui/accordion";
import { Button } from "@/apps/nextjs-app/components/ui/button";
import { Badge } from "@/apps/nextjs-app/components/ui/badge";
import { Separator } from "@/apps/nextjs-app/components/ui/separator";
import { IssueItem } from "./issue-item";
import { AddIssueDialog } from "./add-issue-dialog";
import {
  getDefaultOpenAccordionValues,
  findFileIdForStep,
  checkIfFirstViolationForHeuristic,
} from "@/apps/nextjs-app/utils/heuristic-helpers";
import { handleCreateHEIssue } from "@/apps/nextjs-app/lib/actions/evaluation-actions";
import { toast } from "sonner";

interface HeuristicAccordionProps {
  groupedResults: { [key: string]: HEResultData[] };
  presignedUrls: string[];
  files: Array<{ id: string; key?: string }>;
  studyId: string;
  userId: string;
  heuristicEvaluationId: string;
  onDeleteIssue?: (heuristicKey: string, issueId: string) => void;
  onDeleteRecommendation?: (
    heuristicKey: string,
    issueId: string,
    recommendationId: string,
  ) => void;
  onRefreshResults: () => Promise<void>;
  onUpdateViolatedCount: (updater: (prev: number) => number) => void;
  canManage?: boolean;
}

function HeuristicAccordionComponent({
  groupedResults,
  presignedUrls,
  files,
  heuristicEvaluationId,
  onDeleteIssue,
  onDeleteRecommendation,
  onRefreshResults,
  onUpdateViolatedCount,
  canManage = true,
}: HeuristicAccordionProps) {
  const router = useRouter();
  const [addDialogOpen, setAddDialogOpen] = useState<{
    [key: string]: boolean;
  }>({});
  const [selectedHeuristicKey, setSelectedHeuristicKey] = useState<
    string | null
  >(null);
  const addIssueButtonRefs = useRef<{
    [key: string]: HTMLButtonElement | null;
  }>({});

  const isMobile = useIsMobile();

  const handleAddIssue = useCallback(
    async (stepIndex: number, description: string, severity: number) => {
      if (!canManage) return;
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

        const result = await handleCreateHEIssue(
          heuristicEvaluationId,
          heuristicId,
          stepIndex,
          fileId,
          description,
          severity,
        );

        if (!result.success) {
          toast.error(result.error || "Failed to add issue. Please try again.");
          return;
        }

        await onRefreshResults();
        router.refresh(); // Refresh server component to update study metadata

        if (isFirstViolation) {
          onUpdateViolatedCount((prev) => prev + 1);
        }

        setAddDialogOpen((prev) => ({ ...prev, [selectedHeuristicKey]: false }));
        setSelectedHeuristicKey(null);

        toast.success("Successfully added issue.");
      } catch (error) {
        toast.error("Failed to add issue. Please try again.");
      }
    },
    [
      canManage,
      selectedHeuristicKey,
      groupedResults,
      files,
      heuristicEvaluationId,
      onRefreshResults,
      router,
      onUpdateViolatedCount,
    ],
  );

  return (
    <>
      <Accordion
        type="multiple"
        className="w-full"
        defaultValue={getDefaultOpenAccordionValues(groupedResults)}
      >
        {Object.entries(groupedResults)
          .sort(([, itemsA], [, itemsB]) => {
            const nameA = itemsA[0]?.heuristic?.heuristic || "N/A";
            const nameB = itemsB[0]?.heuristic?.heuristic || "N/A";
            return nameA.localeCompare(nameB);
          })
          .map(([key, items]) => {
            const isViolated = items.some((item) => item.violated);
            const violatedItems = items.filter((item) => item.violated);

            // Calculate stats for this heuristic
            const uniqueSteps = new Set(violatedItems.map((item) => item.step));
            const stepsCount = uniqueSteps.size;
            const issuesCount = violatedItems.length;
            const recommendationsCount = violatedItems.reduce(
              (total, item) => total + (item.recommendations?.length || 0),
              0,
            );

            return (
              <AccordionItem key={key} value={key}>
                <AccordionTrigger sticky className="hover:no-underline">
                  <div className="flex w-full items-center justify-between gap-4">
                    <div
                      className={`font-medium ${isViolated ? "text-red-500" : ""}`}
                    >
                      <span className="font-semibold">
                        {items[0].heuristic?.label ||
                          items[0].heuristic?.heuristic ||
                          "N/A"}
                        {items[0].heuristic?.label && ": "}
                      </span>
                      {items[0].heuristic?.label && (
                        <span>{items[0].heuristic?.heuristic}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      {items[0].heuristic?.label &&
                        items[0].heuristic?.category && (
                          <Badge
                            variant="outline"
                            className={`${isViolated ? "text-red-500" : ""}`}
                          >
                            {items[0].heuristic.category}
                          </Badge>
                        )}
                      {isViolated && !isMobile && (
                        <div className="flex gap-4 text-sm text-zinc-500">
                          <div className="flex flex-col">
                            <span className="font-semibold">{stepsCount}</span>
                            <span className="text-xs">
                              {stepsCount === 1 ? "screen" : "screens"}
                            </span>
                          </div>
                          <div className="flex flex-col">
                            <span className="font-semibold">{issuesCount}</span>
                            <span className="text-xs">
                              {issuesCount === 1 ? "issue" : "issues"}
                            </span>
                          </div>
                          <div className="flex flex-col">
                            <span className="font-semibold">
                              {recommendationsCount}
                            </span>
                            <span className="text-xs">
                              {recommendationsCount === 1
                                ? "recommendation"
                                : "recommendations"}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  {!isViolated ? (
                    <p className="py-4 text-zinc-500">No issues found.</p>
                  ) : (
                    <div className="space-y-6 py-4">
                      {violatedItems.map((item, index) => {
                        const isFirstForStep =
                          violatedItems.findIndex(
                            (i) => i.step === item.step,
                          ) === index;

                        return (
                          <div key={item.id}>
                            {index > 0 && (
                              <Separator className="mx-auto my-6 w-1/2" />
                            )}
                            <IssueItem
                              item={item}
                              heuristicKey={key}
                              isFirstForStep={isFirstForStep}
                              presignedUrls={presignedUrls}
                              onDeleteIssue={onDeleteIssue ?? (() => {})}
                              onDeleteRecommendation={
                                onDeleteRecommendation ?? (() => {})
                              }
                              refreshResults={onRefreshResults}
                              canManage={canManage}
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {canManage && !isMobile && (
                    <>
                      <Separator className="mx-auto my-4 print:hidden" />
                      <div className="justify-left flex print:hidden">
                        <AddIssueDialog
                          open={addDialogOpen[key] || false}
                          onOpenChange={(open) => {
                            setAddDialogOpen((prev) => ({
                              ...prev,
                              [key]: open,
                            }));
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
                              className="mt-4 print:hidden"
                              variant="outline"
                              onClick={() => setSelectedHeuristicKey(key)}
                            >
                              Add issue
                            </Button>
                          }
                        />
                      </div>
                    </>
                  )}
                </AccordionContent>
              </AccordionItem>
            );
          })}
      </Accordion>
    </>
  );
}

HeuristicAccordionComponent.displayName = "HeuristicAccordion";
export const HeuristicAccordion = memo(HeuristicAccordionComponent);
