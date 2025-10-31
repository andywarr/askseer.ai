// OpenAI imports
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";

// Zod imports
import { z } from "zod";

// Import logger
import { logger } from "@/apps/shared/logger.ts";
import type { JobEnvelopeV2_HE } from "@/apps/shared/jobSchema.ts";

// Load environment variables
import dotenv from "dotenv";
dotenv.config();

// Import utility functions
import {
  File,
  getFiles,
  getPresignedUrl,
  updateCredits,
  updateStatus,
} from "@/apps/ai-worker/src/utils.ts";

interface Heuristic {
  id: string;
  heuristic: string;
  label?: string;
  description?: string;
  examples?: Array<{
    id: string;
    title?: string;
    example: string;
  }>;
}

// Using v2-only NormalizedJob envelope

interface ResultData {
  id: string;
  heuristic: string;
  violated: boolean;
  reason: string;
  recommendations: string;
}

// Schema for the object resulted by OpenAI
const heuristicEvaluationResultFormat = z.object({
  violated: z.boolean(),
  reason: z.string(),
  recommendations: z.array(
    z.object({
      recommendation: z.string(),
    })
  ),
});

// Initialize OpenAI
const openai = new OpenAI();

// Function to add heuristic evaluation to the database
async function addHeuristicEvaluation(
  jobData: JobEnvelopeV2_HE,
  llm_responses: Array<ResultData>
) {
  logger.info("Saving heuristic evaluation to database", {
    studyId: jobData.studyId,
    responseCount: llm_responses.length,
  });

  const response = await fetch(
    `${process.env.DB_WORKER_URL}/api/heuristicEvaluation`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ studyData: jobData, results: llm_responses }),
    }
  );

  if (!response.ok) {
    logger.error("Failed to save heuristic evaluation to database", {
      studyId: jobData.studyId,
      status: response.status,
      statusText: response.statusText,
    });
    throw new Error(
      `Error adding heuristic evaluation to database: ${response.status}`
    );
  }

  logger.info("Heuristic evaluation saved to database successfully", {
    studyId: jobData.studyId,
  });
}

