import {
  createRecommendation as createRecommendationAPI,
  createHEResult as createHEResultAPI,
} from "@/apps/nextjs-app/lib/data";
import { logger } from "@/apps/shared/logger";

export async function handleCreateRecommendation(
  resultId: string,
  content: string,
  refreshCallback: () => Promise<void>,
) {
  logger.debug("Creating recommendation", {
    resultId,
    contentLength: content.length,
  });

  if (!content.trim()) {
    logger.warn("Attempted to create recommendation with empty content", {
      resultId,
    });
    return;
  }

  try {
    await createRecommendationAPI(
      "heuristicEvaluation",
      resultId,
      content,
      "HUMAN",
    );

    logger.info("Recommendation created successfully", { resultId });
    await refreshCallback();
  } catch (error) {
    logger.error("Failed to create recommendation", {
      resultId,
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error; // Re-throw to allow caller to handle
  }
}

export async function handleCreateIssue(
  heuristicEvaluationId: string,
  heuristicId: string,
  stepIndex: number,
  fileId: string,
  description: string,
  refreshCallback: () => Promise<void>,
) {
  logger.debug("Creating heuristic evaluation issue", {
    heuristicEvaluationId,
    heuristicId,
    stepIndex,
    fileId,
    descriptionLength: description.length,
  });

  try {
    await createHEResultAPI(
      heuristicEvaluationId,
      heuristicId,
      stepIndex + 1,
      fileId,
      description,
      "HUMAN",
    );

    logger.info("Heuristic evaluation issue created successfully", {
      heuristicEvaluationId,
      heuristicId,
      stepIndex: stepIndex + 1,
      fileId,
    });

    await refreshCallback();
  } catch (error) {
    logger.error("Failed to create heuristic evaluation issue", {
      heuristicEvaluationId,
      heuristicId,
      stepIndex,
      fileId,
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error; // Re-throw to allow caller to handle
  }
}

export function checkIfFirstViolationForHeuristic(
  results: { [key: string]: any[] },
  heuristicKey: string,
): boolean {
  logger.debug("Checking if first violation for heuristic", {
    heuristicKey,
    hasResults: !!results[heuristicKey],
    resultCount: results[heuristicKey]?.length || 0,
  });

  try {
    const currentHeuristicItems = results[heuristicKey] || [];
    const hasExistingViolation = currentHeuristicItems.some(
      (item) => item.violated,
    );

    logger.debug("First violation check result", {
      heuristicKey,
      hasExistingViolation,
      isFirstViolation: !hasExistingViolation,
    });

    return !hasExistingViolation;
  } catch (error) {
    logger.error("Error checking first violation for heuristic", {
      heuristicKey,
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });
    // Return false as a safe default (assume not first violation)
    return false;
  }
}
