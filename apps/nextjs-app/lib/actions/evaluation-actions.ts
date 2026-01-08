"use server";

import {
  createRecommendation as createRecommendationAPI,
  deleteStudyContent as deleteStudyContentAPI,
  createHEResult as createHEResultAPI,
} from "@/apps/nextjs-app/lib/data";
import { logger } from "@/apps/shared/logger";
import { actionSuccess, actionError, ActionResult } from "./shared";

/**
 * Creates a recommendation for a heuristic evaluation issue.
 */
export async function handleCreateHERecommendation(
  issueId: string,
  content: string,
): Promise<ActionResult> {
  try {
    logger.debug("Creating HE recommendation", {
      issueId,
      contentLength: content.length,
    });

    if (!content.trim()) {
      logger.warn("Attempted to create HE recommendation with empty content", {
        issueId,
      });
      return actionError("Content cannot be empty");
    }

    await createRecommendationAPI(
      "heuristicEvaluation",
      issueId,
      content,
      "HUMAN",
    );

    logger.info("Successfully created HE recommendation", { issueId });
    return actionSuccess();
  } catch (error) {
    logger.error("Failed to create HE recommendation", {
      issueId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return actionError("Failed to create recommendation");
  }
}

/**
 * Deletes a heuristic evaluation recommendation.
 */
export async function handleDeleteHERecommendation(
  recommendationId: string,
): Promise<ActionResult> {
  try {
    logger.debug("Deleting HE recommendation", { recommendationId });

    await deleteStudyContentAPI(
      recommendationId,
      "heuristicEvaluation",
      "recommendation",
    );

    logger.info("Successfully deleted HE recommendation", { recommendationId });
    return actionSuccess();
  } catch (error) {
    logger.error("Failed to delete HE recommendation", {
      recommendationId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return actionError("Failed to delete recommendation");
  }
}

/**
 * Deletes a heuristic evaluation issue.
 */
export async function handleDeleteHEIssue(
  issueId: string,
): Promise<ActionResult> {
  try {
    logger.debug("Deleting HE issue", { issueId });

    await deleteStudyContentAPI(issueId, "heuristicEvaluation", "issue");

    logger.info("Successfully deleted HE issue", { issueId });
    return actionSuccess();
  } catch (error) {
    logger.error("Failed to delete HE issue", {
      issueId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return actionError("Failed to delete issue");
  }
}

/**
 * Creates a heuristic evaluation issue for a step.
 */
export async function handleCreateHEIssue(
  heuristicEvaluationId: string,
  heuristicId: string,
  stepIndex: number,
  fileId: string,
  description: string,
  severity: number,
): Promise<ActionResult> {
  try {
    logger.debug("Creating HE issue", {
      heuristicEvaluationId,
      heuristicId,
      stepIndex,
      fileId,
      descriptionLength: description.length,
      severity,
    });

    if (!description.trim()) {
      logger.warn("Attempted to create HE issue with empty content", {
        heuristicEvaluationId,
        heuristicId,
      });
      return actionError("Content cannot be empty");
    }

    await createHEResultAPI(
      heuristicEvaluationId,
      heuristicId,
      stepIndex + 1,
      fileId,
      description,
      severity,
      "HUMAN",
    );

    logger.info("Successfully created HE issue", {
      heuristicEvaluationId,
      heuristicId,
      stepIndex: stepIndex + 1,
      fileId,
      severity,
    });
    return actionSuccess();
  } catch (error) {
    logger.error("Failed to create HE issue", {
      heuristicEvaluationId,
      heuristicId,
      stepIndex,
      fileId,
      severity,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return actionError("Failed to create issue");
  }
}
