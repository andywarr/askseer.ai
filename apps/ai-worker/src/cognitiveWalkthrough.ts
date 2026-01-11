/**
 * Cognitive Walkthrough Processing
 */

// OpenAI imports
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";

// Zod imports
import { z } from "zod";

// Import from shared modules
import { logger } from "@/apps/shared/logger.ts";
import type { JobEnvelopeV2_CW } from "@/apps/shared/jobSchema.ts";

// Import from local modules
import { config } from "./config.ts";
import { getPresignedUrl } from "./s3Client.ts";
import { getFiles, getCWQuestions, addCognitiveWalkthrough } from "./dbWorkerClient.ts";
import { handleProcessingError } from "./errorHandler.ts";
import { withRetry } from "./withRetry.ts";
import { openAiBreaker } from "./circuitBreaker.ts";
import { deduplicateCognitiveWalkthrough } from "./utils.ts";
import { buildCognitiveWalkthroughPrompt } from "./prompts/index.ts";
import type { CWStepData } from "./types.ts";

// ============================================================================
// Zod Schema
// ============================================================================

export const cognitiveWalkthroughResultFormat = z.object({
  results: z.object({
    step: z.number(),
    expected: z.boolean(),
    results: z.array(
      z.object({
        questionId: z.string(),
        answer: z.string(),
      })
    ),
    issues: z.array(
      z.object({
        issueType: z.union([
          z.literal("DISCOVERABILITY"),
          z.literal("LEARNABILITY"),
          z.literal("USABILITY"),
        ]),
        issue: z.string(),
        severity: z.number().int().min(0).max(4), // 0=not a problem, 1=cosmetic, 2=minor, 3=major, 4=catastrophe
        recommendations: z.array(
          z.object({
            recommendation: z.string(),
          })
        ),
      })
    ),
  }),
});

// Initialize OpenAI
const openai = new OpenAI();

// ============================================================================
// OpenAI Evaluation
// ============================================================================

/**
 * Evaluate a single step using OpenAI
 */
async function evaluate(
  image_url: string,
  prompt: string
): Promise<OpenAI.Responses.Response> {
  const evaluationStartTime = Date.now();
  logger.debug("Processing image for cognitive walkthrough", {
    image_url: image_url.substring(0, 100) + "...",
    promptLength: prompt.length,
  });

  const userContent = [
    {
      type: "input_text" as const,
      text: prompt,
    },
    {
      type: "input_image" as const,
      image_url,
      detail: "high" as const,
    },
  ];

  const params: OpenAI.Responses.ResponseCreateParamsNonStreaming = {
    model: config.models.cognitiveWalkthrough,
    stream: false,
    input: [
      {
        role: "system",
        content:
          "You are a detail-oriented, skilled user experience researcher who provides a balanced, but critical view evaluating designs and experiences",
      },
      {
        role: "user",
        content: userContent,
      },
    ],
    text: {
      format: zodTextFormat(
        cognitiveWalkthroughResultFormat,
        "cognitive_walkthrough_format"
      ),
    },
  };

  logger.debug("Calling OpenAI API for cognitive walkthrough", {
    model: params.model,
  });

  // Wrap OpenAI call with circuit breaker for fail-fast behavior
  const response = await openAiBreaker.execute(() =>
    openai.responses.create(params)
  );

  const evaluationDuration = Date.now() - evaluationStartTime;
  logger.debug("OpenAI API call completed", {
    evaluationDuration,
    tokensUsed: response.usage?.total_tokens || "unknown",
    status: response.status,
  });

  return response;
}

