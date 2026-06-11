/**
 * Heuristic Evaluation Processing
 */

// OpenAI imports
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";

// Zod imports
import { z } from "zod";

// Import from shared modules
import { logger } from "@/apps/shared/logger.ts";
import type { JobEnvelopeV2_HE } from "@/apps/shared/jobSchema.ts";

// Import from local modules
import { config } from "../config.ts";
import { getPresignedUrl } from "../lib/s3Client.ts";
import {
  getFiles,
  getHeuristics,
  addHeuristicEvaluation,
} from "../lib/dbWorkerClient.ts";
import { handleProcessingError } from "../lib/errorHandler.ts";
import { withRetry } from "../lib/withRetry.ts";
import { openAiBreaker } from "../lib/circuitBreaker.ts";
import { deduplicateHeuristicEvaluation } from "../lib/utils.ts";
import {
  inferGoalFromScreenshots,
  generateStudyName,
} from "../lib/inference.ts";
import { getLanguageName } from "../prompts/utils.ts";
import { buildHeuristicEvaluationPrompt } from "../prompts/index.ts";
import type {
  File,
  Heuristic,
  HEResultData,
  EvaluateOptions,
} from "../types.ts";

// Schema for the object resulted by OpenAI
const heuristicEvaluationResultFormat = z.object({
  violated: z.boolean(),
  reason: z.string(),
  severity: z.number().int().min(0).max(4), // 0=not a problem, 1=cosmetic, 2=minor, 3=major, 4=catastrophe
  recommendations: z.array(
    z.object({
      recommendation: z.string(),
    }),
  ),
});

// Initialize OpenAI
const openai = new OpenAI();

// Cache for translated heuristics in process memory
// Key: `${heuristicId}-${locale}`
const workerHeuristicCache = new Map<string, Heuristic>();

async function translateHeuristicsForWorker(
  heuristics: Heuristic[],
  locale?: string,
): Promise<Heuristic[]> {
  if (!locale || locale.toLowerCase().startsWith("en")) {
    return heuristics;
  }

  const language = getLanguageName(locale);
  if (language === "English") {
    return heuristics;
  }

  const translatedList: Heuristic[] = [];
  const toTranslate: Heuristic[] = [];

  for (const h of heuristics) {
    const cacheKey = `${h.id}-${locale}`;
    if (workerHeuristicCache.has(cacheKey)) {
      translatedList.push(workerHeuristicCache.get(cacheKey)!);
    } else {
      toTranslate.push(h);
    }
  }

  if (toTranslate.length === 0) {
    return heuristics.map(h => workerHeuristicCache.get(`${h.id}-${locale}`) || h);
  }

  try {
    logger.info(`Translating ${toTranslate.length} heuristics to ${language} for evaluation prompt...`);
    
    const TranslatedHeuristicSchema = z.object({
      id: z.string(),
      heuristic: z.string(),
      label: z.string().optional().nullable(),
      description: z.string().optional().nullable(),
      examples: z.array(z.object({
        id: z.string(),
        title: z.string().optional().nullable(),
        example: z.string()
      })).optional().nullable()
    });

    const BatchTranslationSchema = z.object({
      heuristics: z.array(TranslatedHeuristicSchema)
    });

    const response = await openAiBreaker.execute(() =>
      openai.responses.create({
        model: config.models.qualitativeAnalysis,
        stream: false,
        input: [
          {
            role: "system" as const,
            content: `You are a professional translator and UX research expert. Your task is to translate the provided UX heuristic definitions (including the heuristic text, label/title, its description, and examples of violations) into ${language}.
Keep all technical context, short labels (like "H1"), and references exact. Return only the JSON matching the schema.`,
          },
          {
            role: "user" as const,
            content: JSON.stringify(toTranslate.map(h => ({
              id: h.id,
              heuristic: h.heuristic,
              label: h.label,
              description: h.description,
              examples: h.examples
            }))),
          },
        ],
        text: {
          format: zodTextFormat(BatchTranslationSchema, "batch_translation"),
        },
      })
    );

    const outputText = response.output_text?.trim();
    if (outputText) {
      const parsed = BatchTranslationSchema.parse(JSON.parse(outputText));
      for (const th of parsed.heuristics) {
        const original = toTranslate.find(o => o.id === th.id);
        const translated: Heuristic = {
          id: th.id,
          heuristic: th.heuristic,
          label: th.label ?? original?.label,
          description: th.description ?? undefined,
          examples: th.examples ? th.examples.map(ex => ({
            id: ex.id,
            title: ex.title ?? undefined,
            example: ex.example
          })) : undefined
        };
        workerHeuristicCache.set(`${th.id}-${locale}`, translated);
      }
    } else {
      logger.warn("OpenAI returned empty response for heuristic translation; falling back to English");
      return heuristics;
    }
  } catch (e) {
    logger.error("Failed to translate heuristics for evaluation prompt, falling back to English", {
      error: (e as Error).message
    });
    return heuristics;
  }

  return heuristics.map(h => workerHeuristicCache.get(`${h.id}-${locale}`) || h);
}