// Function to evaluate the heuristics
async function evaluate(
  image_url: string,
  prompt: string
): Promise<OpenAI.Responses.Response> {
  const evaluationStartTime = Date.now();
  logger.debug("Processing image for heuristic evaluation", {
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
    model: process.env.HE_EVAL_MODEL || "gpt-5-2025-08-07",
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

  const response: OpenAI.Responses.Response =
    await openai.responses.create(params);

  const evaluationDuration = Date.now() - evaluationStartTime;
  logger.debug("OpenAI API call completed", {
    evaluationDuration,
    tokensUsed: response.usage?.total_tokens || "unknown",
    status: response.status,
  });

  return response;
}

// Simple concurrency limiter that schedules async work up to a ceiling and
// starts new jobs as soon as a slot frees up.
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

async function getHeuristics(familyId: string, companyId?: string | null) {
  logger.debug("Fetching heuristics", { familyId, companyId });

  // Get heuristics by family ID, including companyId for access control
  const url = new URL(`${process.env.DB_WORKER_URL}/api/heuristics`);
  url.searchParams.append("familyId", familyId);
  if (companyId) {
    url.searchParams.append("companyId", companyId);
  }

  const response = await fetch(url.toString());

  if (!response.ok) {
    logger.error("Failed to fetch heuristics", {
      familyId,
      companyId,
      status: response.status,
      statusText: response.statusText,
    });
    throw new Error(`Failed to fetch heuristics: ${response.status}`);
  }

  const { data: heuristics } = await response.json();

  logger.debug("Heuristics retrieved successfully", {
    familyId,
    companyId,
    heuristicCount: heuristics?.length || 0,
  });

  return heuristics as Heuristic[];
}

function getPrompt(data: any, heuristic: any) {
  return `You are a detail-oriented, skilled user experience researcher who provides balanced yet critical evaluations of designs and experiences. You have been tasked with assessing a series of user interface (UI) designs against established a set of heuristics. Your objective is to identify any heuristic violations and provide actionable, user-centered recommendations for improvement.

Stay tightly focused on the stated user goal and context; do not explore tangential opportunities or unrelated features.

Context for the Evaluation:
  
User Goal:
\`\`\`
${data.goal}
\`\`\`

${
  data.user
    ? `Target User:
\`\`\`
${data.user}
\`\`\``
    : ""
}

${
  data.context
    ? `Additional Context:
\`\`\`
${data.context}
\`\`\``
    : ""
}

${
  data.persona
    ? `Persona Details:
Name: ${data.persona.name || ""}
Description: ${data.persona.description || ""}
` +
      (data.persona.data
        ? `Data (JSON):\n\`\`\`\n${JSON.stringify(data.persona.data, null, 2)}\n\`\`\``
        : "")
    : ""
}

${
  data.context
    ? `Additional Context:
\`\`\`
${data.context}
\`\`\``
    : ""
}

Heuristic:
\`\`\`
${heuristic.id}: ${heuristic.heuristic}${heuristic.label ? ` (${heuristic.label})` : ""}
${heuristic.description ? `\nDescription: ${heuristic.description}` : ""}${
    heuristic.examples && heuristic.examples.length > 0
      ? `\n\nExamples of violations:\n${heuristic.examples
          .map((ex: any) => `- ${ex.title || "Example"}: ${ex.example}`)
          .join("\n")}`
      : ""
  }
\`\`\`

---

Instructions:

Target User Focus:
- Ground every decision, justification, and recommendation in the needs, abilities, and context of the target user described above. If no target user information is provided, proceed without assuming a specific user profile.

For the attached UI design:

1. Violation Check
   - Was this heuristic violated in this specific UI? (true/false)

2. Justification
  - Clearly explain why the heuristic was or was not violated.
  - There is no need to state the heuristic is violdated e.g., "Yes"; focus solely on this specific issue.
  - Focus on one issue at a time. Do not mix multiple issues in one justification.
  - Reference concrete UI/UX elements visible in the image (e.g., exact button/link labels, field names, iconography, layout/position, spacing, color/contrast, visual hierarchy, microcopy, interaction/affordances). Avoid generic statements.

3. Recommendations (if a violation exists)
  - Suggest concrete design improvements or changes to resolve the violation.
  - Tie each recommendation to the specific UI/UX element(s) it affects and use the elements' exact visible labels/text when possible.
  - Keep your suggestions practical and feasible given the user goal and context above.

---

Notes:
- Base your assessment only on what is visible in the provided image.
- Be concise but thorough. Focus on discoverability, learnability, and usability.
- Keep your findings and recommendations tightly aligned with the stated user goal and context.
- Consider the entire interface, not just individual components in isolation.
- Every justification and recommendation MUST reference one or more concrete UI/UX elements visible in the image (use exact labels/text when available). Do not invent elements that are not visible.
`;
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

    // Get presigned URLs for all the files
    logger.debug("Generating presigned URLs for files", {
      studyId: jobData.studyId,
    });

    const presignedUrls: string[] = await Promise.all(
      files.map((file: File) => (file.key ? getPresignedUrl(file.key) : ""))
    );

    const llm_responses = [] as any[];

    const totalEvaluations = files.length * heuristics.length;
    let completedEvaluations = 0;

    logger.info("Starting heuristic evaluations", {
      studyId: jobData.studyId,
      totalEvaluations,
      fileCount: files.length,
      heuristicCount: heuristics.length,
    });

    const concurrency = Number(process.env.HE_EVAL_CONCURRENCY || 3);
    const maxAttempts = Number(process.env.HE_MAX_ATTEMPTS || 3);

    const evaluationTasks = presignedUrls.flatMap((url, index) =>
      heuristics.map((heuristic) => ({
        url,
        file: files[index],
        heuristic,
        step: index + 1,
      }))
    );

    const limit = createConcurrencyLimiter(concurrency);

    const evaluationPromises = evaluationTasks.map(
      ({ url, file, heuristic, step }) =>
        limit(async () => {
          const currentEvaluation = ++completedEvaluations;
          logger.debug("Processing heuristic evaluation", {
            studyId: jobData.studyId,
            fileName: file.name,
            heuristicId: heuristic.id,
            progress: `${currentEvaluation}/${totalEvaluations}`,
          });

          const prompt = getPrompt(jobData.payload, heuristic);

          let response: any;
          let attempts = 0;

          while (attempts < maxAttempts) {
            try {
              attempts++;
              response = await evaluate(url, prompt);
              break;
            } catch (error) {
              if (attempts === maxAttempts) {
                logger.error(
                  `Failed to evaluate heuristic after ${maxAttempts} attempts`,
                  {
                    error,
                    studyId: jobData.studyId,
                    heuristicId: heuristic.id,
                    fileId: file.id,
                  }
                );
                throw error;
              }
              logger.warn(
                `Heuristic evaluation attempt ${attempts} failed, retrying...`,
                {
                  error,
                  attempt: attempts,
                  maxAttempts,
                  heuristicId: heuristic.id,
                  fileId: file.id,
                }
              );
              await new Promise((resolve) =>
                setTimeout(resolve, 1000 * attempts)
              );
            }
          }

          const outputText = response.output_text?.trim();
          if (!outputText) {
            throw new Error("Error processing heuristic evaluation");
          }

          const parsedResponse = JSON.parse(outputText);

          return {
            id: heuristic.id,
            heuristic: heuristic.heuristic,
            violated: parsedResponse.violated,
            reason: parsedResponse.reason,
            recommendations: parsedResponse.recommendations,
            fileId: file.id,
            step,
          } as ResultData & { fileId: string; step: number };
        })
    );

    const evaluationResults = await Promise.all(evaluationPromises);

    llm_responses.push(...evaluationResults);

    logger.debug("Heuristic evaluation LLM responses generated", {
      responseCount: llm_responses.length,
      studyId: jobData.studyId,
    });

    // Add to database
    await addHeuristicEvaluation(jobData, llm_responses);
    logger.info("Heuristic evaluation added to database successfully", {
      studyId: jobData.studyId,
    });
  } catch (error) {
    logger.error("Error processing heuristic evaluation", {
      error,
      studyId: jobData.studyId,
      userId: jobData.userId,
    });

    // TODO: This should be one call to the database worker

    // Refund the user credit
    if (!jobData.retry) {
      logger.info("Refunding user credit due to processing error", {
        userId: jobData.userId,
        creditsToRefund: 1,
        studyId: jobData.studyId,
      });
      await updateCredits(jobData.userId, 1, jobData.studyId);
    } else {
      logger.debug("Skipping credit refund for retry job", {
        userId: jobData.userId,
        studyId: jobData.studyId,
      });
    }

    // Update the study status
    logger.info("Updating study status to failed", {
      studyId: jobData.studyId,
    });
    await updateStatus(jobData.studyId, "failed");
  }
}
