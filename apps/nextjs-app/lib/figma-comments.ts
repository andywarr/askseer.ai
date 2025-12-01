/**
 * Figma Comments API utilities
 *
 * This module provides functions to post comments to Figma files
 * when an evaluation or walkthrough is complete.
 */

const FIGMA_API_BASE_URL = "https://api.figma.com/v1";

export interface FigmaCommentPayload {
  message: string;
  client_meta?: {
    node_id?: string;
    node_offset?: { x: number; y: number };
  };
}

export interface FigmaCommentResponse {
  id: string;
  file_key: string;
  parent_id?: string;
  user: {
    id: string;
    handle: string;
    img_url: string;
  };
  created_at: string;
  resolved_at?: string;
  message: string;
  client_meta?: {
    node_id?: string;
    node_offset?: { x: number; y: number };
  };
  order_id?: string;
}

export interface PostFigmaCommentOptions {
  fileKey: string;
  nodeId?: string;
  message: string;
  token?: string;
}

export interface PostFigmaCommentsResult {
  success: boolean;
  comments: FigmaCommentResponse[];
  errors: Array<{ nodeId?: string; error: string }>;
}

export interface IssueComment {
  fileKey: string;
  nodeId: string;
  frameName: string;
  step: number;
  issueType: string;
  issue: string;
  severity?: number | null;
  recommendations: string[];
}

export interface CommentOptions {
  includeHeuristic: boolean;
  includeIssue: boolean;
  includeSeverity: boolean;
  includeRecommendations: boolean;
}

/**
 * Format severity level to human-readable text
 */
function formatSeverity(severity: number | null | undefined): string {
  if (severity === null || severity === undefined) return "";
  switch (severity) {
    case 0:
      return "Not a problem";
    case 1:
      return "Cosmetic";
    case 2:
      return "Minor";
    case 3:
      return "Major";
    case 4:
      return "Catastrophic";
    default:
      return `Severity: ${severity}`;
  }
}

/**
 * Format an issue into a Figma comment message
 */
export function formatIssueAsComment(
  issue: IssueComment,
  options?: CommentOptions,
): string {
  const lines: string[] = [];

  // Default options if not provided
  const opts = options || {
    includeHeuristic: true,
    includeIssue: true,
    includeSeverity: true,
    includeRecommendations: true,
  };

  // Header with issue type (heuristic)
  if (opts.includeHeuristic) {
    lines.push(`🔍 ${issue.issueType}`);
  }

  // Add severity on its own line if present
  if (opts.includeSeverity) {
    const severityText = formatSeverity(issue.severity);
    if (severityText) {
      lines.push(`Severity: ${severityText}`);
    }
  }

  // Issue description
  if (opts.includeIssue) {
    if (lines.length > 0) lines.push("");
    lines.push(issue.issue);
  }

  // Recommendations
  if (opts.includeRecommendations && issue.recommendations.length > 0) {
    if (lines.length > 0) lines.push("");
    lines.push("💡 Recommendations:");
    issue.recommendations.forEach((rec, index) => {
      lines.push(`${index + 1}. ${rec}`);
    });
  }

  return lines.join("\n");
}

/**
 * Post a single comment to a Figma file
 */
export async function postFigmaComment({
  fileKey,
  nodeId,
  message,
  token = process.env.NEXT_PUBLIC_FIGMA_API_TOKEN,
}: PostFigmaCommentOptions): Promise<FigmaCommentResponse> {
  if (!token) {
    throw new Error(
      "Figma API token not configured. Please add NEXT_PUBLIC_FIGMA_API_TOKEN to your environment variables.",
    );
  }

  const payload: FigmaCommentPayload = {
    message,
  };

  // If nodeId is provided, attach the comment to that specific node
  if (nodeId) {
    payload.client_meta = {
      node_id: nodeId,
      node_offset: { x: 0, y: 0 },
    };
  }

  const response = await fetch(
    `${FIGMA_API_BASE_URL}/files/${fileKey}/comments`,
    {
      method: "POST",
      headers: {
        "X-Figma-Token": token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Figma API error:", {
      status: response.status,
      statusText: response.statusText,
      error: errorText,
      fileKey,
      nodeId,
    });
    if (response.status === 403) {
      throw new Error(
        "Access denied. Please ensure your Figma token has permission to add comments to this file.",
      );
    } else if (response.status === 404) {
      throw new Error(
        "Figma file not found. Please ensure the file exists and is accessible.",
      );
    } else if (response.status === 401) {
      throw new Error(
        "Invalid Figma API token. Please check your NEXT_PUBLIC_FIGMA_API_TOKEN configuration.",
      );
    } else if (response.status === 429) {
      throw new Error(
        "Rate limited by Figma API. Please try again in a few moments.",
      );
    }
    throw new Error(
      `Failed to post Figma comment: ${response.status} - ${errorText}`,
    );
  }

  return response.json();
}

/**
 * Post multiple comments to a Figma file (one per issue)
 */