// ============================================================================
// OpenAI Evaluation
// ============================================================================

/**
 * Evaluate a single image against a heuristic using OpenAI
 */
async function evaluate(
  options: EvaluateOptions,
): Promise<OpenAI.Responses.Response> {
  const { image_url, prompt, prevImageUrl, nextImageUrl } = options;
  const evaluationStartTime = Date.now();
  logger.debug("Processing image for heuristic evaluation", {
    image_url: image_url.substring(0, 100) + "...",
    promptLength: prompt.length,
    hasPrevImage: !!prevImageUrl,
    hasNextImage: !!nextImageUrl,
  });

  const userContent: Array<
    | { type: "input_text"; text: string }
    | { type: "input_image"; image_url: string; detail: "high" }
  > = [
    {
      type: "input_text" as const,
      text: prompt,
    },
  ];

  // Add previous screen for context if available
  if (prevImageUrl) {
    userContent.push({
      type: "input_text" as const,
      text: "**Previous Screen (for context only — do NOT evaluate this screen):**",
    });
    userContent.push({
      type: "input_image" as const,
      image_url: prevImageUrl,
      detail: "high" as const,
    });
  }

  // Add the main screen to evaluate
  userContent.push({
    type: "input_text" as const,
    text:
      prevImageUrl || nextImageUrl
        ? "**Current Screen (EVALUATE THIS SCREEN):**"
        : "",
  });
  userContent.push({
    type: "input_image" as const,
    image_url,
    detail: "high" as const,
  });

  // Add next screen for context if available
  if (nextImageUrl) {
    userContent.push({
      type: "input_text" as const,
      text: "**Next Screen (for context only — do NOT evaluate this screen):**",
    });
    userContent.push({
      type: "input_image" as const,
      image_url: nextImageUrl,
      detail: "high" as const,
    });
  }

  const params: OpenAI.Responses.ResponseCreateParamsNonStreaming = {
    model: config.models.heuristicEvaluation,
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
        heuristicEvaluationResultFormat,
        "heuristic_evaluation_format",
      ),
    },
  };

  logger.debug("Calling OpenAI API for heuristic evaluation", {
    model: params.model,
  });

  // Wrap OpenAI call with circuit breaker for fail-fast behavior
  const response: OpenAI.Responses.Response = await openAiBreaker.execute(() =>
    openai.responses.create(params),
  );

  const evaluationDuration = Date.now() - evaluationStartTime;
  logger.debug("OpenAI API call completed", {
    evaluationDuration,
    tokensUsed: response.usage?.total_tokens || "unknown",
    status: response.status,
  });

  return response;
}

// ============================================================================
// Concurrency Limiter
// ============================================================================

/**
 * Simple concurrency limiter that schedules async work up to a ceiling and
 * starts new jobs as soon as a slot frees up.
 */
