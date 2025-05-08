// OpenAI imports
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";

// Zod imports
import { z } from "zod";

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

interface JobData {
  data: {
    name: string;
    goal: string;
    files: {
      name: string;
      key: string;
      size: number;
      type: string;
    }[];
    context: string | null;
    heuristic: string | null;
    type: string;
    userId: string;
  };
  studyId: string;
  task: string;
}

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

async function addHeuristicEvaluation(
  jobData: JobData,
  llm_responses: Array<ResultData>
) {
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
  const { data: study } = await response.json();

  if (!study) {
    // Throw an error
  }

  return study;
}

// Function to evaluate the heuristics
async function evaluate(image_url: string, prompt: string) {
  console.log("Processing image:", image_url);

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

  const response: OpenAI.Chat.ChatCompletion =
    await openai.chat.completions.create(params);

  return response;
}

async function getHeuristics(type: string) {
  // Get heuristics
  const response = await fetch(
    `${process.env.DB_WORKER_URL}/api/heuristics?type=${type}`
  );
  const { data: heuristics } = await response.json();

  return heuristics as Heuristic[];
}

function getPrompt(data: any, heuristic: any, url: string) {
  return `You are a detail-oriented, skilled user experience researcher who provides balanced yet critical evaluations of designs and experiences. You have been tasked with assessing a series of user interface (UI) designs against established a set of heuristics. Your objective is to identify any heuristic violations and provide actionable, user-centered recommendations for improvement.

Context for the Evaluation:
  
User Goal:
\`\`\`
${data.goal}
\`\`\`

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

export async function processHeuristicEvaluation(jobData: JobData) {
  console.log("Processing heuristic evaluation:", jobData);

  try {
    if (!jobData.data.heuristic) {
      throw new Error("Heuristic type not provided");
    }

    // Get the files from the database
    const files = await getFiles(jobData.studyId);

    // Get the heuristics from the database
    const heuristics = await getHeuristics(jobData.data.heuristic);

    // Get presigned URLs for all the files
    const presignedUrls: string[] = await Promise.all(
      files.map((file: File) => (file.key ? getPresignedUrl(file.key) : ""))
    );

    const llm_responses = [];
    for (const url of presignedUrls) {
      const currentFile = files[presignedUrls.indexOf(url)];

      for (const heuristic of heuristics) {
        // Get the prompt
        const prompt = getPrompt(jobData.data, heuristic, url);

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
              console.error(
                `Failed to evaluate after ${maxAttempts} attempts:`,
                error
              );
              throw error;
            }
            console.warn(`Attempt ${attempts} failed, retrying...`, error);
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
        });
      }
    }

    console.info("LLM Responses:", llm_responses);

    // Add to database
    const study = await addHeuristicEvaluation(jobData, llm_responses);

    return study;
  } catch (error) {
    console.error("Error processing heuristic evaluation:", error);

    // Refund the user credit
    await updateCredits(jobData.data.userId, 1);

    // Update the study status
    await updateStatus(jobData.studyId, "failed");
  }
}