export async function postFigmaComments(
  issues: IssueComment[],
  token?: string,
  options?: CommentOptions,
): Promise<PostFigmaCommentsResult> {
  const result: PostFigmaCommentsResult = {
    success: true,
    comments: [],
    errors: [],
  };

  // Group issues by fileKey to minimize API calls and handle different files
  const issuesByFile = issues.reduce(
    (acc, issue) => {
      if (!acc[issue.fileKey]) {
        acc[issue.fileKey] = [];
      }
      acc[issue.fileKey].push(issue);
      return acc;
    },
    {} as Record<string, IssueComment[]>,
  );

  // Process each file's issues with a delay to avoid rate limiting
  // Figma API rate limit: 10 requests per minute = 7 seconds between requests (with buffer)
  for (const [fileKey, fileIssues] of Object.entries(issuesByFile)) {
    for (let i = 0; i < fileIssues.length; i++) {
      const issue = fileIssues[i];
      try {
        const message = formatIssueAsComment(issue, options);
        const comment = await postFigmaComment({
          fileKey,
          nodeId: issue.nodeId,
          message,
          token,
        });
        result.comments.push(comment);

        // Add 7 second delay between requests (10 requests per minute limit, with buffer)
        if (i < fileIssues.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 7000));
        }
      } catch (error) {
        result.success = false;

        // If rate limited, wait 60 seconds and retry once
        if (error instanceof Error && error.message.includes("Rate limited")) {
          await new Promise((resolve) => setTimeout(resolve, 60000));
          try {
            const message = formatIssueAsComment(issue, options);
            const comment = await postFigmaComment({
              fileKey,
              nodeId: issue.nodeId,
              message,
              token,
            });
            result.comments.push(comment);
            // Remove the error we just added since retry succeeded
            result.success = result.errors.length === 0;
            continue;
          } catch (retryError) {
            // Retry failed, keep the original error
          }
        }

        result.errors.push({
          nodeId: issue.nodeId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  return result;
}

/**
 * Check if a study has any Figma-imported files
 */
export function hasFigmaFiles(
  files: Array<{ figmaFileKey?: string | null; figmaNodeId?: string | null }>,
): boolean {
  return files.some((file) => file.figmaFileKey && file.figmaNodeId);
}

/**
 * Get Figma file keys from study files
 */
export function getUniqueFigmaFileKeys(
  files: Array<{ figmaFileKey?: string | null }>,
): string[] {
  const keys = new Set<string>();
  files.forEach((file) => {
    if (file.figmaFileKey) {
      keys.add(file.figmaFileKey);
    }
  });
  return Array.from(keys);
}

/**
 * Extract issues from heuristic evaluation results that can be posted as Figma comments
 */
export function extractHeuristicEvaluationIssues(
  results: any[],
  files: Array<{
    id: string;
    figmaFileKey?: string | null;
    figmaNodeId?: string | null;
    figmaFrameName?: string | null;
  }>,
): IssueComment[] {
  const issues: IssueComment[] = [];
  const fileMap = new Map(files.map((f) => [f.id, f]));

  for (const result of results) {
    // Only include violated heuristics
    if (result.violated !== "yes" && result.violated !== true) {
      continue;
    }

    const file = result.fileId ? fileMap.get(result.fileId) : null;

    // Only include issues that have Figma metadata
    if (!file?.figmaFileKey || !file?.figmaNodeId) {
      continue;
    }

    issues.push({
      fileKey: file.figmaFileKey,
      nodeId: file.figmaNodeId,
      frameName: file.figmaFrameName || `Step ${result.step || 1}`,
      step: result.step || 1,
      issueType: result.heuristic?.heuristic || "Heuristic Violation",
      issue: result.reason,
      severity: result.severity,
      recommendations: (result.recommendations || []).map(
        (r: any) => r.recommendation,
      ),
    });
  }

  return issues;
}

/**
 * Extract issues from cognitive walkthrough steps that can be posted as Figma comments
 */
export function extractCognitiveWalkthroughIssues(
  steps: any[],
  files: Array<{
    id: string;
    figmaFileKey?: string | null;
    figmaNodeId?: string | null;
    figmaFrameName?: string | null;
  }>,
): IssueComment[] {
  const issues: IssueComment[] = [];

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const file = files[i];

    // Only include issues that have Figma metadata
    if (!file?.figmaFileKey || !file?.figmaNodeId) {
      continue;
    }

    // Process all issues in this step
    for (const issue of step.issues || []) {
      issues.push({
        fileKey: file.figmaFileKey,
        nodeId: file.figmaNodeId,
        frameName: file.figmaFrameName || `Step ${step.step || i + 1}`,
        step: step.step || i + 1,
        issueType: issue.issueType || "Issue",
        issue: issue.issue,
        severity: issue.severity,
        recommendations: (issue.recommendations || []).map(
          (r: any) => r.recommendation,
        ),
      });
    }
  }

  return issues;
}
