"use client";

import { CognitiveWalkthroughStep } from "@/apps/nextjs-app/app/(auth)/walkthrough/[id]/cognitive-walkthrough-step";
import { useCognitiveWalkthroughResults } from "@/apps/nextjs-app/hooks/use-cognitive-walkthrough-results";

interface CognitiveWalkthroughResultsProps {
  initialSteps: any[];
  presignedUrls: string[];
  totalSteps: number;
  studyId: string;
  userId: string;
  hideNonIssue?: boolean;
  onCreateRecommendation?: (issueId: string, content: string) => Promise<void>;
  onDeleteRecommendation?: (issueId: string, recommendationId: string) => void;
  onCreateIssue?: (
    stepId: string,
    issueType: string,
    content: string,
  ) => Promise<void>;
  canManage?: boolean;
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
}: CognitiveWalkthroughResultsProps) {
  const { steps, refreshResults, deleteIssue, deleteRecommendation } =
    useCognitiveWalkthroughResults(initialSteps, studyId, userId);

  const handleDeleteIssue = (issueId: string) => {
    if (!canManage) return;
    deleteIssue(issueId);
  };

  const handleDeleteRecommendation = (
    issueId: string,
    recommendationId: string,
  ) => {
    if (!canManage) return;
    deleteRecommendation(issueId, recommendationId);
    onDeleteRecommendation?.(issueId, recommendationId);
  };

  const handleCreateIssue = (step: any) => {
    if (!canManage || !onCreateIssue) {
      return async () => {};
    }
    return async (issueType: string, content: string) => {
      await onCreateIssue(step.id, issueType, content);
    };
  };

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
        />
      ))}
    </div>
  );
}
