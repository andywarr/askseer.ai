"use client";

import { CognitiveWalkthroughStep } from "@/apps/nextjs-app/components/cognitive-walkthrough-step";
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
}: CognitiveWalkthroughResultsProps) {
  const { steps, refreshResults, deleteIssue, deleteRecommendation } =
    useCognitiveWalkthroughResults(initialSteps, studyId, userId);

  const handleDeleteIssue = (issueId: string) => {
    deleteIssue(issueId);
  };

  const handleDeleteRecommendation = (
    issueId: string,
    recommendationId: string,
  ) => {
    deleteRecommendation(issueId, recommendationId);
    onDeleteRecommendation?.(issueId, recommendationId);
  };

  const handleCreateIssue = (step: any) => {
    return async (issueType: string, content: string) => {
      if (onCreateIssue) {
        await onCreateIssue(step.id, issueType, content);
      }
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
        />
      ))}
    </div>
  );
}
