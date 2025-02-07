// AWS imports
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// OpenAI imports
import OpenAI from "openai";

// Zod imports
import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";

// Load environment variables
import dotenv from "dotenv";
dotenv.config();

// Initialize OpenAI
const openai = new OpenAI();

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
    heuristic: string;
    context: string | null;
    userId: string;
  };
  studyId: string;
  task: string;
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
  const { data: study } = await response.json();

  if (!study) {
    // Throw an error
  }

  return study;
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

  const llm_response = await openai.beta.chat.completions.parse(params);

  return llm_response;
}

async function getPresignedUrl(key) {
  const bucketName = process.env.AWS_BUCKET_NAME;
  const s3Client = new S3Client({ region: process.env.AWS_REGION });

  const command = new GetObjectCommand({
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: key, // Path to your image in S3
  });

  try {
    // Generate a pre-signed URL valid for 1 hour (3600 seconds)
    const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
    return url;
  } catch (error) {
    console.error("Error generating pre-signed URL", error);
    throw error;
  }
}

function getPrompt(
  data: any,
  questions: any,
  step: number,
  steps: number,
  last_llm_response: any
) {
  return `You are a detail-oriented, skilled user experience researcher who provides a balanced, but critical view evaluating designs and experiences. You have been tasked with walking through and evaluating a user flow. Your goal is to identify discoverability, learnability, and usability issues, as well as provide recommendations for improvement at each step of the process. This is step ${
    step + 1
  } of ${steps + 1}.

First, let's review the context for this evaluation:

User Goal:
<user_goal>
${data.goal}
</user_goal>

${
  data.context
    ? `Additional Context:
<context>
${data.context}
</context>`
    : ""
}

${
  last_llm_response
    ? `<expectation>
${last_llm_response}
<expectation>`
    : ""
}

<questions>
${questions
  .map((question) => `${question.id}, ${question.question}`)
  .join("\n ")}
</questions>

Instructions:
1. Was this step expected? The first step will always be expected.
1. For this user interface design provided, you will answer the questions listed above.
2. Are there any issues with discoverability, learnability, or usability at this step? If so, what is the issue and recommendations for improvement for each issue.`;
}

async function getCWQuestions(version: number) {
  // Get heuristics
  const response = await fetch(`${process.env.DB_WORKER_URL}/api/cwquestions`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ version: version }),
  });
  const { data: heuristics } = await response.json();

  return heuristics as string[];
}

export async function processCognitiveWalkthrough(jobData: JobData) {
  console.log("Processing heuristic evaluation:", jobData);

  try {
    // Get the questions
    const questions = await getCWQuestions(1);

    let llm_responses: any = [];

    for (const [index, file] of jobData.data.files.entries()) {
      // Get the prompt
      const prompt = getPrompt(
        jobData.data,
        questions,
        index,
        jobData.data.files.length,
        llm_responses.length > 0
          ? llm_responses[llm_responses.length - 1].answer
          : ""
      );

      // Get the presigned URL for the key
      const image_url = await getPresignedUrl(file.key);

      const llm_response = await evaluate(image_url, prompt);

      // @ts-ignore
      llm_responses.push(llm_response.choices[0].message.parsed.results);
    }

    // Add to database
    await addCognitiveWalkthrough(jobData, llm_responses.flat());
  } catch (error) {}
}
