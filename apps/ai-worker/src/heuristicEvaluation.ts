// OpenAI imports
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";

// Zod imports
import { z } from "zod";

// Import logger
import { logger } from "./logger.ts";
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
  type: string;
}

// Using v2-only NormalizedJob envelope

interface ResultData {
  id: string;
  heuristic: string;
  type: string;
  violated: string;
  reason: string;
  recommendations: string;
}

// Schema for the object resulted by OpenAI
const heuristicEvaluationResultFormat = z.object({
  violated: z.union([z.literal("yes"), z.literal("no")]),
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
async function evaluate(image_url: string, prompt: string) {
  const evaluationStartTime = Date.now();
  logger.debug("Processing image for heuristic evaluation", {
    image_url: image_url.substring(0, 100) + "...",
    promptLength: prompt.length,
  });

  let content: any = [];

  // Add the prompt
  content.push({
    type: "text",
    text: prompt,
  });

  // Add the image
  content.push({
    type: "image_url",
    image_url: {
      url: image_url,
    },
  });

  const params: OpenAI.Chat.ChatCompletionCreateParams = {
    model: "gpt-4o-2024-08-06",
    messages: [
      {
        role: "system",
        content:
          "You are a detail-oriented, skilled user experience researcher who provides a balanced, but critical view evaluating designs and experiences",
      },
      {
        role: "user",
        content: content,
      },
    ],
    stream: false,
    response_format: zodResponseFormat(
      heuristicEvaluationResultFormat,
      "heuristic_evaluation_format"
    ),
    max_tokens: 2000,
  };

  logger.debug("Calling OpenAI API for heuristic evaluation", {
    model: params.model,
    maxTokens: params.max_tokens,
  });

  const response: OpenAI.Chat.ChatCompletion =
    await openai.chat.completions.create(params);

  const evaluationDuration = Date.now() - evaluationStartTime;
  logger.debug("OpenAI API call completed", {
    evaluationDuration,
    tokensUsed: response.usage?.total_tokens || "unknown",
    finishReason: response.choices[0]?.finish_reason,
  });

  return response;
}

async function getHeuristics(type: string) {
  logger.debug("Fetching heuristics", { type });

  // Get heuristics
  const response = await fetch(
    `${process.env.DB_WORKER_URL}/api/heuristics?type=${type}`
  );

  if (!response.ok) {
    logger.error("Failed to fetch heuristics", {
      type,
      status: response.status,
      statusText: response.statusText,
    });
    throw new Error(`Failed to fetch heuristics: ${response.status}`);
  }

  const { data: heuristics } = await response.json();

  logger.debug("Heuristics retrieved successfully", {
    type,
    heuristicCount: heuristics?.length || 0,
  });

  return heuristics as Heuristic[];
}

function getPrompt(data: any, heuristic: any) {
  return `You are a detail-oriented, skilled user experience researcher who provides balanced yet critical evaluations of designs and experiences. You have been tasked with assessing a series of user interface (UI) designs against established a set of heuristics. Your objective is to identify any heuristic violations and provide actionable, user-centered recommendations for improvement.

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
${heuristic.id}: ${heuristic.heuristic} (${heuristic.type})
\`\`\`

---

Instructions:

For the attached UI design:

1. Violation Check
   - Was this heuristic violated in this specific UI? (Yes/No)

2. Justification
   - Clearly explain why the heuristic was or was not violated. Refer to specific UI elements (e.g., labels, layout, interactions, visual hierarchy, etc.).

3. Recommendations (if a violation exists)
   - Suggest concrete design improvements or changes to resolve the violation.
   - Keep your suggestions practical and feasible given the user goal and context above.

---

Notes:
- Base your assessment only on what is visible in the provided image.
- Be concise but thorough—focus on discoverability, learnability, and usability.
- Consider the entire interface, not just individual components in isolation.
`;
}

export async function processHeuristicEvaluation(jobData: JobEnvelopeV2_HE) {
  logger.info("Processing heuristic evaluation", {
    studyId: jobData.studyId,
    heuristic: jobData.payload.heuristic,
    userId: jobData.userId,
  });

  try {
    if (!jobData.payload.heuristic) {
      throw new Error("Heuristic type not provided");
    }

    // Get the files from the database
    const files = await getFiles(jobData.studyId);

    logger.debug("Retrieved files for heuristic evaluation", {
      studyId: jobData.studyId,
      fileCount: files.length,
    });

    // Get the heuristics from the database
    const heuristics = await getHeuristics(jobData.payload.heuristic);

    logger.debug("Retrieved heuristics for evaluation", {
      studyId: jobData.studyId,
      heuristicType: jobData.payload.heuristic,
      heuristicCount: heuristics.length,
    });

    // Get presigned URLs for all the files
    logger.debug("Generating presigned URLs for files", {
      studyId: jobData.studyId,
    });

    const presignedUrls: string[] = await Promise.all(
      files.map((file: File) => (file.key ? getPresignedUrl(file.key) : ""))
    );

    const llm_responses = [];
    const totalEvaluations = files.length * heuristics.length;
    let completedEvaluations = 0;

    logger.info("Starting heuristic evaluations", {
      studyId: jobData.studyId,
      totalEvaluations,
      fileCount: files.length,
      heuristicCount: heuristics.length,
    });

    for (const [index, url] of presignedUrls.entries()) {
      const currentFile = files[index];

      for (const heuristic of heuristics) {
        completedEvaluations++;
        logger.debug("Processing heuristic evaluation", {
          studyId: jobData.studyId,
          fileName: currentFile.name,
          heuristicId: heuristic.id,
          progress: `${completedEvaluations}/${totalEvaluations}`,
        });

        // Get the prompt
        const prompt = getPrompt(jobData.payload, heuristic);

        let response: any;
        let attempts = 0;
        const maxAttempts = 3;

        while (attempts < maxAttempts) {
          try {
            attempts++;
            response = await evaluate(url, prompt);
            break; // If successful, exit the loop
          } catch (error) {
            if (attempts === maxAttempts) {
              // If this was the last attempt, rethrow the error
              logger.error(
                `Failed to evaluate heuristic after ${maxAttempts} attempts`,
                { error, studyId: jobData.studyId, heuristicId: heuristic.id }
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
              }
            );
            await new Promise((resolve) =>
              setTimeout(resolve, 1000 * attempts)
            );
          }
        }

        if (!response.choices[0].message.content) {
          throw new Error("Error processing heuristic evaluation");
        }

        const parsedResponse = JSON.parse(response.choices[0].message.content);

        // @ts-ignore
        llm_responses.push({
          id: heuristic.id,
          heuristic: heuristic.heuristic,
          type: heuristic.type,
          violated: parsedResponse.violated,
          reason: parsedResponse.reason,
          recommendations: parsedResponse.recommendations,
          fileId: currentFile.id,
          step: index + 1,
        });
      }
    }

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
      await updateCredits(jobData.userId, 1);
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