export async function processCognitiveWalkthrough(jobData: JobEnvelopeV2_CW) {
  logger.info("Processing cognitive walkthrough", {
    studyId: jobData.studyId,
    userId: jobData.userId,
    goal: jobData.payload.goal,
  });

  try {
    // Get the files from the database
    const files = await getFiles(jobData.studyId);

    logger.debug("Retrieved files for cognitive walkthrough", {
      studyId: jobData.studyId,
      fileCount: files.length,
    });

    // Get the questions
    const questions = await getCWQuestions(1);

    logger.debug("Retrieved cognitive walkthrough questions", {
      studyId: jobData.studyId,
      questionCount: questions.length,
    });

    const llm_responses: CWStepData[] = [];

    logger.info("Starting cognitive walkthrough steps", {
      studyId: jobData.studyId,
      totalSteps: files.length,
    });

    const processStep = async (index: number): Promise<CWStepData> => {
      const file = files[index];

      if (!file.key) {
        throw new Error(
          `File key is missing for file '${file.name}' (id: ${file.id})`
        );
      }
      const image_url = await getPresignedUrl(file.key);

      logger.debug("Processing cognitive walkthrough step", {
        studyId: jobData.studyId,
        stepNumber: index + 1,
        totalSteps: files.length,
        fileName: file.name,
      });

      // Use the previous step's expectation answer when available.
      const previousAnswer =
        llm_responses?.[llm_responses.length - 1]?.results?.[2]?.answer || "";

      const prompt = buildCognitiveWalkthroughPrompt({
        data: jobData.payload,
        questions,
        step: index,
        totalSteps: files.length,
        lastLlmResponse: previousAnswer,
      });

      // Use withRetry for the OpenAI call
      const response = await withRetry(
        () => evaluate(image_url, prompt),
        {
          maxAttempts: config.processing.cwMaxAttempts,
          operationName: "Cognitive walkthrough evaluation",
          context: {
            studyId: jobData.studyId,
            step: index + 1,
            fileName: file.name,
          },
        }
      );

      const rawContent = response.output_text?.trim();
      if (!rawContent) {
        throw new Error(
          "OpenAI response missing content for cognitive walkthrough"
        );
      }

      let parsedResponse: unknown;
      try {
        parsedResponse = JSON.parse(rawContent);
      } catch (e) {
        logger.error("Failed to parse OpenAI response as JSON", {
          studyId: jobData.studyId,
          step: index + 1,
          contentPreview: String(rawContent).slice(0, 200),
        });
        throw e;
      }

      const maybeWrapped =
        (parsedResponse as Record<string, unknown>)?.cognitive_walkthrough_format ?? parsedResponse;
      const validated =
        cognitiveWalkthroughResultFormat.safeParse(maybeWrapped);
      if (!validated.success) {
        logger.error("OpenAI response failed schema validation", {
          studyId: jobData.studyId,
          step: index + 1,
          issues: validated.error.issues,
        });
        throw new Error("Invalid cognitive walkthrough response format");
      }

      logger.debug("Validated CW step response", {
        studyId: jobData.studyId,
        step: index + 1,
        resultsCount: validated.data.results.results?.length ?? 0,
        issuesCount: validated.data.results.issues?.length ?? 0,
      });
      return validated.data.results as CWStepData;
    };

    logger.info("Running CW in sequential mode", {
      studyId: jobData.studyId,
      steps: files.length,
    });
    for (let i = 0; i < files.length; i++) {
      const step = await processStep(i);
      llm_responses.push(step);
    }

    logger.debug("Cognitive walkthrough LLM responses generated", {
      responseCount: llm_responses.length,
      studyId: jobData.studyId,
    });

    // Deduplicate issues and recommendations across all steps, filtering by goal relevance
    const deduplicatedResponses = await deduplicateCognitiveWalkthrough(
      llm_responses,
      jobData.studyId,
      jobData.payload.goal
    );

    // Add to database
    await addCognitiveWalkthrough(jobData, deduplicatedResponses);
    logger.info("Cognitive walkthrough added to database successfully", {
      studyId: jobData.studyId,
    });
  } catch (error) {
    await handleProcessingError(jobData, error, "cognitive walkthrough");
  }
}
