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
  getFiles,
  getPresignedUrl,
  updateCredits,
  updateStatus,
} from "@/apps/ai-worker/src/utils.ts";

// Initialize OpenAI
const openai = new OpenAI();

interface JobData {
  data: {
    name: string;
    goal: string;
    user: string | null;
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
  retry?: boolean; // Optional field to indicate if this is a retry
}

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
  jobData: JobData,
  llm_responses: Array<CWStepData>
) {
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
    throw new Error("Error adding cognitive walkthrough to database");
  }
}

// Function to walkthrough
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
      cognitiveWalkthroughResultFormat,
      "cognitive_walkthrough_format"
    ),
    max_tokens: 2000,
  };

  const response: OpenAI.Chat.ChatCompletion =
    await openai.chat.completions.create(params);

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
  // Get heuristics
  const response = await fetch(
    `${process.env.DB_WORKER_URL}/api/cwquestions?version=${version}`
  );
  const { data: heuristics } = await response.json();

  return heuristics as string[];
}

export async function processCognitiveWalkthrough(jobData: JobData) {
  console.log("Processing cognitive walkthrough:", jobData);

  try {
    // Get the files from the database
    const files = await getFiles(jobData.studyId);

    // Get the questions
    const questions = await getCWQuestions(1);

    let llm_responses: any = [];

    for (const [index, file] of files.entries()) {
      // Get the prompt
      const prompt = getPrompt(
        jobData.data,
        questions,
        index,
        files.length,
        llm_responses.length > 0
          ? llm_responses[llm_responses.length - 1].results[2].answer
          : ""
      );

      // Get the presigned URL for the key
      const image_url = await getPresignedUrl(file.key);

      const response: any = await evaluate(image_url, prompt);

      if (!response.choices[0].message.content) {
        throw new Error("Error processing heuristic evaluation");
      }

      const parsedResponse = JSON.parse(response.choices[0].message.content);

      // @ts-ignore
      llm_responses.push(parsedResponse.results);
    }

    console.info("LLM Responses:", llm_responses);

    // Add to database
    await addCognitiveWalkthrough(jobData, llm_responses);
    console.log("Added cognitive walkthrough to database:");
  } catch (error) {
    console.error("Error processing cognitive walkthrough:", error);

    // Refund the user credit
    if (!jobData.retry) {
      await updateCredits(jobData.data.userId, 1);
    }

    // Update the study status
    await updateStatus(jobData.studyId, "failed");
  }
}