function createConcurrencyLimiter(limit: number) {
  const max =
    Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : Infinity;
  if (max === Infinity) {
    return async <T>(fn: () => Promise<T>): Promise<T> => fn();
  }

  let active = 0;
  const queue: Array<() => void> = [];

  const runNext = () => {
    if (active >= max) {
      return;
    }
    const next = queue.shift();
    if (!next) {
      return;
    }
    next();
  };

  return async function withLimit<T>(fn: () => Promise<T>): Promise<T> {
    if (active >= max) {
      await new Promise<void>((resolve) => queue.push(resolve));
    }

    active++;
    try {
      return await fn();
    } finally {
      active--;
      runNext();
    }
  };
}

export async function processHeuristicEvaluation(jobData: JobEnvelopeV2_HE) {
  logger.info("Processing heuristic evaluation", {
    studyId: jobData.studyId,
    heuristicFamilyId: jobData.payload.heuristic,
    userId: jobData.userId,
    teamId: jobData.teamId,
    companyId: jobData.companyId,
  });

  try {
    if (!jobData.payload.heuristic) {
      throw new Error("Heuristic family ID not provided");
    }

    // Use companyId from jobData (passed from frontend)
    const companyId = jobData.companyId || null;

    // Get the files from the database
    const files = await getFiles(jobData.studyId);

    logger.debug("Retrieved files for heuristic evaluation", {
      studyId: jobData.studyId,
      fileCount: files.length,
    });

    // Get the heuristics from the database, passing companyId for access control
    const dbHeuristics = await getHeuristics(
      jobData.payload.heuristic,
      companyId,
    );

    // Translate heuristics to the study locale if needed
    const heuristics = await translateHeuristicsForWorker(
      dbHeuristics,
      jobData.locale,
    );

    logger.debug("Retrieved heuristics for evaluation", {
      studyId: jobData.studyId,
      heuristicFamilyId: jobData.payload.heuristic,
      companyId,
      heuristicCount: heuristics.length,
    });

    // ========================================
    // Infer goal from screenshots if not provided
    // ========================================
    let inferredGoal: string | undefined;
    let generatedStudyName: string | undefined;

    const effectiveGoal = jobData.payload.goal?.trim() || undefined;

    if (!effectiveGoal) {
      inferredGoal = await inferGoalFromScreenshots(
        files,
        jobData.studyId,
        "heuristic evaluation",
        jobData.locale,
      );
    }

    const goalForProcessing = effectiveGoal || inferredGoal!;

    // Generate study name if not provided
    const providedName = jobData.payload.name?.trim();
    if (!providedName) {
      generatedStudyName = await generateStudyName(
        goalForProcessing,
        jobData.studyId,
        jobData.locale,
      );
    }

    const llm_responses: Array<
      HEResultData & { fileId: string; step: number }
    > = [];

    const totalEvaluations = files.length * heuristics.length;
    let completedEvaluations = 0;

    logger.info("Starting heuristic evaluations", {
      studyId: jobData.studyId,
      totalEvaluations,
      fileCount: files.length,
      heuristicCount: heuristics.length,
    });

    const concurrency = config.processing.heEvalConcurrency;
    const maxAttempts = config.processing.heMaxAttempts;

    // Create evaluation tasks with file references and adjacent file info
    const evaluationTasks = files.flatMap((file: File, index: number) =>
      heuristics.map((heuristic: Heuristic) => ({
        file,
        heuristic,
        step: index + 1,
        totalSteps: files.length,
        prevFile: index > 0 ? files[index - 1] : null,
        nextFile: index < files.length - 1 ? files[index + 1] : null,
      })),
    );

    const limit = createConcurrencyLimiter(concurrency);

    const evaluationPromises = evaluationTasks.map(
      ({
        file,
        heuristic,
        step,
        totalSteps,
        prevFile,
        nextFile,
      }: {
        file: File;
        heuristic: Heuristic;
        step: number;
        totalSteps: number;
        prevFile: File | null;
        nextFile: File | null;
      }) =>
        limit(async () => {
          const currentEvaluation = ++completedEvaluations;
          logger.debug("Processing heuristic evaluation", {
            studyId: jobData.studyId,
            fileName: file.originalName,
            heuristicId: heuristic.id,
            progress: `${currentEvaluation}/${totalEvaluations}`,
            hasPrevScreen: !!prevFile,
            hasNextScreen: !!nextFile,
          });

          const prompt = buildHeuristicEvaluationPrompt({
            data: { ...jobData.payload, goal: goalForProcessing, locale: jobData.locale },
            heuristic,
            step,
            totalSteps,
            hasPrevScreen: !!prevFile,
            hasNextScreen: !!nextFile,
          });

          // Use withRetry for the evaluation
          const response = await withRetry(
            async () => {
              if (!file.key) {
                throw new Error(
                  `File key is missing for file '${file.originalName}' (id: ${file.id})`,
                );
              }
              const image_url = await getPresignedUrl(file.key);

              // Get presigned URLs for adjacent screens (for context)
              let prevImageUrl: string | undefined;
              let nextImageUrl: string | undefined;

              if (prevFile?.key) {
                prevImageUrl = await getPresignedUrl(prevFile.key);
              }
              if (nextFile?.key) {
                nextImageUrl = await getPresignedUrl(nextFile.key);
              }

              logger.debug("Generated fresh presigned URL for evaluation", {
                studyId: jobData.studyId,
                fileName: file.originalName,
                heuristicId: heuristic.id,
                hasPrevImage: !!prevImageUrl,
                hasNextImage: !!nextImageUrl,
              });

              return evaluate({
                image_url,
                prompt,
                prevImageUrl,
                nextImageUrl,
              });
            },
            {
              maxAttempts,
              operationName: "Heuristic evaluation",
              context: {
                studyId: jobData.studyId,
                heuristicId: heuristic.id,
                fileId: file.id,
                fileName: file.originalName,
              },
            },
          );

          const outputText = response.output_text?.trim();
          if (!outputText) {
            throw new Error("Error processing heuristic evaluation");
          }

          let parsedResponse: unknown;
          try {
            parsedResponse = JSON.parse(outputText);
          } catch (e) {
            logger.error("Failed to parse OpenAI response as JSON", {
              studyId: jobData.studyId,
              heuristicId: heuristic.id,
              fileId: file.id,
              contentPreview: String(outputText).slice(0, 200),
            });
            throw e;
          }

          // Unwrap if needed (OpenAI sometimes wraps in format name)
          const maybeWrapped =
            (parsedResponse as Record<string, unknown>)
              ?.heuristic_evaluation_format ?? parsedResponse;

          // Validate against schema
          const validated =
            heuristicEvaluationResultFormat.safeParse(maybeWrapped);
          if (!validated.success) {
            logger.error("OpenAI response failed schema validation", {
              studyId: jobData.studyId,
              heuristicId: heuristic.id,
              fileId: file.id,
              issues: validated.error.issues,
              response: maybeWrapped,
            });
            throw new Error("Invalid heuristic evaluation response format");
          }

          const validatedData = validated.data;

          return {
            id: heuristic.id,
            heuristic: heuristic.heuristic,
            violated: validatedData.violated,
            reason: validatedData.reason,
            severity: validatedData.severity,
            recommendations: validatedData.recommendations,
            fileId: file.id,
            step,
          };
        }),
    );

    const evaluationResults = await Promise.all(evaluationPromises);

    llm_responses.push(...evaluationResults);

    logger.debug("Heuristic evaluation LLM responses generated", {
      responseCount: llm_responses.length,
      studyId: jobData.studyId,
    });

    // Deduplicate violations and recommendations, filtering by goal relevance
    const deduplicatedResponses = await deduplicateHeuristicEvaluation(
      llm_responses,
      jobData.studyId,
      goalForProcessing,
    );

    // Add to database
    await addHeuristicEvaluation(
      jobData,
      deduplicatedResponses,
      inferredGoal,
      generatedStudyName,
    );
    logger.info("Heuristic evaluation added to database successfully", {
      studyId: jobData.studyId,
    });
  } catch (error) {
    await handleProcessingError(jobData, error, "heuristic evaluation");
  }
}
