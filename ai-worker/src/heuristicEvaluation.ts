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
  results: z.array(
    z.object({
      id: z.string(),
      heuristic: z.string(),
      type: z.string(),
      violated: z.union([z.literal("yes"), z.literal("no")]),
      reason: z.string(),
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
function evaluate(image_url: string, prompt: string) {
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

  return openai.beta.chat.completions.parse(params);
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

Heuristics to Evaluate:
<heuristic>
${heuristic.id}, ${heuristic.heuristic}, ${heuristic.type}
</heuristic>

Instructions:
1. Determine whether the heuristic is violated based on the user interface provided.
2. Provide an analysis using the following structure:

<heuristic_evaluation>
  <id>[ID of the heuristic]</id>
  <heuristic>[Name of the heuristic]</heuristic>
  <type>[Type of the heuristic]</type>
  <violated>[Yes/No]</violated>
  <reason>[Explanation for why the heuristic is violated or not]</reason>
  <recommendation>[Only if violated: Suggestion for improvement]</recommendation>
</heuristic_evaluation>

4. The heuristic may be violated multiple times. In such cases, create separate evaluation blocks for each instance of violation.
5. Be thorough in your analysis, considering all aspects of the user interface.

Please proceed with your analysis and evaluation of the provided user interface.`;
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

    const promises = presignedUrls.flatMap((url) =>
      heuristics.map((heuristic) => {
        // Get the prompt
        const prompt = getPrompt(jobData.data, heuristic, url);

        return evaluate(url, prompt);
      })
    );

    const llm_responses = [];
    for (const promise of promises) {
      const response = await promise;
      llm_responses.push(response.choices[0].message.parsed.results);
      // Add a delay to avoid hitting rate limits
      await new Promise((resolve) => setTimeout(resolve, 1000)); // 1 second delay
    }

    console.info("LLM Responses:", llm_responses);

    // Add to database
    const study = await addHeuristicEvaluation(jobData, llm_responses.flat());

    return study;
  } catch (error) {
    console.error("Error processing heuristic evaluation:", error);
  }
}
