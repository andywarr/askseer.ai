// OpenAI imports
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";

// Zod imports
import { z } from "zod";

// Import logger
import { logger } from "@/apps/shared/logger.ts";
import type { JobEnvelopeV2_CW } from "@/apps/shared/jobSchema.ts";

// Load environment variables
import dotenv from "dotenv";
dotenv.config();

// Import utility functions
import {
  getFiles,
  getPresignedUrl,
  updateCredits,
  updateStatus,
} from "@/apps/ai-worker/src/utils.ts";

// Initialize OpenAI
const openai = new OpenAI();

// Using v2-only NormalizedJob envelope

interface CWResultData {
  questionId: string;
  answer: string;
}

interface CWIssueData {
  issueType: string;
  issue: string;
  recommendations: Array<CWRecommendationData>;
}

interface CWRecommendationData {
  recommendation: string;
}

interface CWStepData {
  step: number;
  expected: boolean;
  results: Array<CWResultData>;
  issues: Array<CWIssueData>;
}

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
        recommendations: z.array(
          z.object({
            recommendation: z.string(),
          })
        ),
      })
    ),
  }),
});

// Function to add cognitive walkthrough to the database
async function addCognitiveWalkthrough(
  jobData: JobEnvelopeV2_CW,
  llm_responses: Array<CWStepData>
) {
  logger.info("Saving cognitive walkthrough to database", {
    studyId: jobData.studyId,
    responseCount: llm_responses.length,
  });

  const response = await fetch(
    `${process.env.DB_WORKER_URL}/api/cognitiveWalkthrough`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ studyData: jobData, results: llm_responses }),
    }
  );

  if (!response.ok) {
    logger.error("Failed to save cognitive walkthrough to database", {
      studyId: jobData.studyId,
      status: response.status,
      statusText: response.statusText,
    });
    throw new Error(
      `Error adding cognitive walkthrough to database: ${response.status}`
    );
  }

  logger.info("Cognitive walkthrough saved to database successfully", {
    studyId: jobData.studyId,
  });
}

