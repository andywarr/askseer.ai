import { useState, useCallback } from "react";
import { ViolatedType } from "@prisma/client";
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

    // Sort by step and recommendations
    Object.keys(groupedResults).forEach((key) => {
      groupedResults[key].sort((a, b) => {
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

      const wasViolated = itemToDelete.violated === ViolatedType.YES;
      const hasOtherViolatedIssues = currentHeuristicIssues.some(
        (item) => item.id !== issueId && item.violated === ViolatedType.YES,
      );

      setResults((prevResults) => {
        const updatedResults = { ...prevResults };
        updatedResults[heuristicKey] = updatedResults[heuristicKey].filter(
          (item) => item.id !== issueId,
        );

        if (updatedResults[heuristicKey].length === 0) {
          delete updatedResults[heuristicKey];
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
