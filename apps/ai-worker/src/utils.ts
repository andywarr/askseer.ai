// AWS imports
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// OpenAI imports
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";

// Zod imports
import { z } from "zod";

// Import logger
import { logger } from "@/apps/shared/logger.ts";

// Load environment variables
import dotenv from "dotenv";
dotenv.config();

// Initialize OpenAI
const openai = new OpenAI();

// Interfaces
export interface File {
  id: string;
  name: string;
  key: string | null;
  size: number;
  type: string;
}

// Get files for a study
export async function getFiles(studyId: string) {
  logger.debug("Fetching files for study", { studyId });

  // Get files
  const response = await fetch(
    `${process.env.DB_WORKER_URL}/api/files?studyId=${studyId}`
  );

  if (!response.ok) {
    logger.error("Failed to fetch files", {
      studyId,
      status: response.status,
      statusText: response.statusText,
    });
    throw new Error(
      `Failed to fetch files: ${response.status} ${response.statusText}`
    );
  }

  const { data: files } = await response.json();

  logger.debug("Files retrieved successfully", {
    studyId,
    fileCount: files?.length || 0,
    fileSizes: files?.map((f: File) => ({ name: f.name, size: f.size })) || [],
  });

  return files;
}

// Get a presigned URL for a file in S3
export async function getPresignedUrl(key: string) {
  logger.debug("Generating presigned URL", { key });

  const s3Client = new S3Client({ region: process.env.AWS_REGION });

  const command = new GetObjectCommand({
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: key, // Path to your image in S3
  });

  try {
    // Generate a pre-signed URL valid for 1 hour (3600 seconds)
    const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

    logger.debug("Presigned URL generated successfully", {
      key,
      urlLength: url.length,
      expiresIn: 3600,
    });

    return url;
  } catch (error) {
    logger.error("Error generating pre-signed URL", { error, key });
    throw error;
  }
}

