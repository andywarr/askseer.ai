/**
 * Utility functions for AI worker
 * Contains deduplication utilities that use OpenAI
 */

// OpenAI imports
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";

// Zod imports
import { z } from "zod";

// Import from shared modules
import { logger } from "@/apps/shared/logger.ts";
import { config } from "../config.ts";
import type {
  DeduplicationItem,
  CWStepData,
  CWIssueData,
  HEResultData,
} from "../types.ts";

// Re-export types for backward compatibility
export type { File } from "../types.ts";

// Re-export functions from new modules for backward compatibility
export { getPresignedUrl } from "./s3Client.ts";
export {
  getFiles,
  updateCredits,
  updateStatus,
} from "./dbWorkerClient.ts";

// Initialize OpenAI
const openai = new OpenAI();

// ============================================================================
// Deduplication utilities
// ============================================================================

// Schema for deduplication response - returns indices to keep
const deduplicationResponseSchema = z.object({
  indicesToKeep: z.array(z.number().int().min(0)),
  reasoning: z.string(),
});

/**
 * Uses LLM to identify and remove duplicate or semantically similar items.
 * Returns the deduplicated array of items.
 */
async function deduplicateWithLLM<T>(
  items: T[],
  getTextFn: (item: T) => string,
  itemType: string,
  studyId: string
): Promise<T[]> {
  if (items.length <= 1) {
    return items;
  }

  const deduplicationItems: DeduplicationItem[] = items.map((item, index) => ({
    text: getTextFn(item),
    originalIndex: index,
  }));

  const prompt = `You are tasked with identifying duplicate or semantically similar ${itemType} from a UX evaluation. 

Review the following ${itemType} and identify which ones should be KEPT. Remove duplicates by keeping only the most comprehensive or well-articulated version when items describe the same underlying problem, even if they are worded differently or categorized under different heuristics.

${itemType.charAt(0).toUpperCase() + itemType.slice(1)} to analyze:
${deduplicationItems.map((item, i) => `[${i}]: ${item.text}`).join("\n")}

Return the indices of the items that should be KEPT (removing duplicates). When deciding what to keep:
1. If multiple items describe the SAME underlying UX problem (even from different heuristic perspectives), keep the one where the issue is MOST RELEVANT to the heuristic being violated
2. If items point to the same UI element or interaction issue, they are likely duplicates
3. Prefer keeping the version that best exemplifies the specific heuristic violation

Only keep both items if they describe genuinely DIFFERENT problems that would require separate fixes.`;

  try {
    const response = await openai.responses.create({
      model: config.models.deduplication,
      stream: false,
      input: [
        {
          role: "system",
          content:
            "You are an expert at identifying duplicate and semantically similar content. Be aggressive about removing redundancy - if two items describe the same underlying problem or would result in the same fix, they are duplicates. The goal is to present users with a concise, non-repetitive list.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      text: {
        format: zodTextFormat(
          deduplicationResponseSchema,
          "deduplication_response"
        ),
      },
    });

    const outputText = response.output_text?.trim();
    if (!outputText) {
      logger.warn("Empty response from deduplication LLM, keeping all items", {
        studyId,
        itemType,
      });
      return items;
    }

    let parsedResponse: unknown;
    try {
      parsedResponse = JSON.parse(outputText);
    } catch (e) {
      logger.warn("Failed to parse deduplication response, keeping all items", {
        studyId,
        itemType,
        contentPreview: String(outputText).slice(0, 200),
      });
      return items;
    }

    const maybeWrapped =
      (parsedResponse as Record<string, unknown>)?.deduplication_response ?? parsedResponse;
    const validated = deduplicationResponseSchema.safeParse(maybeWrapped);

    if (!validated.success) {
      logger.warn(
        "Deduplication response failed validation, keeping all items",
        {
          studyId,
          itemType,
          issues: validated.error.issues,
        }
      );
      return items;
    }

    const indicesToKeep = new Set(validated.data.indicesToKeep);
    const deduplicatedItems = items.filter((_, index) =>
      indicesToKeep.has(index)
    );

    logger.debug("Deduplication completed", {
      studyId,
      itemType,
      originalCount: items.length,
      deduplicatedCount: deduplicatedItems.length,
      removedCount: items.length - deduplicatedItems.length,
      reasoning: validated.data.reasoning,
    });

    return deduplicatedItems;
  } catch (error) {
    logger.warn("Deduplication LLM call failed, keeping all items", {
      studyId,
      itemType,
      error,
    });
    return items;
  }
}

// ============================================================================
// Goal Relevance Filtering
// ============================================================================

// Schema for goal relevance filtering response
const goalRelevanceResponseSchema = z.object({
  indicesToKeep: z.array(z.number().int().min(0)),
  reasoning: z.string(),
});

/**
 * Uses LLM to filter out issues that are not related to the user goal.
 */
async function filterByGoalRelevance<T>(
  items: T[],
  getTextFn: (item: T) => string,
  goal: string,
  studyId: string
): Promise<T[]> {
  if (items.length === 0 || !goal) {
    return items;
  }

  const prompt = `You are tasked with filtering UX issues based on their relevance to a specific user goal.

User Goal:
"""
${goal}
"""

Review the following issues and identify which ones are RELEVANT to the user goal above. Remove issues that:
1. Are unrelated to the user's task or objective
2. Address features or functionality outside the scope of the user goal
3. Are general UX critiques that don't impact the user's ability to achieve their goal

Issues to analyze:
${items.map((item, i) => `[${i}]: ${getTextFn(item)}`).join("\n")}

Return the indices of the issues that ARE RELEVANT to the user goal and should be KEPT. Be strict - only keep issues that directly impact the user's ability to achieve their stated goal.`;

  try {
    const response = await openai.responses.create({
      model: config.models.deduplication,
      stream: false,
      input: [
        {
          role: "system",
          content:
            "You are an expert UX researcher. Filter issues to only include those that are directly relevant to the user's stated goal. Be strict but fair - if an issue could reasonably impact the user's goal, keep it.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      text: {
        format: zodTextFormat(
          goalRelevanceResponseSchema,
          "goal_relevance_response"
        ),
      },
    });

    const outputText = response.output_text?.trim();
    if (!outputText) {
      logger.warn(
        "Empty response from goal relevance filter, keeping all items",
        {
          studyId,
        }
      );
      return items;
    }

    let parsedResponse: unknown;
    try {
      parsedResponse = JSON.parse(outputText);
    } catch (e) {
      logger.warn(
        "Failed to parse goal relevance response, keeping all items",
        {
          studyId,
          contentPreview: String(outputText).slice(0, 200),
        }
      );
      return items;
    }

    const maybeWrapped =
      (parsedResponse as Record<string, unknown>)?.goal_relevance_response ?? parsedResponse;
    const validated = goalRelevanceResponseSchema.safeParse(maybeWrapped);

    if (!validated.success) {
      logger.warn(
        "Goal relevance response failed validation, keeping all items",
        {
          studyId,
          issues: validated.error.issues,
        }
      );
      return items;
    }

    const indicesToKeep = new Set(validated.data.indicesToKeep);
    const filteredItems = items.filter((_, index) => indicesToKeep.has(index));

    logger.debug("Goal relevance filtering completed", {
      studyId,
      originalCount: items.length,
      filteredCount: filteredItems.length,
      removedCount: items.length - filteredItems.length,
      reasoning: validated.data.reasoning,
    });

    return filteredItems;
  } catch (error) {
    logger.warn("Goal relevance filter LLM call failed, keeping all items", {
      studyId,
      error,
    });
    return items;
  }
}

// ============================================================================
// Cognitive Walkthrough Deduplication
// ============================================================================

/**
 * Deduplicates issues and recommendations across all steps of a cognitive walkthrough.
 * Also filters out issues that are not related to the user goal.
 */
export async function deduplicateCognitiveWalkthrough(
  steps: CWStepData[],
  studyId: string,
  goal?: string
): Promise<CWStepData[]> {
  logger.info("Starting cognitive walkthrough deduplication", {
    studyId,
    stepCount: steps.length,
    totalIssues: steps.reduce((sum, step) => sum + step.issues.length, 0),
    hasGoal: !!goal,
  });

  // Collect all issues across all steps with their location info
  const allIssues: Array<{
    issue: CWIssueData;
    stepIndex: number;
    issueIndex: number;
  }> = [];

  steps.forEach((step, stepIndex) => {
    step.issues.forEach((issue, issueIndex) => {
      allIssues.push({ issue, stepIndex, issueIndex });
    });
  });

  if (allIssues.length === 0) {
    logger.debug("Skipping deduplication - no issues", { studyId });
    return steps;
  }

  let processedIssues = allIssues;

  // Filter by goal relevance if goal is provided
  if (goal) {
    processedIssues = await filterByGoalRelevance(
      processedIssues,
      (entry) => `[${entry.issue.issueType}] ${entry.issue.issue}`,
      goal,
      studyId
    );

    logger.debug("Goal relevance filtering applied", {
      studyId,
      beforeCount: allIssues.length,
      afterCount: processedIssues.length,
      removedAsIrrelevant: allIssues.length - processedIssues.length,
    });
  }

  // Deduplicate issues if more than 1
  if (processedIssues.length > 1) {
    processedIssues = await deduplicateWithLLM(
      processedIssues,
      (entry) => `[${entry.issue.issueType}] ${entry.issue.issue}`,
      "issues",
      studyId
    );
  }

  // Build a set of kept issue locations
  const keptIssues = new Set(
    processedIssues.map((entry) => `${entry.stepIndex}-${entry.issueIndex}`)
  );

  // Filter steps to only include kept issues
  const deduplicatedSteps = steps.map((step, stepIndex) => ({
    ...step,
    issues: step.issues.filter((_, issueIndex) =>
      keptIssues.has(`${stepIndex}-${issueIndex}`)
    ),
  }));

  // Deduplicate recommendations within each issue
  for (const step of deduplicatedSteps) {
    for (const issue of step.issues) {
      if (issue.recommendations.length > 1) {
        issue.recommendations = await deduplicateWithLLM(
          issue.recommendations,
          (rec) => rec.recommendation,
          "recommendations",
          studyId
        );
      }
    }
  }

  const finalIssueCount = deduplicatedSteps.reduce(
    (sum, step) => sum + step.issues.length,
    0
  );

  logger.info("Cognitive walkthrough deduplication completed", {
    studyId,
    originalIssueCount: allIssues.length,
    finalIssueCount,
    issuesRemoved: allIssues.length - finalIssueCount,
  });

  return deduplicatedSteps;
}

// ============================================================================
// Heuristic Evaluation Deduplication
// ============================================================================

/**
 * Deduplicates issues and recommendations across all heuristic evaluation results.
 * Also filters out issues that are not related to the user goal.
 * Only processes violated heuristics.
 */
export async function deduplicateHeuristicEvaluation(
  results: HEResultData[],
  studyId: string,
  goal?: string
): Promise<HEResultData[]> {
  logger.info("Starting heuristic evaluation deduplication", {
    studyId,
    totalResults: results.length,
    violatedResults: results.filter((r) => r.violated).length,
    hasGoal: !!goal,
  });

  // Separate violated and non-violated results
  const violatedResults = results.filter((r) => r.violated);
  const nonViolatedResults = results.filter((r) => !r.violated);

  if (violatedResults.length === 0) {
    logger.debug("Skipping deduplication - no violations", { studyId });
    return results;
  }

  let processedViolations = violatedResults;

  // Filter by goal relevance if goal is provided
  if (goal) {
    processedViolations = await filterByGoalRelevance(
      processedViolations,
      (result) => `[${result.heuristic}] ${result.reason}`,
      goal,
      studyId
    );

    logger.debug("Goal relevance filtering applied", {
      studyId,
      beforeCount: violatedResults.length,
      afterCount: processedViolations.length,
      removedAsIrrelevant: violatedResults.length - processedViolations.length,
    });
  }

  // Deduplicate remaining violations if more than 1
  if (processedViolations.length > 1) {
    processedViolations = await deduplicateWithLLM(
      processedViolations,
      (result) => `[${result.heuristic}] ${result.reason}`,
      "heuristic violations",
      studyId
    );
  }

  // Deduplicate recommendations within each violation
  for (const result of processedViolations) {
    if (result.recommendations.length > 1) {
      result.recommendations = await deduplicateWithLLM(
        result.recommendations,
        (rec) => rec.recommendation,
        "recommendations",
        studyId
      );
    }
  }

  // Combine back with non-violated results
  const finalResults = [...nonViolatedResults, ...processedViolations];

  logger.info("Heuristic evaluation deduplication completed", {
    studyId,
    originalViolationCount: violatedResults.length,
    finalViolationCount: processedViolations.length,
    violationsRemoved: violatedResults.length - processedViolations.length,
  });

  return finalResults;
}
