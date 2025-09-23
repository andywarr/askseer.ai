"use client";

import { useState } from "react";
import { CognitiveWalkthroughResults } from "@/apps/nextjs-app/components/cognitive-walkthrough-results";
import { CognitiveWalkthroughHeader } from "@/apps/nextjs-app/components/cognitive-walkthrough-header";

interface CognitiveWalkthroughClientProps {
  initialSteps: any[];
  presignedUrls: string[];
  totalSteps: number;
  studyId: string;
  userId: string;
  onCreateRecommendation?: (issueId: string, content: string) => Promise<void>;
  onDeleteRecommendation?: (issueId: string, recommendationId: string) => void;
  onCreateIssue?: (
    stepId: string,
    issueType: string,
    content: string,
  ) => Promise<void>;
  canManage?: boolean;
}

export function CognitiveWalkthroughClient({
  initialSteps,
  presignedUrls,
  totalSteps,
  studyId,
  userId,
  onCreateRecommendation,
  onDeleteRecommendation,
  onCreateIssue,
  canManage = true,
}: CognitiveWalkthroughClientProps) {
  const [hideNonIssue, setHideNonIssue] = useState(false);

  // Calculate issue count
  const issueCount = initialSteps
    .slice(1)
    .reduce((count: number, step: any) => {
      return count + (step.expected === false ? 1 : 0);
    }, 0);

  return (
    <>
      <CognitiveWalkthroughHeader
        issueCount={issueCount}
        hideNonIssue={hideNonIssue}
        onToggleNonIssue={setHideNonIssue}
      />
      <CognitiveWalkthroughResults
        initialSteps={initialSteps}
        presignedUrls={presignedUrls}
        totalSteps={totalSteps}
        studyId={studyId}
        userId={userId}
        hideNonIssue={hideNonIssue}
        onCreateRecommendation={onCreateRecommendation}
        onDeleteRecommendation={onDeleteRecommendation}
        onCreateIssue={onCreateIssue}
        canManage={canManage}
      />
    </>
  );
}
