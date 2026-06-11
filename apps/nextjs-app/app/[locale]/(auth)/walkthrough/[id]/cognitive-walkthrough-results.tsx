"use client";

import { useCallback } from "react";
import { CognitiveWalkthroughStep } from "@/apps/nextjs-app/app/[locale]/(auth)/walkthrough/[id]/cognitive-walkthrough-step";
import { useCognitiveWalkthroughResults } from "@/apps/nextjs-app/hooks/use-cognitive-walkthrough-results";
import type { ActionResult } from "@/apps/nextjs-app/lib/actions/shared";

interface CognitiveWalkthroughResultsProps {
  initialSteps: any[];
  presignedUrls: string[];
  totalSteps: number;
  studyId: string;
  userId: string;
  hideNonIssue?: boolean;
  onCreateRecommendation?: (
    issueId: string,
    content: string,
  ) => Promise<ActionResult>;
  onDeleteRecommendation?: (issueId: string, recommendationId: string) => void;
  onCreateIssue?: (
    stepId: string,
    issueType: string,
    content: string,
  ) => Promise<ActionResult>;
  canManage?: boolean;
  studyLocale?: string;
}

export function CognitiveWalkthroughResults({
  initialSteps,
  presignedUrls,
  totalSteps,
  studyId,
  userId,
  hideNonIssue = false,
  onCreateRecommendation,
  onDeleteRecommendation,
  onCreateIssue,
  canManage = true,
  studyLocale,
}: CognitiveWalkthroughResultsProps) {
  const { steps, refreshResults, deleteIssue, deleteRecommendation } =
    useCognitiveWalkthroughResults(initialSteps, studyId, userId);

  const handleDeleteIssue = useCallback(
    (issueId: string) => {
      if (!canManage) return;
      deleteIssue(issueId);
    },
    [canManage, deleteIssue],
  );

  const handleDeleteRecommendation = useCallback(
    (issueId: string, recommendationId: string) => {
      if (!canManage) return;
      deleteRecommendation(issueId, recommendationId);
      onDeleteRecommendation?.(issueId, recommendationId);
    },
    [canManage, deleteRecommendation, onDeleteRecommendation],
  );

  const handleCreateIssue = useCallback(
    (step: any) => {
      if (!canManage || !onCreateIssue) {
        return async (): Promise<ActionResult> => ({
          success: false,
          error: "Cannot manage",
        });
      }
      return async (
        issueType: string,
        content: string,
      ): Promise<ActionResult> => {
        return onCreateIssue(step.id, issueType, content);
      };
    },
    [canManage, onCreateIssue],
  );

  // Filter steps based on hideNonIssue toggle
  const filteredSteps = hideNonIssue
    ? steps.filter((step: any) => step.expected === false)
    : steps;

  return (
    <div className="mb-4 flex flex-col">
      {filteredSteps.map((step: any, index: number) => (
        <CognitiveWalkthroughStep
          key={step.id || index}
          step={step.step}
          totalSteps={totalSteps}
          expected={step.expected}
          results={step.results}
          issues={step.issues}
          imageUrl={presignedUrls[steps.indexOf(step)]}
          onDeleteIssue={handleDeleteIssue}
          onCreateIssue={handleCreateIssue(step)}
          onCreateRecommendation={onCreateRecommendation}
          onDeleteRecommendation={handleDeleteRecommendation}
          refreshResults={refreshResults}
          canManage={canManage}
          studyLocale={studyLocale}
        />
      ))}
    </div>
  );
}
