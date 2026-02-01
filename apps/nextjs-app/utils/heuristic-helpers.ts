import { HEResultData } from "@/apps/nextjs-app/types/types";

export function filterNonViolatedResults(
  results: { [key: string]: HEResultData[] },
  hideNonViolated: boolean,
) {
  if (!hideNonViolated) return results;

  return Object.entries(results).reduce(
    (acc, [key, items]) => {
      const violatedItems = items.filter((item) => item.violated);
      if (violatedItems.length > 0) {
        acc[key] = violatedItems;
      }
      return acc;
    },
    {} as { [key: string]: HEResultData[] },
  );
}

export function getDefaultOpenAccordionValues(groupedResults: {
  [key: string]: HEResultData[];
}) {
  return Object.entries(groupedResults)
    .filter(([_, items]) => items.some((item) => item.violated))
    .map(([key]) => key);
}

export function findFileIdForStep(
  results: { [key: string]: HEResultData[] },
  heuristicKey: string,
  stepIndex: number,
  files: Array<{ id: string }>,
) {
  const currentItems = results[heuristicKey] || [];

  for (const item of currentItems) {
    if (item.step === stepIndex + 1 && item.fileId) {
      return item.fileId;
    }
  }

  return files[stepIndex]?.id;
}

/**
 * Checks if this would be the first violation for a heuristic.
 * Used to update the violated count when adding issues.
 */
export function checkIfFirstViolationForHeuristic(
  results: { [key: string]: HEResultData[] },
  heuristicKey: string,
): boolean {
  const currentHeuristicItems = results[heuristicKey] || [];
  const hasExistingViolation = currentHeuristicItems.some(
    (item) => item.violated,
  );
  return !hasExistingViolation;
}

/**
 * Groups heuristic evaluation results by heuristic ID.
 */
export function groupResultsByHeuristic<T extends { heuristicId: string }>(
  results: T[],
): { [key: string]: T[] } {
  return results.reduce(
    (acc: { [key: string]: T[] }, result) => {
      if (!acc[result.heuristicId]) {
        acc[result.heuristicId] = [];
      }
      acc[result.heuristicId].push(result);
      return acc;
    },
    {},
  );
}

/**
 * Adds placeholder entries for heuristics from the family that have no results yet.
 */
export function addPlaceholderHeuristics(
  groupedResults: { [key: string]: HEResultData[] },
  familyHeuristics: Array<{ id: string; [key: string]: unknown }>,
  heuristicEvaluationId: string,
): { [key: string]: HEResultData[] } {
  const result = { ...groupedResults };
  for (const heuristic of familyHeuristics) {
    if (!result[heuristic.id]) {
      result[heuristic.id] = [
        {
          id: `placeholder-${heuristic.id}`,
          heuristicId: heuristic.id,
          heuristicEvaluationId,
          violated: false,
          reason: "",
          severity: null,
          rating: null,
          source: "PLACEHOLDER",
          recommendations: [],
          heuristic: heuristic,
          step: undefined,
          fileId: undefined,
        } as unknown as HEResultData,
      ];
    }
  }
  return result;
}

/**
 * Sorts heuristic results by step number within each group.
 */
export function sortHeuristicResults(
  groupedResults: { [key: string]: HEResultData[] },
): { [key: string]: HEResultData[] } {
  const result = { ...groupedResults };
  Object.keys(result).forEach((key) => {
    result[key].sort((a, b) => {
      if (a.step !== undefined && b.step !== undefined) return a.step - b.step;
      if (a.step === undefined && b.step === undefined) return 0;
      return a.step !== undefined ? -1 : 1;
    });
  });
  return result;
}
