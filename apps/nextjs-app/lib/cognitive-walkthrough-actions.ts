import {
  createRecommendation as createRecommendationAPI,
  deleteStudyContent as deleteStudyContentAPI,
  createCWIssue as createCWIssueAPI,
} from "@/apps/nextjs-app/lib/data";
import { logger } from "@/apps/shared/logger.ts";

export async function handleCreateCWRecommendation(
  issueId: string,
  content: string,
  refreshCallback: () => Promise<void>,
) {
  try {
    logger.debug("Creating CW recommendation", {
      issueId,
      contentLength: content.length,
    });

    if (!content.trim()) {
      logger.warn("Attempted to create CW recommendation with empty content", {
        issueId,
      });
      return;
    }

    await createRecommendationAPI(
      "cognitiveWalkthrough",
      issueId,
      content,
      "HUMAN",
    );

    logger.info("Successfully created CW recommendation", { issueId });
    await refreshCallback();
  } catch (error) {
    logger.error("Failed to create CW recommendation", {
      issueId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}

export async function handleDeleteCWRecommendation(
  recommendationId: string,
  refreshCallback: () => Promise<void>,
) {
  try {
    logger.debug("Deleting CW recommendation", { recommendationId });

    await deleteStudyContentAPI(
      recommendationId,
      "cognitiveWalkthrough",
      "recommendation",
    );

    logger.info("Successfully deleted CW recommendation", { recommendationId });
    await refreshCallback();
  } catch (error) {
    logger.error("Failed to delete CW recommendation", {
      recommendationId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}

export async function handleDeleteCWIssue(
  issueId: string,
  refreshCallback: () => Promise<void>,
) {
  try {
    logger.debug("Deleting CW issue", { issueId });

    await deleteStudyContentAPI(issueId, "cognitiveWalkthrough", "issue");

    logger.info("Successfully deleted CW issue", { issueId });
    await refreshCallback();
  } catch (error) {
    logger.error("Failed to delete CW issue", {
      issueId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}

export async function handleCreateCWIssue(
  stepId: string,
  issueType: string,
  content: string,
  refreshCallback: () => Promise<void>,
) {
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
      return;
    }

    await createCWIssueAPI(stepId, issueType, content, "HUMAN");

    logger.info("Successfully created CW issue", { stepId, issueType });
    await refreshCallback();
  } catch (error) {
    logger.error("Failed to create CW issue", {
      stepId,
      issueType,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}
