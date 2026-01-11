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
import { config } from "./config.ts";
import { getPresignedUrl } from "./s3Client.ts";
import { getFiles, getHeuristics, addHeuristicEvaluation } from "./dbWorkerClient.ts";
import { handleProcessingError } from "./errorHandler.ts";
import { withRetry } from "./withRetry.ts";
import { openAiBreaker } from "./circuitBreaker.ts";
import { deduplicateHeuristicEvaluation } from "./utils.ts";
import type {
  File,
  Heuristic,
  HEResultData,
  EvaluateOptions,
  EvaluationPayload,
} from "./types.ts";

// Schema for the object resulted by OpenAI
const heuristicEvaluationResultFormat = z.object({
  violated: z.boolean(),
  reason: z.string(),
  severity: z.number().int().min(0).max(4), // 0=not a problem, 1=cosmetic, 2=minor, 3=major, 4=catastrophe
  recommendations: z.array(
    z.object({
      recommendation: z.string(),
    })
  ),
});

// Initialize OpenAI
const openai = new OpenAI();

// ============================================================================
// OpenAI Evaluation
// ============================================================================

/**
 * Evaluate a single image against a heuristic using OpenAI
 */
async function evaluate(
  options: EvaluateOptions
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
        "heuristic_evaluation_format"
      ),
    },
  };

  logger.debug("Calling OpenAI API for heuristic evaluation", {
    model: params.model,
  });

  // Wrap OpenAI call with circuit breaker for fail-fast behavior
  const response: OpenAI.Responses.Response = await openAiBreaker.execute(() =>
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

// ============================================================================
// Prompt Generation
// ============================================================================

/**
 * Generate the prompt for heuristic evaluation
 */
function getPrompt(
  data: EvaluationPayload,
  heuristic: Heuristic,
  step: number,
  totalSteps: number,
  hasPrevScreen: boolean,
  hasNextScreen: boolean
): string {
  const flowContextSection =
    hasPrevScreen || hasNextScreen
      ? `
Flow Context:
This is screen ${step} of ${totalSteps} in a user flow.${hasPrevScreen ? " The previous screen is provided for context." : ""}${hasNextScreen ? " The next screen is provided for context." : ""}

**IMPORTANT:** You are evaluating ONLY the current screen (screen ${step}). The previous and next screens are provided solely to help you understand the flow context. Do NOT flag issues on the current screen if they are clearly addressed or resolved in the adjacent screens. For example:
- If the current screen appears to be missing information that is shown on the next screen, this is likely intentional flow design, not a violation.
- If an action on the current screen leads to appropriate feedback or resolution on the next screen, do not flag it as a violation.
- Focus your evaluation on genuine usability issues within the current screen that are not explained by the surrounding flow context.
`
      : "";

  return `# Role and Objective
  
You are a detail-oriented and skilled user experience (UX) researcher providing balanced yet critical evaluations of user interface (UI) designs. Your mission is to assess UI screens against established heuristics, identify heuristic violations, and give actionable, user-centered recommendations for improvement.

# Instructions
- Remain tightly focused on the provided user goal and context. Do not explore tangential opportunities or unrelated features.

## Context for Evaluation
- **User Goal:**
${data.goal || "Not specified"}

${
  data.user
    ? `- **Target User:**
${data.user}`
    : ""
}

${
  data.persona
    ? `- **Persona Details:**
Name: ${data.persona.name || ""}
Description: ${data.persona.description || ""}
` +
      (data.persona.data
        ? `Data (JSON):\n${JSON.stringify(data.persona.data, null, 2)}\n`
        : "")
    : ""
}

${
  data.context
    ? `- **Additional Context:**
${data.context}`
    : ""
}

${flowContextSection}

- **Heuristic:**
${heuristic.id}: ${heuristic.heuristic}${heuristic.label ? ` (${heuristic.label})` : ""}
${heuristic.description ? `\nDescription: ${heuristic.description}` : ""}${
    heuristic.examples && heuristic.examples.length > 0
      ? `\n\nExamples of violations:\n${heuristic.examples
          .map((ex) => `- ${ex.title || "Example"}: ${ex.example}`)
          .join("\n")}`
      : ""
  }

---
# Assessment Process

1. **Violation Check**
- State whether this heuristic is violated in this specific UI. (true/false)
- ${hasPrevScreen || hasNextScreen ? "Consider the flow context: if an apparent issue is resolved or addressed in adjacent screens, it may not be a true violation." : ""}

2. **Justification**
- Clearly explain why the heuristic was or was not violated.
- Focus on this specific UI issue only; avoid generic statements or simply stating "Yes".
- Discuss one issue at a time—do not combine multiple issues in one justification.
- Reference concrete UI/UX elements visible in the image (e.g., exact labels, field names, icons, layout, spacing, color/contrast, hierarchy, microcopy, affordances).
  - ${hasPrevScreen || hasNextScreen ? "If you considered adjacent screens, briefly explain how flow context influenced your assessment." : ""}

  3. **Severity Rating** (if a violation is found)
- Assign a severity (0–4) based on:
* Frequency of the problem
* Impact on users
* Persistence over repeated use
* Market Impact
- Use this scale:
* 0 = Not a problem
* 1 = Cosmetic only
* 2 = Minor usability problem
* 3 = Major usability problem
* 4 = Usability catastrophe

4. **Recommendations** (for violations)
- Propose specific, practical design improvements tied to exact UI/UX elements (use exact visible text/labels).
- Ensure suggestions are actionable and grounded in the user goal and context.

After each step, validate your assessment in 1-2 lines and proceed or revise if any step is incomplete or unsupported by visible evidence.

---

# Additional Notes
- Base your assessment only on what is visible in the provided image(s).
- Be concise yet thorough. Prioritize discoverability, learnability, and usability.
- Keep findings and recommendations aligned to the user goal and context.
- Evaluate the interface holistically, not just elements in isolation.
- Every justification and recommendation must reference one or more concrete UI/UX elements visible in the image (with exact labels/text where possible). Do not invent elements that are not visible.
${hasPrevScreen || hasNextScreen ? "Remember: Evaluate the CURRENT screen only. Adjacent screens are for context to avoid false positives." : ""}

Set reasoning_effort = medium for this evaluation; keep justifications and recommendations clear and precise.
`;
}

// ============================================================================
// Main Processing Function
// ============================================================================

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
    const heuristics = await getHeuristics(
      jobData.payload.heuristic,
      companyId
    );

    logger.debug("Retrieved heuristics for evaluation", {
      studyId: jobData.studyId,
      heuristicFamilyId: jobData.payload.heuristic,
      companyId,
      heuristicCount: heuristics.length,
    });

    const llm_responses: Array<HEResultData & { fileId: string; step: number }> = [];

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
      }))
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
            fileName: file.name,
            heuristicId: heuristic.id,
            progress: `${currentEvaluation}/${totalEvaluations}`,
            hasPrevScreen: !!prevFile,
            hasNextScreen: !!nextFile,
          });

          const prompt = getPrompt(
            jobData.payload,
            heuristic,
            step,
            totalSteps,
            !!prevFile,
            !!nextFile
          );

          // Use withRetry for the evaluation
          const response = await withRetry(
            async () => {
              if (!file.key) {
                throw new Error(
                  `File key is missing for file '${file.name}' (id: ${file.id})`
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
                fileName: file.name,
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
                fileName: file.name,
              },
            }
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
            (parsedResponse as Record<string, unknown>)?.heuristic_evaluation_format ?? parsedResponse;

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
        })
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
      jobData.payload.goal
    );

    // Add to database
    await addHeuristicEvaluation(jobData, deduplicatedResponses);
    logger.info("Heuristic evaluation added to database successfully", {
      studyId: jobData.studyId,
    });
  } catch (error) {
    await handleProcessingError(jobData, error, "heuristic evaluation");
  }
}
