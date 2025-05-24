"use client";

import { useState } from "react";
import { HEResultData } from "@/apps/nextjs-app/types/types";
import { useHeuristicResults } from "@/apps/nextjs-app/hooks/use-heuristic-results";
import { filterNonViolatedResults } from "@/apps/nextjs-app/utils/heuristic-helpers";
import { HeuristicHeader } from "@/apps/nextjs-app/components/heuristic-header";
import { HeuristicAccordion } from "@/apps/nextjs-app/components/heuristic-accordion";

interface HeuristicResultsProps {
  groupedResultsByHeuristic: { [key: string]: HEResultData[] };
  violated: number;
  type: string;
  presignedUrls: string[];
  files: any[];
  studyId: string;
  userId: string;
  heuristicEvaluationId: string;
}

export default function HeuristicResults({
  groupedResultsByHeuristic,
  violated: initialViolated,
  type,
  presignedUrls,
  files,
  studyId,
  userId,
  heuristicEvaluationId,
}: HeuristicResultsProps) {
  const [hideNonViolated, setHideNonViolated] = useState(false);

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

  const filteredResults = filterNonViolatedResults(results, hideNonViolated);

  return (
    <>
      <HeuristicHeader
        type={type}
        violatedCount={violatedCount}
        hideNonViolated={hideNonViolated}
        onToggleNonViolated={setHideNonViolated}
      />

      <HeuristicAccordion
        groupedResults={filteredResults}
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
