"use client";

import { useState, useEffect } from "react";
import { HEResultData } from "@/apps/nextjs-app/types/types";
import { useHeuristicResults } from "@/apps/nextjs-app/hooks/use-heuristic-results";
import { filterNonViolatedResults } from "@/apps/nextjs-app/utils/heuristic-helpers";
import { HeuristicHeader } from "@/apps/nextjs-app/components/heuristic-header";
import { HeuristicAccordion } from "@/apps/nextjs-app/components/heuristic-accordion";

interface HeuristicResultsProps {
  groupedResultsByHeuristic: { [key: string]: HEResultData[] };
  violated: number;
  presignedUrls: string[];
  files: any[];
  studyId: string;
  userId: string;
  heuristicEvaluationId: string;
}

export default function HeuristicResults({
  groupedResultsByHeuristic,
  violated: initialViolated,
  presignedUrls,
  files,
  studyId,
  userId,
  heuristicEvaluationId,
}: HeuristicResultsProps) {
  const [hideNonViolated, setHideNonViolated] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

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
  } = useHeuristicResults(groupedResultsByHeuristic, initialViolated, studyId, userId);

  const displayedResults =
    hideNonViolated && !isPrinting
      ? filterNonViolatedResults(results, hideNonViolated)
      : results;

  return (
    <>
      <HeuristicHeader
        violatedCount={violatedCount}
        hideNonViolated={hideNonViolated}
        onToggleNonViolated={setHideNonViolated}
      />

      <HeuristicAccordion
        groupedResults={displayedResults}
        presignedUrls={presignedUrls}
        files={files}
        studyId={studyId}
        userId={userId}
        heuristicEvaluationId={heuristicEvaluationId}
        onDeleteIssue={deleteIssue}
        onDeleteRecommendation={deleteRecommendation}
        onRefreshResults={refreshResults}
        onUpdateViolatedCount={setViolatedCount}
      />
    </>
  );
}