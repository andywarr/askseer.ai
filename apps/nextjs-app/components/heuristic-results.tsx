"use client";

import { useState, useEffect, useMemo } from "react";
import { HEResultData } from "@/apps/nextjs-app/types/types";
import { useHeuristicResults } from "@/apps/nextjs-app/hooks/use-heuristic-results";
import { filterNonViolatedResults } from "@/apps/nextjs-app/utils/heuristic-helpers";
import { HeuristicHeader } from "@/apps/nextjs-app/components/heuristic-header";
import { HeuristicAccordion } from "@/apps/nextjs-app/components/heuristic-accordion";
import { AddToFigmaAlert } from "@/apps/nextjs-app/components/add-to-figma-alert";
import { AddToFigmaDialog } from "@/apps/nextjs-app/components/add-to-figma-dialog";
import {
  hasFigmaFiles,
  extractHeuristicEvaluationIssues,
  type IssueComment,
} from "@/apps/nextjs-app/lib/figma-comments";

interface HeuristicResultsProps {
  groupedResultsByHeuristic: { [key: string]: HEResultData[] };
  violated: number;
  presignedUrls: string[];
  files: any[];
  studyId: string;
  userId: string;
  heuristicEvaluationId: string;
  canManage?: boolean;
}

export default function HeuristicResults({
  groupedResultsByHeuristic,
  violated: initialViolated,
  presignedUrls,
  files,
  studyId,
  userId,
  heuristicEvaluationId,
  canManage = true,
}: HeuristicResultsProps) {
  const [hideNonViolated, setHideNonViolated] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [figmaDialogOpen, setFigmaDialogOpen] = useState(false);
  const [figmaIssues, setFigmaIssues] = useState<IssueComment[]>([]);

  useEffect(() => {
    const before = () => setIsPrinting(true);
    const after = () => setIsPrinting(false);
    window.addEventListener("beforeprint", before);
    window.addEventListener("afterprint", after);
    return () => {
      window.removeEventListener("beforeprint", before);
      window.removeEventListener("afterprint", after);
    };
  }, []);

  const {
    results,
    violatedCount,
    setViolatedCount,
    refreshResults,
    deleteIssue,
    deleteRecommendation,
  } = useHeuristicResults(
    groupedResultsByHeuristic,
    initialViolated,
    studyId,
    userId,
  );

  const displayedResults =
    hideNonViolated && !isPrinting
      ? filterNonViolatedResults(results, hideNonViolated)
      : results;

  const totalIssues = useMemo(() => {
    return Object.values(results).reduce((total, items) => {
      return total + items.filter((item) => item.violated).length;
    }, 0);
  }, [results]);

  const handleDeleteIssue = (heuristicKey: string, issueId: string) => {
    if (!canManage) return;
    deleteIssue(heuristicKey, issueId);
  };

  const handleDeleteRecommendation = (
    heuristicKey: string,
    issueId: string,
    recommendationId: string,
  ) => {
    if (!canManage) return;
    deleteRecommendation(heuristicKey, issueId, recommendationId);
  };

  // Check if study has Figma files
  const studyHasFigmaFiles = hasFigmaFiles(files);

  const handleAddToFigma = () => {
    // Flatten results to extract issues
    const allResults = Object.values(results).flat();
    const issues = extractHeuristicEvaluationIssues(allResults, files);
    setFigmaIssues(issues);
    setFigmaDialogOpen(true);
  };

  return (
    <>
      <HeuristicHeader
        violatedCount={violatedCount}
        totalIssues={totalIssues}
        hideNonViolated={hideNonViolated}
        onToggleNonViolated={setHideNonViolated}
      />

      <AddToFigmaAlert
        hasFigmaFiles={studyHasFigmaFiles}
        onAddToFigma={handleAddToFigma}
      />

      <HeuristicAccordion
        groupedResults={displayedResults}
        presignedUrls={presignedUrls}
        files={files}
        studyId={studyId}
        userId={userId}
        heuristicEvaluationId={heuristicEvaluationId}
        onDeleteIssue={canManage ? handleDeleteIssue : undefined}
        onDeleteRecommendation={
          canManage ? handleDeleteRecommendation : undefined
        }
        onRefreshResults={refreshResults}
        onUpdateViolatedCount={setViolatedCount}
        canManage={canManage}
      />

      <AddToFigmaDialog
        open={figmaDialogOpen}
        onOpenChange={setFigmaDialogOpen}
        issues={figmaIssues}
        isCognitiveWalkthrough={false}
      />
    </>
  );
}