// Update user credits
export async function updateCredits(
  userId: string,
  credits: number,
  studyId?: string
) {
  // Backward compat path: adjust user credits if no studyId provided
  if (!studyId) {
    logger.debug("Updating user credits", { userId, credits });
    const response = await fetch(
      `${process.env.DB_WORKER_URL}/api/updateCredits`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: userId, delta: credits }),
      }
    );
    if (!response.ok) {
      logger.error("Failed to update user credits", {
        userId,
        credits,
        status: response.status,
        statusText: response.statusText,
      });
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    logger.info("User credits updated successfully", {
      userId,
      creditsDelta: credits,
      newBalance: data.credits || "unknown",
    });
    return data;
  }
  // Preferred path: adjust team credits by study (refunds on error)
  logger.debug("Adjusting team credits by study", { studyId, userId, credits });
  const endpoint = credits >= 0 ? "refund" : "consume"; // negative consumes; positive refunds
  const res = await fetch(
    `${process.env.DB_WORKER_URL}/api/team/credits/${endpoint}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studyId, byUserId: userId }),
    }
  );
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    logger.error("Failed to adjust team credits by study", {
      studyId,
      userId,
      credits,
      status: res.status,
      body: body.slice(0, 200),
    });
    throw new Error("Failed to adjust team credits by study");
  }
  const data = await res.json();
  logger.info("Adjusted team credits by study", { studyId, userId, credits });
  return data;
}

// Update study status
export async function updateStatus(studyId: string, status: string) {
  logger.debug("Updating study status", { studyId, status });

  try {
    const response = await fetch(
      `${process.env.DB_WORKER_URL}/api/studyStatus`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ studyId: studyId, status: status }),
      }
    );

    if (!response.ok) {
      logger.error("Failed to update study status", {
        studyId,
        status,
        httpStatus: response.status,
        statusText: response.statusText,
      });
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    logger.info("Study status updated successfully", {
      studyId,
      newStatus: status,
      previousStatus: data.previousStatus || "unknown",
    });

    return data;
  } catch (error) {
    logger.error("Error updating study status", { error, studyId, status });
    throw error;
  }
}

// ============================================================================
// Deduplication utilities
// ============================================================================

// Schema for deduplication response - returns indices to keep
const deduplicationResponseSchema = z.object({
  indicesToKeep: z.array(z.number().int().min(0)),
  reasoning: z.string(),
});

interface DeduplicationItem {
  text: string;
  originalIndex: number;
}

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

  const prompt = `You are tasked with identifying duplicate or semantically equivalent ${itemType} from a UX evaluation. 

Review the following ${itemType} and identify which ones should be KEPT. Remove duplicates by keeping only the most comprehensive or well-articulated version when items are essentially saying the same thing.

${itemType.charAt(0).toUpperCase() + itemType.slice(1)} to analyze:
${deduplicationItems.map((item, i) => `[${i}]: ${item.text}`).join("\n")}

Return the indices of the items that should be KEPT (removing duplicates). When items are duplicates, keep the one that is:
1. More specific and actionable
2. Better articulated
3. More comprehensive

If two items are similar but address meaningfully different aspects, keep both.`;

  try {
    const response = await openai.responses.create({
      model: process.env.DEDUPE_MODEL || "gpt-5.1-2025-11-13",
      stream: false,
      input: [
        {
          role: "system",
          content:
            "You are an expert at identifying duplicate content. Be conservative - only mark items as duplicates if they are truly saying the same thing.",
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

    let parsedResponse: any;
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
      parsedResponse?.deduplication_response ?? parsedResponse;
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
// Cognitive Walkthrough Deduplication
// ============================================================================

interface CWRecommendationData {
  recommendation: string;
}

interface CWIssueData {
  issueType: string;
  issue: string;
  severity: number;
  recommendations: Array<CWRecommendationData>;
}

interface CWResultData {
  questionId: string;
  answer: string;
}

interface CWStepData {
  step: number;
  expected: boolean;
  results: Array<CWResultData>;
  issues: Array<CWIssueData>;
}

/**
 * Deduplicates issues and recommendations across all steps of a cognitive walkthrough.
 */
export async function deduplicateCognitiveWalkthrough(
  steps: CWStepData[],
  studyId: string
): Promise<CWStepData[]> {
  logger.info("Starting cognitive walkthrough deduplication", {
    studyId,
    stepCount: steps.length,
    totalIssues: steps.reduce((sum, step) => sum + step.issues.length, 0),
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

  if (allIssues.length <= 1) {
    logger.debug("Skipping deduplication - 1 or fewer issues", { studyId });
    return steps;
  }

  // Deduplicate issues
  const deduplicatedIssueEntries = await deduplicateWithLLM(
    allIssues,
    (entry) => `[${entry.issue.issueType}] ${entry.issue.issue}`,
    "issues",
    studyId
  );

  // Build a set of kept issue locations
  const keptIssues = new Set(
    deduplicatedIssueEntries.map(
      (entry) => `${entry.stepIndex}-${entry.issueIndex}`
    )
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

interface HEResultData {
  id: string;
  heuristic: string;
  violated: boolean;
  reason: string;
  severity: number;
  recommendations: Array<{ recommendation: string }>;
  fileId?: string;
  step?: number;
}

/**
 * Deduplicates issues and recommendations across all heuristic evaluation results.
 * Only processes violated heuristics.
 */
export async function deduplicateHeuristicEvaluation(
  results: HEResultData[],
  studyId: string
): Promise<HEResultData[]> {
  logger.info("Starting heuristic evaluation deduplication", {
    studyId,
    totalResults: results.length,
    violatedResults: results.filter((r) => r.violated).length,
  });

  // Separate violated and non-violated results
  const violatedResults = results.filter((r) => r.violated);
  const nonViolatedResults = results.filter((r) => !r.violated);

  if (violatedResults.length <= 1) {
    logger.debug("Skipping deduplication - 1 or fewer violations", { studyId });
    return results;
  }

  // Deduplicate violated results based on their reason/issue description
  const deduplicatedViolations = await deduplicateWithLLM(
    violatedResults,
    (result) => `[${result.heuristic}] ${result.reason}`,
    "heuristic violations",
    studyId
  );

  // Deduplicate recommendations within each violation
  for (const result of deduplicatedViolations) {
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
  const finalResults = [...nonViolatedResults, ...deduplicatedViolations];

  logger.info("Heuristic evaluation deduplication completed", {
    studyId,
    originalViolationCount: violatedResults.length,
    finalViolationCount: deduplicatedViolations.length,
    violationsRemoved: violatedResults.length - deduplicatedViolations.length,
  });

  return finalResults;
}
