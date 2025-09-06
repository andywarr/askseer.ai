"use client";

import { HEResultData } from "@/apps/nextjs-app/types/types";
import { useHeuristicResults } from "@/apps/nextjs-app/hooks/use-heuristic-results";
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
  const {
    results,
    violatedCount,
    setViolatedCount,
    refreshResults,
    deleteIssue,
    deleteRecommendation,
  } = useHeuristicResults(groupedResultsByHeuristic, initialViolated, studyId, userId);

  return (
    <>
      <HeuristicHeader violatedCount={violatedCount} />

      <HeuristicAccordion
        groupedResults={results}
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