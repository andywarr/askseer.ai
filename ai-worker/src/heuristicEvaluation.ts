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

interface ResultData {
  id: string;
  heuristic: string;
  type: string;
  violated: string;
  reason: string;
  recommendation: string;
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

  const response = await openai.beta.chat.completions.parse(params);

  return response;
}

async function getHeuristics(type: string) {
  // Get heuristics
  const response = await fetch(
    `${process.env.DB_WORKER_URL}/api/heuristics?type=${type}`
  );
  const { data: heuristics } = await response.json();

  return heuristics as string[];
}

export async function getPresignedUrls(key) {
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

function getPrompt(data: any, heuristic: any, url: string) {
  return `You are a detail-oriented, skilled user experience researcher who provides a balanced, but critical view evaluating designs and experiences. You have been tasked with assessing multiple user interface designs against a set of heuristics. Your goal is to identify violations of these heuristics and provide recommendations for improvement.

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

Heuristic:
<heuristic>
${heuristic.id}, ${heuristic.heuristic}, ${heuristic.type}
</heuristic>

Instructions:
1. For this user interface provided, was the heuristic violated?
2. Why was the heuristic violated or not?
3. If the heuristic was violated, what are the recommended solutions to address the violdated heuristic?

Be thorough in your analysis, considering all aspects of the user interface.`;
}

export async function processHeuristicEvaluation(jobData: JobData) {
  console.log("Processing heuristic evaluation:", jobData);

  try {
    // Get the heuristics from the database
    const heuristics = await getHeuristics(jobData.data.heuristic);

    // Get presigned URLs for all the files
    const presignedUrls = await Promise.all(
      jobData.data.files.map((file) =>
        file.key ? getPresignedUrls(file.key) : ""
      )
    );

    const llm_responses = [];
    for (const url of presignedUrls) {
      for (const heuristic of heuristics) {
        // Get the prompt
        const prompt = getPrompt(jobData.data, heuristic, url);

        const response = await evaluate(url, prompt);

        llm_responses.push({
          id: heuristic.id,
          heuristic: heuristic.heuristic,
          type: heuristic.type,
          violated: response.choices[0].message.parsed.violated,
          reason: response.choices[0].message.parsed.reason,
          recommendations: response.choices[0].message.parsed.recommendations,
        });
      }
    }

    console.info("LLM Responses:", llm_responses);

    // Add to database
    const study = await addHeuristicEvaluation(jobData, llm_responses);

    return study;
  } catch (error) {
    console.error("Error processing heuristic evaluation:", error);
  }
}
