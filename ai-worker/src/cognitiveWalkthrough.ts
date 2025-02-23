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
    context: string | null;
    heuristic: string | null;
    type: string;
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

  const response: OpenAI.Chat.ChatCompletion =
    await openai.chat.completions.create(params);

  return response;
}

async function getPresignedUrl(key: string) {
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
  .map((question: any) => `${question.id}, ${question.question}`)
  .join("\n ")}
</questions>

Instructions:
1. Was this step expected based on the above expectation?
2. For this user interface design provided, you will answer the questions listed above.
3. What discoverability issues exist, if any?
4. If there are discoverability issues, what are the recommended solutions?
5. What learnability issues exist, if any?
6. If there are learnability issues, what are the recommended solutions?
7. What usability issues exist, if any?
8. If there are usability issues, what are the recommended solutions?`;
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
    // Get the questions
    const questions = await getCWQuestions(1);

    let llm_responses: any = [];

    for (const [index, file] of jobData.data.files.entries()) {
      console.log(
        llm_responses.length > 0
          ? llm_responses[llm_responses.length - 1].results[2].answer
          : ""
      );

      // Get the prompt
      const prompt = getPrompt(
        jobData.data,
        questions,
        index,
        jobData.data.files.length,
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
    const study = await addCognitiveWalkthrough(jobData, llm_responses);

    return study;
  } catch (error) {
    console.error("Error processing cognitive walkthrough:", error);

    // Refund the user credit
    await updateCredits(jobData.data.userId, 1);

    // Update the study status
    await updateStatus(jobData.studyId, "failed");
  }
}

export async function updateCredits(userId: string, credits: number) {
  try {
    const response = await fetch(
      `${process.env.DB_WORKER_URL}/api/updateCredits`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId: userId, delta: credits }),
      }
    );
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error updating credits:", error);
    throw error;
  }
}

async function updateStatus(studyId: string, status: string) {
  try {
    const response = await fetch(
      `${process.env.DB_WORKER_URL}/api/studyStatus`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ studyId: studyId, status: status }),
      }
    );
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error updating credits:", error);
    throw error;
  }
}
