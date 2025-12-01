import { useState, useCallback } from "react";
import { HEResultData } from "@/apps/nextjs-app/types/types";
import { getHeuristicEvaluation } from "@/apps/nextjs-app/lib/data";

export function useHeuristicResults(
  initialResults: { [key: string]: HEResultData[] },
  initialViolated: number,
  studyId: string,
  userId: string,
) {
  const [results, setResults] = useState(initialResults);
  const [violatedCount, setViolatedCount] = useState(initialViolated);

  const refreshResults = useCallback(async () => {
    const study = await getHeuristicEvaluation(studyId, userId);
    if (!study || !study.heuristicEvaluation) {
      throw new Error("Failed to fetch updated data");
    }

    const groupedResults = study.heuristicEvaluation.results.reduce(
      (acc: { [key: string]: any[] }, result: any) => {
        if (!acc[result.heuristicId]) {
          acc[result.heuristicId] = [];
        }
        acc[result.heuristicId].push(result);
        return acc;
      },
      {},
    );

    // Add entries for heuristics from the family that have no results yet
    const familyHeuristics =
      (study.heuristicEvaluation as any).heuristicFamily?.heuristics || [];
    for (const heuristic of familyHeuristics) {
      if (!groupedResults[heuristic.id]) {
        groupedResults[heuristic.id] = [
          {
            id: `placeholder-${heuristic.id}`,
            heuristicId: heuristic.id,
            heuristicEvaluationId: study.heuristicEvaluation.id,
            violated: false,
            reason: "",
            severity: null,
            rating: null,
            source: "PLACEHOLDER",
            recommendations: [],
            heuristic: heuristic,
            step: undefined,
            fileId: undefined,
          } as any,
        ];
      }
    }

    // Sort by step and recommendations
    Object.keys(groupedResults).forEach((key) => {
      groupedResults[key].sort((a: any, b: any) => {
        if (a.step === undefined && b.step === undefined) return 0;
        if (a.step === undefined) return 1;
        if (b.step === undefined) return -1;
        return a.step - b.step;
      });

      groupedResults[key].forEach((result: HEResultData) => {
        if (result.recommendations && Array.isArray(result.recommendations)) {
          result.recommendations.sort((a: any, b: any) =>
            a.id.localeCompare(b.id),
          );
        }
      });
    });

    setResults(groupedResults);
  }, [studyId, userId]);

  const deleteIssue = useCallback(
    (heuristicKey: string, issueId: string) => {
      const currentHeuristicIssues = results[heuristicKey] || [];
      const itemToDelete = currentHeuristicIssues.find(
        (item) => item.id === issueId,
      );

      if (!itemToDelete) return;

      const wasViolated = itemToDelete.violated;
      const hasOtherViolatedIssues = currentHeuristicIssues.some(
        (item) => item.id !== issueId && item.violated,
      );

      setResults((prevResults) => {
        const updatedResults = { ...prevResults };
        const filteredIssues = updatedResults[heuristicKey].filter(
          (item) => item.id !== issueId,
        );

        if (filteredIssues.length === 0) {
          // Keep a placeholder entry so the heuristic still shows up
          const heuristicInfo = itemToDelete.heuristic;
          updatedResults[heuristicKey] = [
            {
              id: `placeholder-${heuristicKey}`,
              heuristicId: heuristicKey,
              heuristicEvaluationId: itemToDelete.heuristicEvaluationId,
              violated: false,
              reason: "",
              severity: null,
              rating: null,
              source: "PLACEHOLDER",
              recommendations: [],
              heuristic: heuristicInfo,
              step: undefined,
              fileId: undefined,
            } as any,
          ];
        } else {
          updatedResults[heuristicKey] = filteredIssues;
        }

        return updatedResults;
      });

      if (wasViolated && !hasOtherViolatedIssues) {
        setViolatedCount((prev) => Math.max(0, prev - 1));
      }
    },
    [results],
  );

  const deleteRecommendation = useCallback(
    (heuristicKey: string, issueId: string, recommendationId: string) => {
      setResults((prevResults) => {
        const updatedResults = { ...prevResults };
        const issueIndex = updatedResults[heuristicKey].findIndex(
          (item) => item.id === issueId,
        );
        if (issueIndex !== -1) {
          updatedResults[heuristicKey][issueIndex] = {
            ...updatedResults[heuristicKey][issueIndex],
            recommendations: updatedResults[heuristicKey][
              issueIndex
            ].recommendations.filter((rec) => rec.id !== recommendationId),
          };
        }
        return updatedResults;
      });
    },
    [],
  );

  return {
    results,
    violatedCount,
    setViolatedCount,
    refreshResults,
    deleteIssue,
    deleteRecommendation,
    setResults,
  };
}
