import { HEResultData } from "@/apps/nextjs-app/types/types";
import type { SeverityRating } from "@/apps/nextjs-app/utils/severity";

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

/**
 * Filter results to only show items matching the selected severity levels.
 * If no severity levels are selected, all results are returned (no filter applied).
 * Heuristic groups are kept if they have at least one matching item.
 */
export function filterBySeverity(
  results: { [key: string]: HEResultData[] },
  selectedSeverities: SeverityRating[],
) {
  if (selectedSeverities.length === 0) return results;

  return Object.entries(results).reduce(
    (acc, [key, items]) => {
      const filtered = items.filter(
        (item) =>
          item.severity !== null &&
          item.severity !== undefined &&
          selectedSeverities.includes(item.severity as SeverityRating),
      );
      if (filtered.length > 0) {
        acc[key] = filtered;
      }
      return acc;
    },
    {} as { [key: string]: HEResultData[] },
  );
}

export type SourceFilterValue = "AI" | "HUMAN" | "AI_HUMAN";

export type HeuristicSortOption = "heuristic" | "violations";
export type SortDirection = "asc" | "desc";

/**
 * Sorts grouped heuristic results by the specified sort option and direction.
 * - "heuristic": sorts alphabetically by heuristic name
 * - "violations": sorts by number of violated items in each group
 */
export function sortGroupedResults<
  T extends { violated: boolean | string; heuristic: any },
>(
  results: { [key: string]: T[] },
  sortBy: HeuristicSortOption,
  direction: SortDirection,
): [string, T[]][] {
  const entries = Object.entries(results);

  return entries.sort(([, itemsA], [, itemsB]) => {
    let comparison: number;

    if (sortBy === "violations") {
      const violationsA = itemsA.filter((item) => item.violated).length;
      const violationsB = itemsB.filter((item) => item.violated).length;
      comparison = violationsA - violationsB;
    } else {
      const nameA =
        itemsA[0]?.heuristic?.label ||
        itemsA[0]?.heuristic?.heuristic ||
        itemsA[0]?.heuristic?.name ||
        "N/A";
      const nameB =
        itemsB[0]?.heuristic?.label ||
        itemsB[0]?.heuristic?.heuristic ||
        itemsB[0]?.heuristic?.name ||
        "N/A";
      comparison = nameA.localeCompare(nameB);
    }

    return direction === "desc" ? -comparison : comparison;
  });
}

/**
 * Filter results to only show heuristic groups matching the selected heuristic IDs.
 * If no heuristic IDs are selected, all results are returned (no filter applied).
 */
export function filterByHeuristic(
  results: { [key: string]: HEResultData[] },
  selectedHeuristicIds: string[],
) {
  if (selectedHeuristicIds.length === 0) return results;

  return Object.entries(results).reduce(
    (acc, [key, items]) => {
      if (selectedHeuristicIds.includes(key)) {
        acc[key] = items;
      }
      return acc;
    },
    {} as { [key: string]: HEResultData[] },
  );
}

/**
 * Filter results to only show items matching the selected source types.
 * If no sources are selected, all results are returned (no filter applied).
 */
export function filterBySource(
  results: { [key: string]: HEResultData[] },
  selectedSources: SourceFilterValue[],
) {
  if (selectedSources.length === 0) return results;

  return Object.entries(results).reduce(
    (acc, [key, items]) => {
      const filtered = items.filter(
        (item) =>
          item.source &&
          selectedSources.includes(item.source as SourceFilterValue),
      );
      if (filtered.length > 0) {
        acc[key] = filtered;
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
  return results.reduce((acc: { [key: string]: T[] }, result) => {
    if (!acc[result.heuristicId]) {
      acc[result.heuristicId] = [];
    }
    acc[result.heuristicId].push(result);
    return acc;
  }, {});
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
export function sortHeuristicResults(groupedResults: {
  [key: string]: HEResultData[];
}): { [key: string]: HEResultData[] } {
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
