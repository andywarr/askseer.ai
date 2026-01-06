// OpenAI imports
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";

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
  deduplicateCognitiveWalkthrough,
} from "@/apps/ai-worker/src/utils.ts";
import { STUDY_STATUS_FAILED } from "@/apps/shared/constants.ts";

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
  severity: number; // 0=not a problem, 1=cosmetic, 2=minor, 3=major, 4=catastrophe
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
    model: process.env.CW_MODEL || "gpt-5-mini-2025-08-07",
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

  // retry small transient issues
  const maxAttempts = Number(process.env.CW_MAX_ATTEMPTS || 3);
  let attempt = 0;
  let response: OpenAI.Responses.Response | null = null;
  while (attempt < maxAttempts) {
    try {
      attempt++;
      response = await openai.responses.create(params);
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
    status: response.status,
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
  return `# Role and Objective
  
You are a detail-oriented, skilled user experience researcher assigned to critically evaluate user flows and interface designs via a cognitive walkthrough. Your main goal is to identify discoverability, learnability, and usability issues at each step, and to offer practical, actionable recommendations for improvement.

# Instructions

- Stay focused on helping the user accomplish the stated goal. Avoid assessing tangential opportunities or unrelated features.

---

## Evaluation Context

**This is Step ${step + 1} of ${steps + 1} in the user flow.**
  
- **User Goal:**
${data.goal}

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

${
  last_llm_response
    ? `- **User Expectation from Previous Step:**  
  ${last_llm_response}`
    : ""
}

---

## Step Evaluation Questions

For this step, answer these questions based **only** on the provided UI image:

${questions
  .map((question: any) => `${question.id}. ${question.question}`)
  .join("\n")}

---

## Assessment Instructions

**Target User Focus:**
- Anchor every answer and recommendation to the target user's needs, abilities, and above context. If no user details are given, proceed with general assumptions only.

1. **Expectation Alignment**
- Did this step match what was anticipated based on prior expectations?

2. **Answer the Evaluation Questions**
- Respond thoroughly to every question above, referencing specific visual UI/UX elements (exact button labels, field names, icons, positions, etc.). Avoid generic feedback.

3. **Discoverability**
- Identify any obstacles to the user noticing or understanding how to progress at this step. Directly reference involved UI/UX elements using their exact visible text/label and describe their position.
- For each issue, give a clear, element-specific, actionable recommendation.

4. **Learnability**
- Note anything that may confuse first-time users or that needs prior knowledge. Reference specific UI/UX elements, explaining why they’re confusing for the target user.
- Offer concrete, element-level recommendations (e.g., new copy, better labels, repositioning).

5. **Usability**
- Highlight any efficiency/friction issues in performing the intended action. Cite the involved elements/interactions, and provide actionable fixes.

6. **Severity Rating** (if a violation is found)
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
   
After completing your assessment of the UI image, provide a brief validation that your analysis aligns with the user's goal and the assessment scope, and highlight any next steps or actions needed for clarification or refinement.

---

# Additional Notes
- Assess only what is visible in the supplied image.
- Be concise but thorough; prioritize discoverability, learnability, and usability.
- Give actionable, practical improvement recommendations for each issue found.
- Every issue, justification, and recommendation **must reference one or more concrete UI/UX elements visible in the image** (by name/label if available). Do not invent invisible elements.
- Stay strictly aligned with the stated user goal and context; ignore unrelated features or concerns.
- Evaluate the entire interface's interaction for this step, not just single components.
Describe your use case, desired behavior, and issues
`;
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

    logger.info("Starting cognitive walkthrough steps", {
      studyId: jobData.studyId,
      totalSteps: files.length,
    });

    const processStep = async (index: number) => {
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

      const prompt = getPrompt(
        jobData.payload,
        questions,
        index,
        files.length,
        previousAnswer
      );

      const response: OpenAI.Responses.Response = await evaluate(
        image_url,
        prompt
      );

      const rawContent = response.output_text?.trim();
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
    await updateStatus(jobData.studyId, STUDY_STATUS_FAILED);
  }
}
