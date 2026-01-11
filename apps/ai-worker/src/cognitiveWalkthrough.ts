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
import { deduplicateCognitiveWalkthrough } from "./utils.ts";
import type {
  CWStepData,
  CWQuestion,
  EvaluationPayload,
} from "./types.ts";

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

  const response = await openai.responses.create(params);

  const evaluationDuration = Date.now() - evaluationStartTime;
  logger.debug("OpenAI API call completed", {
    evaluationDuration,
    tokensUsed: response.usage?.total_tokens || "unknown",
    status: response.status,
  });

  return response;
}

// ============================================================================
// Prompt Generation
// ============================================================================

/**
 * Generate the prompt for cognitive walkthrough
 */
function getPrompt(
  data: EvaluationPayload,
  questions: CWQuestion[],
  step: number,
  steps: number,
  last_llm_response: string
): string {
  return `# Role and Objective
  
You are a detail-oriented, skilled user experience researcher assigned to critically evaluate user flows and interface designs via a cognitive walkthrough. Your main goal is to identify discoverability, learnability, and usability issues at each step, and to offer practical, actionable recommendations for improvement.

# Instructions

- Stay focused on helping the user accomplish the stated goal. Avoid assessing tangential opportunities or unrelated features.

---

## Evaluation Context

**This is Step ${step + 1} of ${steps + 1} in the user flow.**
  
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
  .map((question) => `${question.id}. ${question.question}`)
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
- Note anything that may confuse first-time users or that needs prior knowledge. Reference specific UI/UX elements, explaining why they're confusing for the target user.
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

// ============================================================================
// Main Processing Function
// ============================================================================

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

      const prompt = getPrompt(
        jobData.payload,
        questions,
        index,
        files.length,
        previousAnswer
      );

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
