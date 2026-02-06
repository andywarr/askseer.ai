"use client";

import { useState, useCallback, memo } from "react";
import { useRouter } from "next/navigation";
import type { ActionResult } from "@/apps/nextjs-app/lib/actions/shared";

// Next imports
import Image from "next/image";

// Ui component imports
import { InfoCard } from "@/apps/nextjs-app/components/heuristics/info-card";
import { Button } from "@/apps/nextjs-app/components/ui/button";
import { Separator } from "@/apps/nextjs-app/components/ui/separator";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/apps/nextjs-app/components/ui/collapsible";
import { useIsMobile } from "@/apps/nextjs-app/hooks/use-mobile";
import { ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";

interface CognitiveWalkthroughStepProps {
  step: number;
  totalSteps: number;
  expected: boolean;
  results: any;
  issues: any;
  imageUrl: string;
  onDeleteIssue?: (issueId: string) => void;
  onCreateRecommendation?: (
    issueId: string,
    content: string,
  ) => Promise<ActionResult>;
  onDeleteRecommendation?: (issueId: string, recommendationId: string) => void;
  onCreateIssue?: (issueType: string, content: string) => Promise<ActionResult>;
  refreshResults?: () => Promise<void>;
  canManage?: boolean;
}

const ISSUE_TYPES = [
  { type: "DISCOVERABILITY", displayName: "Discoverability issues" },
  { type: "LEARNABILITY", displayName: "Learnability issues" },
  { type: "USABILITY", displayName: "Usability issues" },
] as const;

function CognitiveWalkthroughStepComponent({
  step,
  totalSteps,
  expected,
  results,
  issues,
  imageUrl,
  onDeleteIssue,
  onCreateRecommendation,
  onDeleteRecommendation,
  onCreateIssue,
  refreshResults,
  canManage = true,
}: CognitiveWalkthroughStepProps) {
  const router = useRouter();
  const [editingRecommendationFor, setEditingRecommendationFor] = useState<
    string | null
  >(null);
  const [newRecommendation, setNewRecommendation] = useState("");
  const [creatingIssueFor, setCreatingIssueFor] = useState<string | null>(null);
  const [newIssue, setNewIssue] = useState("");
  const [isOpen, setIsOpen] = useState(true);
  const isMobile = useIsMobile();

  const handleSaveRecommendation = useCallback(
    async (content: string) => {
      if (!canManage) return;
      if (!editingRecommendationFor) return;

      setNewRecommendation("");
      setEditingRecommendationFor(null);
      if (!content.trim()) return;

      const result = await onCreateRecommendation?.(
        editingRecommendationFor,
        content,
      );
      if (result?.success) {
        router.refresh();
        toast.success("Successfully added recommendation.");
        await refreshResults?.();
      } else {
        toast.error(
          result?.error || "Failed to add recommendation. Please try again.",
        );
      }
    },
    [
      canManage,
      editingRecommendationFor,
      onCreateRecommendation,
      router,
      refreshResults,
    ],
  );

  const handleDeleteRecommendationWithRefresh = useCallback(
    async (issueId: string, recommendationId: string) => {
      if (!canManage) return;
      try {
        onDeleteRecommendation?.(issueId, recommendationId);
        await refreshResults?.();
      } catch (error) {
        toast.error("Failed to delete recommendation. Please try again.");
      }
    },
    [canManage, onDeleteRecommendation, refreshResults],
  );

  const handleSaveIssue = useCallback(
    async (issueType: string, content: string) => {
      if (!canManage) return;
      setNewIssue("");
      setCreatingIssueFor(null);
      if (!content.trim()) return;

      const result = await onCreateIssue?.(issueType, content);
      if (result?.success) {
        router.refresh();
        toast.success("Successfully added issue.");
        await refreshResults?.();
      } else {
        toast.error(result?.error || "Failed to add issue. Please try again.");
      }
    },
    [canManage, onCreateIssue, router, refreshResults],
  );
  return (
    <div className="w-full">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger className="flex w-full items-center justify-between">
          <h4
            className={`scroll-m-20 text-xl font-semibold tracking-tight ${step > 1 && !expected ? "text-red-500" : ""}`}
          >
            Step {step} of {totalSteps}
          </h4>
          {isOpen ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </CollapsibleTrigger>
        <CollapsibleContent className="gap-2 pt-2">
          <div className="mb-4">
            <Image
              src={imageUrl}
              alt={`Step ${step} in the user flow`}
              width={500}
              height={500}
              priority={step <= 1}
              unoptimized={true}
              className="mx-auto mb-4 h-auto max-h-96 w-full border object-contain p-1 shadow-sm md:float-left md:mr-4 md:w-1/2"
            />
            {step > 1 && (
              <div className="mt-4 mb-4 md:mt-0">
                <p className="text-xs leading-7 tracking-tight text-zinc-500">
                  Is the user interface at this step what was expected?
                </p>
                <p className="text-sm leading-7 tracking-tight">
                  {expected ? "Yes" : "No"}
                </p>
              </div>
            )}
            {step < totalSteps &&
              results.slice(0, 3).map((result: any, i: number) => (
                <div
                  key={result.question?.questionNumber ?? i}
                  className="mb-4"
                >
                  <p className="text-xs leading-7 tracking-tight text-zinc-500">
                    {result.question.question}
                  </p>
                  <p className="text-sm leading-7 tracking-tight">
                    {result.answer}
                  </p>
                </div>
              ))}
            <div className="clear-both"></div>
          </div>

          {/* Issue types with their display names */}
          {ISSUE_TYPES.map(({ type, displayName }, index) => {
            const filteredIssues = issues.filter(
              (issue: any) => issue.issueType === type,
            );

            return (
              <div key={type}>
                <div>
                  <h5 className="scroll-m-20 text-lg font-bold tracking-tight">
                    {displayName}
                  </h5>
                </div>
                <div>
                  {filteredIssues.map((issue: any) => (
                    <div key={issue.id} className="mb-6">
                      <InfoCard
                        id={issue.id}
                        studyType="cognitiveWalkthrough"
                        type="issue"
                        content={issue.issue}
                        source={issue.source}
                        severity={issue.severity}
                        rating={
                          issue.rating === "UP"
                            ? "up"
                            : issue.rating === "DOWN"
                              ? "down"
                              : null
                        }
                        onDelete={() => onDeleteIssue?.(issue.id)}
                        canManage={canManage}
                      />
                      <div>
                        <div className="mb-2 scroll-m-20 text-base font-semibold tracking-tight">
                          Recommendations
                        </div>
                        <div className="relative grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                          {issue.recommendations &&
                            issue.recommendations.map((rec: any) => (
                              <InfoCard
                                key={rec.id}
                                id={rec.id}
                                studyType="cognitiveWalkthrough"
                                type="recommendation"
                                content={rec.recommendation}
                                source={rec.source}
                                rating={
                                  rec.rating === "UP"
                                    ? "up"
                                    : rec.rating === "DOWN"
                                      ? "down"
                                      : null
                                }
                                onDelete={() =>
                                  handleDeleteRecommendationWithRefresh(
                                    issue.id,
                                    rec.id,
                                  )
                                }
                                canManage={canManage}
                              />
                            ))}
                          {editingRecommendationFor === issue.id ? (
                            <InfoCard
                              id={`new-${issue.id}`}
                              studyType="cognitiveWalkthrough"
                              type="recommendation"
                              content={newRecommendation}
                              source="HUMAN"
                              isEditing={true}
                              onSave={handleSaveRecommendation}
                              onCancel={() => {
                                setEditingRecommendationFor(null);
                                setNewRecommendation("");
                              }}
                              onEdit={async () => {
                                try {
                                  await refreshResults?.();
                                } catch (error) {
                                  toast.error(
                                    "Failed to update recommendation. Please try again.",
                                  );
                                }
                              }}
                              canManage={canManage}
                            />
                          ) : (
                            !isMobile &&
                            canManage && (
                              <div className="flex h-full items-end justify-start">
                                <Button
                                  variant="link"
                                  onClick={() =>
                                    setEditingRecommendationFor(issue.id)
                                  }
                                >
                                  Add recommendation
                                </Button>
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {creatingIssueFor === type ? (
                    <>
                      <Separator className="my-4" />
                      <div className="mb-6">
                        <InfoCard
                          id={`new-issue-${type}`}
                          studyType="cognitiveWalkthrough"
                          type="issue"
                          content={newIssue}
                          source="HUMAN"
                          isEditing={true}
                          onSave={(content) => handleSaveIssue(type, content)}
                          onCancel={() => {
                            setCreatingIssueFor(null);
                            setNewIssue("");
                          }}
                          onEdit={async () => {
                            try {
                              await refreshResults?.();
                            } catch (error) {
                              toast.error(
                                "Failed to update issue. Please try again.",
                              );
                            }
                          }}
                          canManage={canManage}
                        />
                      </div>
                    </>
                  ) : (
                    filteredIssues.length === 0 && (
                      <p className="text-sm text-zinc-500">
                        No {displayName.toLowerCase()} found.
                      </p>
                    )
                  )}
                </div>
                {creatingIssueFor !== type && <Separator className="my-4" />}
                {creatingIssueFor !== type && !isMobile && canManage && (
                  <div
                    className={`flex justify-start ${index < ISSUE_TYPES.length - 1 ? "mb-4" : ""}`}
                  >
                    <Button
                      variant="outline"
                      onClick={() => setCreatingIssueFor(type)}
                      disabled={creatingIssueFor === type}
                    >
                      Add{" "}
                      {displayName.toLowerCase().replace(" issues", " issue")}
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </CollapsibleContent>
      </Collapsible>
      <Separator className="my-4" />
    </div>
  );
}

CognitiveWalkthroughStepComponent.displayName = "CognitiveWalkthroughStep";
export const CognitiveWalkthroughStep = memo(CognitiveWalkthroughStepComponent);
