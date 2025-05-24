import { ViolatedType } from "@prisma/client";
import { HEResultData } from "@/apps/nextjs-app/types/types";

export function filterNonViolatedResults(
  results: { [key: string]: HEResultData[] },
  hideNonViolated: boolean
) {
  if (!hideNonViolated) return results;

  return Object.entries(results).reduce(
    (acc, [key, items]) => {
      const violatedItems = items.filter(
        (item) => item.violated === ViolatedType.YES
      );
      if (violatedItems.length > 0) {
        acc[key] = violatedItems;
      }
      return acc;
    },
    {} as { [key: string]: HEResultData[] }
  );
}

export function getDefaultOpenAccordionValues(
  groupedResults: { [key: string]: HEResultData[] }
) {
  return Object.entries(groupedResults)
    .filter(([_, items]) =>
      items.some((item) => item.violated === ViolatedType.YES)
    )
    .map(([key]) => key);
}

export function findFileIdForStep(
  results: { [key: string]: HEResultData[] },
  heuristicKey: string,
  stepIndex: number,
  files: any[]
) {
  const currentItems = results[heuristicKey] || [];
  
  for (const item of currentItems) {
    if (item.step === stepIndex + 1 && item.fileId) {
      return item.fileId;
    }
  }
  
  return files[stepIndex]?.id;
}
