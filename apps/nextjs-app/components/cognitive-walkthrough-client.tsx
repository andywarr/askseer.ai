"use client";

import { useState } from "react";
import { CognitiveWalkthroughResults } from "@/apps/nextjs-app/components/cognitive-walkthrough-results";
import { CognitiveWalkthroughHeader } from "@/apps/nextjs-app/components/cognitive-walkthrough-header";
import { AddToFigmaAlert } from "@/apps/nextjs-app/components/add-to-figma-alert";
import { AddToFigmaDialog } from "@/apps/nextjs-app/components/add-to-figma-dialog";
import {
  hasFigmaFiles,
  extractCognitiveWalkthroughIssues,
  type IssueComment,
} from "@/apps/nextjs-app/lib/figma-comments";

interface CognitiveWalkthroughClientProps {
  initialSteps: any[];
  presignedUrls: string[];
  totalSteps: number;
  studyId: string;
  userId: string;
  files?: any[];
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
  files = [],
  onCreateRecommendation,
  onDeleteRecommendation,
  onCreateIssue,
  canManage = true,
}: CognitiveWalkthroughClientProps) {
  const [hideNonIssue, setHideNonIssue] = useState(false);
  const [figmaDialogOpen, setFigmaDialogOpen] = useState(false);
  const [figmaIssues, setFigmaIssues] = useState<IssueComment[]>([]);

  // Calculate issue count
  const issueCount = initialSteps
    .slice(1)
    .reduce((count: number, step: any) => {
      return count + (step.expected === false ? 1 : 0);
    }, 0);

  // Check if study has Figma files
  const studyHasFigmaFiles = hasFigmaFiles(files);

  const handleAddToFigma = () => {
    const issues = extractCognitiveWalkthroughIssues(initialSteps, files);
    setFigmaIssues(issues);
    setFigmaDialogOpen(true);
  };

  return (
    <>
      <CognitiveWalkthroughHeader
        issueCount={issueCount}
        hideNonIssue={hideNonIssue}
        onToggleNonIssue={setHideNonIssue}
      />
      <AddToFigmaAlert
        hasFigmaFiles={studyHasFigmaFiles}
        onAddToFigma={handleAddToFigma}
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
      <AddToFigmaDialog
        open={figmaDialogOpen}
        onOpenChange={setFigmaDialogOpen}
        issues={figmaIssues}
        isCognitiveWalkthrough={true}
      />
    </>
  );
}
