"use server";

import {
  createRecommendation as createRecommendationAPI,
  deleteStudyContent as deleteStudyContentAPI,
  createCWIssue as createCWIssueAPI,
} from "@/apps/nextjs-app/lib/data";
import { logger } from "@/apps/shared/logger";
import { actionSuccess, actionError, ActionResult } from "./shared";

/**
 * Creates a recommendation for a cognitive walkthrough issue.
 */
export async function handleCreateCWRecommendation(
  issueId: string,
  content: string,
): Promise<ActionResult> {
  try {
    logger.debug("Creating CW recommendation", {
      issueId,
      contentLength: content.length,
    });

    if (!content.trim()) {
      logger.warn("Attempted to create CW recommendation with empty content", {
        issueId,
      });
      return actionError("Content cannot be empty");
    }

    await createRecommendationAPI(
      "cognitiveWalkthrough",
      issueId,
      content,
      "HUMAN",
    );

    logger.info("Successfully created CW recommendation", { issueId });
    return actionSuccess();
  } catch (error) {
    logger.error("Failed to create CW recommendation", {
      issueId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return actionError("Failed to create recommendation");
  }
}

/**
 * Deletes a cognitive walkthrough recommendation.
 */
export async function handleDeleteCWRecommendation(
  recommendationId: string,
): Promise<ActionResult> {
  try {
    logger.debug("Deleting CW recommendation", { recommendationId });

    await deleteStudyContentAPI(
      recommendationId,
      "cognitiveWalkthrough",
      "recommendation",
    );

    logger.info("Successfully deleted CW recommendation", { recommendationId });
    return actionSuccess();
  } catch (error) {
    logger.error("Failed to delete CW recommendation", {
      recommendationId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return actionError("Failed to delete recommendation");
  }
}

/**
 * Deletes a cognitive walkthrough issue.
 */
export async function handleDeleteCWIssue(
  issueId: string,
): Promise<ActionResult> {
  try {
    logger.debug("Deleting CW issue", { issueId });

    await deleteStudyContentAPI(issueId, "cognitiveWalkthrough", "issue");

    logger.info("Successfully deleted CW issue", { issueId });
    return actionSuccess();
  } catch (error) {
    logger.error("Failed to delete CW issue", {
      issueId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return actionError("Failed to delete issue");
  }
}

/**
 * Creates a cognitive walkthrough issue for a step.
 */
export async function handleCreateCWIssue(
  stepId: string,
  issueType: string,
  content: string,
): Promise<ActionResult> {
  try {
    logger.debug("Creating CW issue", {
      stepId,
      issueType,
      contentLength: content.length,
    });

    if (!content.trim()) {
      logger.warn("Attempted to create CW issue with empty content", {
        stepId,
        issueType,
      });
      return actionError("Content cannot be empty");
    }

    await createCWIssueAPI(stepId, issueType, content, "HUMAN");

    logger.info("Successfully created CW issue", { stepId, issueType });
    return actionSuccess();
  } catch (error) {
    logger.error("Failed to create CW issue", {
      stepId,
      issueType,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return actionError("Failed to create issue");
  }
}
