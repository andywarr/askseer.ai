/**
 * UI Inference Utilities
 *
 * Infers goal and study name from uploaded screenshots.
 * Used by both heuristic evaluation and cognitive walkthrough jobs
 * when the user doesn't provide this information.
 */

import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";

import { logger } from "@/apps/shared/logger.ts";
import { config } from "../config.ts";
import { getPresignedUrl } from "./s3Client.ts";
import { openAiBreaker } from "./circuitBreaker.ts";
import { withRetry } from "./withRetry.ts";
import type { File } from "../types.ts";
import { getLanguageName } from "../prompts/utils.ts";

// Initialize OpenAI
const openai = new OpenAI();




// ============================================================================
// Schemas
// ============================================================================

const InferredGoalSchema = z.object({
  goal: z.string().min(5).max(500),
});

const StudyNameSchema = z.object({
  name: z.string().min(2).max(80),
});

// ============================================================================
// Goal Inference
// ============================================================================

/**
 * Select representative screenshots from the flow for inference.
 * Picks the first, middle, and last images to capture the flow's
 * beginning, midpoint, and end.
 */
function selectRepresentativeFiles(files: File[]): File[] {
  if (files.length <= 3) return files;

  const first = files[0];
  const middle = files[Math.floor(files.length / 2)];
  const last = files[files.length - 1];

  return [first, middle, last];
}

/**
 * Infer the user's goal from uploaded screenshots.
 * Sends representative images to the LLM and asks it to determine
 * what the user is trying to accomplish in this flow.
 *
 * Throws an error if inference fails — the study cannot proceed
 * without a goal.
 */
export async function inferGoalFromScreenshots(
  files: File[],
  studyId: string,
  studyType: "heuristic evaluation" | "cognitive walkthrough",
  locale?: string,
): Promise<string> {
  const representativeFiles = selectRepresentativeFiles(files);

  logger.info("Inferring goal from screenshots", {
    studyId,
    studyType,
    totalFiles: files.length,
    sampledFiles: representativeFiles.length,
  });

  // Build image content for the LLM
  const imageContent: Array<
    | { type: "input_text"; text: string }
    | { type: "input_image"; image_url: string; detail: "low" }
  > = [];

  for (let i = 0; i < representativeFiles.length; i++) {
    const file = representativeFiles[i];
    if (!file.key) continue;

    const presignedUrl = await getPresignedUrl(file.key);
    imageContent.push({
      type: "input_text" as const,
      text: `Screen ${i + 1} of ${representativeFiles.length}:`,
    });
    imageContent.push({
      type: "input_image" as const,
      image_url: presignedUrl,
      detail: "low" as const,
    });
  }

  if (imageContent.length === 0) {
    throw new Error(
      "No valid screenshot files available for goal inference",
    );
  }

  const response = await openAiBreaker.execute(() =>
    withRetry(
      async () => {
        const result = await openai.responses.create({
          model: config.models.persona,
          stream: false,
          input: [
            {
              role: "system" as const,
              content: `You are an expert UX researcher. You are shown screenshots from a user interface flow that will be used for a ${studyType}. Your task is to infer the user's goal — what is the user trying to accomplish in this flow?

Analyze the screens to understand:
- What application or product is being shown
- What task or workflow the screens represent
- What the user would be trying to achieve

Return a clear, concise goal statement (1-2 sentences) that describes what the user is trying to accomplish. Write it from the user's perspective, e.g., "Sign up for a new account and complete the onboarding process" or "Find and purchase a product from the marketplace".

IMPORTANT: The inferred goal MUST be written in ${getLanguageName(locale)}.`,
            },
            {
              role: "user" as const,
              content: imageContent,
            },
          ],
          text: {
            format: zodTextFormat(InferredGoalSchema, "inferred_goal"),
          },
        });
        return result;
      },
      {
        maxAttempts: 3,
        operationName: `goal-inference-${studyId}`,
      },
    ),
  );

  const outputText = response.output_text?.trim();
  if (!outputText) {
    throw new Error("Goal inference returned empty response");
  }

  const parsed = JSON.parse(outputText) as z.infer<typeof InferredGoalSchema>;
  const inferredGoal = parsed.goal;

  logger.info("Goal inferred from screenshots", {
    studyId,
    inferredGoal,
  });

  return inferredGoal;
}

// ============================================================================
// Study Name Generation
// ============================================================================

/**
 * Generate a concise study name from a goal.
 * Returns undefined if generation fails (non-critical).
 */
export async function generateStudyName(
  goal: string,
  studyId: string,
  locale?: string,
): Promise<string | undefined> {
  try {
    logger.info("Generating study name from goal", { studyId });

    const response = await openAiBreaker.execute(() =>
      openai.responses.create({
        model: config.models.persona,
        stream: false,
        input: [
          {
            role: "system" as const,
            content:
              `You create concise, descriptive study names for UX research. Return only JSON matching the schema. The name should be short (2-6 words), descriptive, and capture the essence of the research goal. Do not use generic names like 'User Study' or 'Research Project'.

IMPORTANT: The generated study name MUST be written in ${getLanguageName(locale)}.`,
          },
          {
            role: "user" as const,
            content: `Research goal: ${goal}`,
          },
        ],
        text: {
          format: zodTextFormat(StudyNameSchema, "study_name"),
        },
      }),
    );

    const outputText = response.output_text?.trim();
    if (!outputText) return undefined;

    const parsed = StudyNameSchema.parse(JSON.parse(outputText));

    logger.info("Generated study name", {
      studyId,
      studyName: parsed.name,
    });

    return parsed.name;
  } catch (e) {
    logger.warn("Failed to generate study name, continuing without", {
      studyId,
      error: (e as Error).message,
    });
    return undefined;
  }
}
