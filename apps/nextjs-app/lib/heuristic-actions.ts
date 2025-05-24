import {
  createRecommendation as createRecommendationAPI,
  createHEResult as createHEResultAPI,
} from "@/apps/nextjs-app/lib/data";
import { ViolatedType } from "@prisma/client";

export async function handleCreateRecommendation(
  resultId: string,
  content: string,
  refreshCallback: () => Promise<void>,
) {
  if (!content.trim()) return;

  await createRecommendationAPI(
    "heuristicEvaluation",
    resultId,
    content,
    "HUMAN",
  );

  await refreshCallback();
}

export async function handleCreateIssue(
  heuristicEvaluationId: string,
  heuristicId: string,
  stepIndex: number,
  fileId: string,
  description: string,
  refreshCallback: () => Promise<void>,
) {
  await createHEResultAPI(
    heuristicEvaluationId,
    heuristicId,
    stepIndex + 1,
    fileId,
    description,
    "HUMAN",
  );

  await refreshCallback();
}

export function checkIfFirstViolationForHeuristic(
  results: { [key: string]: any[] },
  heuristicKey: string,
): boolean {
  const currentHeuristicItems = results[heuristicKey] || [];
  return !currentHeuristicItems.some(
    (item) => item.violated === ViolatedType.YES,
  );
}
