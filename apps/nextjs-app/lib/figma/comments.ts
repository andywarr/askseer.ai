/**
 * Figma Comments utilities
 *
 * This module provides types and helper functions for Figma comments,
 * including issue extraction and formatting.
 */

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
  includeType: boolean;
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
 * Convert issue type to sentence case
 */
function formatIssueType(issueType: string): string {
  // Handle uppercase enum values like DISCOVERABILITY, LEARNABILITY, USABILITY
  if (issueType === issueType.toUpperCase()) {
    return issueType.charAt(0) + issueType.slice(1).toLowerCase();
  }
  return issueType;
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
    includeType: true,
    includeIssue: true,
    includeSeverity: true,
    includeRecommendations: true,
  };

  // Header with issue type (heuristic for heuristic evaluation, type for cognitive walkthrough)
  if (opts.includeHeuristic) {
    lines.push(`🔍 ${issue.issueType}`);
  } else if (opts.includeType) {
    lines.push(`🔍 ${formatIssueType(issue.issueType)}`);
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
