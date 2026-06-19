"use server";

import {
  createRecommendation as createRecommendationAPI,
  deleteStudyContent as deleteStudyContentAPI,
  createCWIssue as createCWIssueAPI,
} from "@/apps/nextjs-app/lib/db/data";
import { logger } from "@/apps/shared/logger";
import { actionSuccess, actionError, ActionResult } from "./shared";
import { revalidatePath } from "next/cache";

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

/**
 * Wrapper actions that perform the operation and revalidate the study page.
 */
export async function createCWIssueAction(
  studyId: string,
  userId: string,
  stepId: string,
  issueType: string,
  content: string,
): Promise<ActionResult> {
  const result = await handleCreateCWIssue(stepId, issueType, content);
  if (result.success) {
    logger.debug("Cognitive walkthrough issue created successfully", {
      userId,
      studyId,
    });
    revalidatePath(`/walkthrough/${studyId}`);
  } else {
    logger.error("Failed to create cognitive walkthrough issue", {
      userId,
      studyId,
      error: result.error,
    });
  }
  return result;
}

export async function createCWRecommendationAction(
  studyId: string,
  userId: string,
  issueId: string,
  content: string,
): Promise<ActionResult> {
  const result = await handleCreateCWRecommendation(issueId, content);
  if (result.success) {
    logger.debug(
      "Cognitive walkthrough recommendation created successfully",
      {
        userId,
        studyId,
        issueId,
      },
    );
    revalidatePath(`/walkthrough/${studyId}`);
  } else {
    logger.error(
      "Failed to create cognitive walkthrough recommendation",
      {
        userId,
        studyId,
        issueId,
        error: result.error,
      },
    );
  }
  return result;
}

export async function deleteCWRecommendationAction(
  studyId: string,
  userId: string,
  issueId: string,
  recommendationId: string,
): Promise<ActionResult> {
  const result = await handleDeleteCWRecommendation(recommendationId);
  if (result.success) {
    logger.debug(
      "Cognitive walkthrough recommendation deleted successfully",
      {
        userId,
        studyId,
        issueId,
        recommendationId,
      },
    );
    revalidatePath(`/walkthrough/${studyId}`);
  } else {
    logger.error(
      "Failed to delete cognitive walkthrough recommendation",
      {
        userId,
        studyId,
        issueId,
        recommendationId,
        error: result.error,
      },
    );
  }
  return result;
}