// Function to walkthrough
async function evaluate(image_url: string, prompt: string) {
  const evaluationStartTime = Date.now();
  logger.debug("Processing image for cognitive walkthrough", {
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
    model: process.env.CW_MODEL || "gpt-4o-2024-08-06",
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
      cognitiveWalkthroughResultFormat,
      "cognitive_walkthrough_format"
    ),
    max_completion_tokens: Number(process.env.CW_MAX_TOKENS || 1500),
  };

  logger.debug("Calling OpenAI API for cognitive walkthrough", {
    model: params.model,
    maxTokens: params.max_tokens,
  });

  // retry small transient issues
  const maxAttempts = Number(process.env.CW_MAX_ATTEMPTS || 3);
  let attempt = 0;
  let response: OpenAI.Chat.ChatCompletion | null = null;
  while (attempt < maxAttempts) {
    try {
      attempt++;
      response = await openai.chat.completions.create(params);
      break;
    } catch (error) {
      if (attempt >= maxAttempts) {
        logger.error(`CW OpenAI call failed after ${maxAttempts} attempts`, {
          error,
        });
        throw error;
      }
      logger.warn(`CW OpenAI call attempt ${attempt} failed, retrying...`, {
        attempt,
        maxAttempts,
      });
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
  if (!response) throw new Error("OpenAI CW response was null");

  const evaluationDuration = Date.now() - evaluationStartTime;
  logger.debug("OpenAI API call completed", {
    evaluationDuration,
    tokensUsed: response.usage?.total_tokens || "unknown",
    finishReason: response.choices[0]?.finish_reason,
  });

  return response;
}

function getPrompt(
  data: any,
  questions: any,
  step: number,
  steps: number,
  last_llm_response: any
) {
  return `You are a detail-oriented, skilled user experience researcher who provides balanced yet critical evaluations of user flows and interface designs. You have been tasked with performing a cognitive walkthrough to assess each step of a user flow. Your primary goal is to identify issues related to discoverability, learnability, and usability, and to provide practical recommendations for improvement.

This is Step ${step + 1} of ${steps + 1} in the user flow.

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
  last_llm_response
    ? `**User Expectation from Previous Step:**  
  \`\`\`
  ${last_llm_response}
  \`\`\``
    : ""
}

---

Step Evaluation Questions:

The following questions should be answered based on the provided UI for this step:

Questions:
\`\`\`
${questions
  .map((question: any) => `${question.id}. ${question.question}`)
  .join("\n")}
\`\`\`

---

Instructions

1. Expectation Alignment
   - Was this step what was expected based on the above expectaion?

2. Answer the Questions
   - Provide thoughtful responses to each of the evaluation questions listed above. Refer to specific UI elements (e.g., labels, layout, interactions, visual hierarchy, etc.).

3. Discoverability
   - Are there any issues that would prevent the user from noticing or understanding what they need to do at this step to complete the user goal?
   - If so, provide specific recommendations for resolving these issues.

4. Learnability
   - Are there any elements that might be confusing for first-time users or require prior knowledge at this step to complete the user goal?
   - If so, what changes would improve the ease of learning?

5. Usability
   - Are there any friction points or inefficiencies in completing the intended action at this step to complete the user goal?
   - If so, suggest concrete ways to improve the ease and efficiency of use.
   
---

Notes:
- Base your assessment only on what is visible in the provided image.
- Be concise but thorough — focus on discoverability, learnability, and usability issues if they exist.
- Provide practical, actionable recommendations for improvement if there are issues.
- Consider the entire interface, not just individual components in isolation.`;
}

async function getCWQuestions(version: number) {
  logger.debug("Fetching cognitive walkthrough questions", { version });

  // Get CW questions
  const response = await fetch(
    `${process.env.DB_WORKER_URL}/api/cwquestions?version=${version}`
  );

  if (!response.ok) {
    logger.error("Failed to fetch cognitive walkthrough questions", {
      version,
      status: response.status,
      statusText: response.statusText,
    });
    throw new Error(`Failed to fetch CW questions: ${response.status}`);
  }

  const { data: questions } = await response.json();

  logger.debug("Cognitive walkthrough questions retrieved successfully", {
    version,
    questionCount: questions?.length || 0,
  });

  return questions as string[];
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

    let llm_responses: any = [];

    // Prefetch presigned URLs for all files
    const presignedUrls: string[] = await Promise.all(
      files.map(async (file: any) => {
        if (!file.key) {
          throw new Error(
            `File key is missing for file '${file.name}' (id: ${file.id})`
          );
        }
        return getPresignedUrl(file.key);
      })
    );

    logger.info("Starting cognitive walkthrough steps", {
      studyId: jobData.studyId,
      totalSteps: files.length,
    });

    const processStep = async (index: number) => {
      const file = files[index];
      const image_url = presignedUrls[index];
      logger.debug("Processing cognitive walkthrough step", {
        studyId: jobData.studyId,
        stepNumber: index + 1,
        totalSteps: files.length,
        fileName: file.name,
      });

      // Use the previous step's expectation answer when available.
      const previousAnswer =
        llm_responses?.[llm_responses.length - 1]?.results?.[2]?.answer || "";

      const prompt = getPrompt(
        jobData.payload,
        questions,
        index,
        files.length,
        previousAnswer
      );

      const response: any = await evaluate(image_url, prompt);

      const rawContent = response.choices?.[0]?.message?.content;
      if (!rawContent) {
        throw new Error(
          "OpenAI response missing content for cognitive walkthrough"
        );
      }

      let parsedResponse: any;
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
        parsedResponse?.cognitive_walkthrough_format ?? parsedResponse;
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

    // Add to database
    await addCognitiveWalkthrough(jobData, llm_responses);
    logger.info("Cognitive walkthrough added to database successfully", {
      studyId: jobData.studyId,
    });
  } catch (error) {
    logger.error("Error processing cognitive walkthrough", {
      error,
      studyId: jobData.studyId,
      userId: jobData.userId,
    });

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
