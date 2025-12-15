"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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

export function CognitiveWalkthroughStep(props: {
  step: number;
  totalSteps: number;
  expected: boolean;
  results: any;
  issues: any;
  imageUrl: string;
  onDeleteIssue?: (issueId: string) => void;
  onCreateRecommendation?: (issueId: string, content: string) => Promise<void>;
  onDeleteRecommendation?: (issueId: string, recommendationId: string) => void;
  onCreateIssue?: (issueType: string, content: string) => Promise<void>;
  refreshResults?: () => Promise<void>;
  canManage?: boolean;
}) {
  const router = useRouter();
  const [editingRecommendationFor, setEditingRecommendationFor] = useState<
    string | null
  >(null);
  const [newRecommendation, setNewRecommendation] = useState("");
  const [creatingIssueFor, setCreatingIssueFor] = useState<string | null>(null);
  const [newIssue, setNewIssue] = useState("");
  const [isOpen, setIsOpen] = useState(true);
  const isMobile = useIsMobile();
  const canManage = props.canManage ?? true;

  const handleSaveRecommendation = async (content: string) => {
    if (!canManage) return;
    if (!editingRecommendationFor) return;

    setNewRecommendation("");
    setEditingRecommendationFor(null);
    if (!content.trim()) return;

    try {
      await props.onCreateRecommendation?.(editingRecommendationFor, content);
      router.refresh(); // Refresh server component to update study metadata
      toast.success("Successfully added recommendation.");
      await props.refreshResults?.();
    } catch (error) {
      toast.error("Failed to add recommendation. Please try again.");
    }
  };

  const handleDeleteRecommendationWithRefresh = async (
    issueId: string,
    recommendationId: string,
  ) => {
    if (!canManage) return;
    try {
      props.onDeleteRecommendation?.(issueId, recommendationId);
      await props.refreshResults?.();
    } catch (error) {
      toast.error("Failed to delete recommendation. Please try again.");
    }
  };

  const handleSaveIssue = async (issueType: string, content: string) => {
    if (!canManage) return;
    setNewIssue("");
    setCreatingIssueFor(null);
    if (!content.trim()) return;

    try {
      await props.onCreateIssue?.(issueType, content);
      router.refresh(); // Refresh server component to update study metadata
      toast.success("Successfully added issue.");
      await props.refreshResults?.();
    } catch (error) {
      toast.error("Failed to add issue. Please try again.");
    }
  };
  return (
    <div className="w-full">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger className="flex w-full items-center justify-between">
          <h4
            className={`scroll-m-20 text-xl font-semibold tracking-tight ${props.step > 1 && !props.expected ? "text-red-500" : ""}`}
          >
            Step {props.step} of {props.totalSteps}
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
              src={props.imageUrl}
              alt={`Step ${props.step} in the user flow`}
              width={500}
              height={500}
              priority={true}
              unoptimized={true}
              className="mx-auto mb-4 h-auto max-h-96 w-full border object-contain p-1 shadow-sm md:float-left md:mr-4 md:w-1/2"
            />
            {props.step > 1 && (
              <div className="mt-4 mb-4 md:mt-0">
                <p className="text-xs leading-7 tracking-tight text-zinc-500">
                  Is the user interface at this step what was expected?
                </p>
                <p className="text-sm leading-7 tracking-tight">
                  {props.expected ? "Yes" : "No"}
                </p>
              </div>
            )}
            {props.step < props.totalSteps && (
              <div className="mb-4">
                <p className="text-xs leading-7 tracking-tight text-zinc-500">
                  {props.results[0].question.question}
                </p>
                <p className="text-sm leading-7 tracking-tight">
                  {props.results[0].answer}
                </p>
              </div>
            )}
            {props.step < props.totalSteps && (
              <div className="mb-4">
                <p className="text-xs leading-7 tracking-tight text-zinc-500">
                  {props.results[1].question.question}
                </p>
                <p className="text-sm leading-7 tracking-tight">
                  {props.results[1].answer}
                </p>
              </div>
            )}
            {props.step < props.totalSteps && (
              <div className="mb-4">
                <p className="text-xs leading-7 tracking-tight text-zinc-500">
                  {props.results[2].question.question}
                </p>
                <p className="text-sm leading-7 tracking-tight">
                  {props.results[2].answer}
                </p>
              </div>
            )}
            <div className="clear-both"></div>
          </div>

          {/* Issue types with their display names */}
          {[
            { type: "DISCOVERABILITY", displayName: "Discoverability issues" },
            { type: "LEARNABILITY", displayName: "Learnability issues" },
            { type: "USABILITY", displayName: "Usability issues" },
          ].map(({ type, displayName }, index, array) => {
            const filteredIssues = props.issues.filter(
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
                        onDelete={() => props.onDeleteIssue?.(issue.id)}
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
                                  await props.refreshResults?.();
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
                              await props.refreshResults?.();
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
                    className={`flex justify-start ${index < array.length - 1 ? "mb-4" : ""}`}
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
