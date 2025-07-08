"use client";

import { CognitiveWalkthroughStep } from "@/apps/nextjs-app/components/cognitive-walkthrough-step";
import { useCognitiveWalkthroughResults } from "@/apps/nextjs-app/hooks/use-cognitive-walkthrough-results";

interface CognitiveWalkthroughResultsProps {
  initialSteps: any[];
  presignedUrls: string[];
  totalSteps: number;
  studyId: string;
  userId: string;
  onCreateRecommendation?: (issueId: string, content: string) => Promise<void>;
  onDeleteRecommendation?: (issueId: string, recommendationId: string) => void;
}

export function CognitiveWalkthroughResults({
  initialSteps,
  presignedUrls,
  totalSteps,
  studyId,
  userId,
  onCreateRecommendation,
  onDeleteRecommendation,
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

  return (
    <div className="mb-4 flex flex-col">
      {steps.map((step: any, index: number) => (
        <CognitiveWalkthroughStep
          key={index}
          step={step.step}
          totalSteps={totalSteps}
          expected={step.expected}
          results={step.results}
          issues={step.issues}
          imageUrl={presignedUrls[index]}
          onDeleteIssue={handleDeleteIssue}
          onCreateRecommendation={onCreateRecommendation}
          onDeleteRecommendation={handleDeleteRecommendation}
          refreshResults={refreshResults}
        />
      ))}
    </div>
  );
}
