/**
 * Consolidated error handling for job processing
 */

import { logger } from "@/apps/shared/logger.ts";
import { updateCredits, updateStatus } from "./dbWorkerClient.ts";
import { STUDY_STATUS_FAILED } from "@/apps/shared/constants.ts";

// ============================================================================
// Types
// ============================================================================

/**
 * Common job data fields needed for error handling
 */
interface JobData {
  studyId: string;
  userId: string;
  retry?: boolean;
}

// ============================================================================
// Error Handler
// ============================================================================

/**
 * Handles processing errors consistently across all job types
 * - Logs the error
 * - Refunds credits if not a retry
 * - Updates study status to failed
 *
 * @param jobData - The job data containing studyId, userId, and retry flag
 * @param error - The error that occurred
 * @param jobType - Optional job type for logging context
 */
export async function handleProcessingError(
  jobData: JobData,
  error: unknown,
  jobType?: string
): Promise<void> {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;

  logger.error(`Error processing ${jobType || "job"} - study failed`, {
    error: errorMessage,
    stack: errorStack,
    studyId: jobData.studyId,
    userId: jobData.userId,
    jobType,
  });

  // Refund the user credit if not a retry
  if (!jobData.retry) {
    logger.info("Refunding user credit due to processing error", {
      userId: jobData.userId,
      creditsToRefund: 1,
      studyId: jobData.studyId,
    });

    try {
      await updateCredits(jobData.userId, 1, jobData.studyId);
    } catch (creditError) {
      logger.error("Failed to refund credits", {
        error: creditError instanceof Error ? creditError.message : String(creditError),
        userId: jobData.userId,
        studyId: jobData.studyId,
      });
      // Continue to update status even if credit refund fails
    }
  } else {
    logger.debug("Skipping credit refund for retry job", {
      userId: jobData.userId,
      studyId: jobData.studyId,
    });
  }

  // Update the study status to failed
  logger.info("Updating study status to failed", {
    studyId: jobData.studyId,
    reason: "Processing error occurred",
  });

  try {
    await updateStatus(jobData.studyId, STUDY_STATUS_FAILED);
  } catch (statusError) {
    logger.error("Failed to update study status to failed", {
      error: statusError instanceof Error ? statusError.message : String(statusError),
      studyId: jobData.studyId,
    });
    // Rethrow to indicate the operation failed completely
    throw statusError;
  }
}
