"use server";

import {
  postFigmaComment,
  postFigmaComments,
  formatIssueAsComment,
  type IssueComment,
  type PostFigmaCommentsResult,
  type CommentOptions,
  type FigmaRateLimitInfo,
} from "@/apps/nextjs-app/lib/figma-comments";
import { getCurrentUserId } from "@/apps/nextjs-app/lib/figma-actions";
import { getFigmaAccessToken } from "@/apps/nextjs-app/lib/figma-oauth";
import { logger } from "@/apps/shared/logger";

export interface AddFigmaCommentResult {
  success: boolean;
  error?: string;
  /** Rate limit info when the error is due to rate limiting */
  rateLimitInfo?: FigmaRateLimitInfo;
}

export interface AddFigmaCommentsResult {
  success: boolean;
  commentCount: number;
  errorCount: number;
  errors: Array<{ nodeId?: string; error: string }>;
}

/**
 * Server action to post a single issue as a comment to a Figma file
 */
export async function addSingleFigmaComment(
  issue: IssueComment,
  options: CommentOptions,
): Promise<AddFigmaCommentResult> {
  try {
    // Get current user
    const userId = await getCurrentUserId();
    if (!userId) {
      return {
        success: false,
        error: "Please sign in to post comments to Figma.",
      };
    }

    // Get the user's Figma access token
    const accessToken = await getFigmaAccessToken(userId);
    if (!accessToken) {
      return {
        success: false,
        error: "Please connect your Figma account first.",
      };
    }

    const message = formatIssueAsComment(issue, options);
    await postFigmaComment({
      fileKey: issue.fileKey,
      nodeId: issue.nodeId,
      message,
      token: accessToken,
    });
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    // Extract rate limit info if present (attached by postFigmaComment on 429)
    const rateLimitInfo = (error as any)?.rateLimitInfo as
      | FigmaRateLimitInfo
      | undefined;

    logger.error("Failed to add Figma comment", {
      nodeId: issue.nodeId,
      error: errorMessage,
      rateLimitInfo,
    });
    return {
      success: false,
      error: errorMessage,
      rateLimitInfo,
    };
  }
}

/**
 * Server action to post issues as comments to a Figma file
 */
export async function addFigmaComments(
  issues: IssueComment[],
  studyId: string,
  userId: string,
  options: CommentOptions,
): Promise<AddFigmaCommentsResult> {
  logger.info("Adding Figma comments", {
    studyId,
    userId,
    issueCount: issues.length,
    options,
  });

  try {
    if (issues.length === 0) {
      logger.warn("No issues to add as Figma comments", {
        studyId,
        userId,
      });
      return {
        success: true,
        commentCount: 0,
        errorCount: 0,
        errors: [],
      };
    }

    // Get the user's Figma access token
    const accessToken = await getFigmaAccessToken(userId);
    if (!accessToken) {
      return {
        success: false,
        commentCount: 0,
        errorCount: 1,
        errors: [{ error: "Please connect your Figma account first." }],
      };
    }

    const result: PostFigmaCommentsResult = await postFigmaComments(
      issues,
      accessToken,
      options,
    );

    logger.info("Figma comments added", {
      studyId,
      userId,
      commentCount: result.comments.length,
      errorCount: result.errors.length,
      success: result.success,
    });

    return {
      success: result.success,
      commentCount: result.comments.length,
      errorCount: result.errors.length,
      errors: result.errors,
    };
  } catch (error) {
    logger.error("Failed to add Figma comments", {
      studyId,
      userId,
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      success: false,
      commentCount: 0,
      errorCount: 1,
      errors: [
        {
          error:
            error instanceof Error ? error.message : "Unknown error occurred",
        },
      ],
    };
  }
}
