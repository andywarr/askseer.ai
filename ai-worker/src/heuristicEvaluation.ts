// @ts-nocheck
// // AWS imports
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

async function addHeuristicEvaluation(data: any) {
  const response = await fetch(
    `${process.env.DB_WORKER_URL}/api/heuristicEvaluation`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    }
  );
  const { data: study } = await response.json();

  // If a user does not exist there is a problem
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

  const llm_response = await openai.beta.chat.completions.parse(params);

  return llm_response;
}

async function getHeuristics(type: string) {
  // Get heuristics
  const response = await fetch(
    `${process.env.DB_WORKER_URL}/api/heuristics?type=${type}`
  );
  const { data: heuristics } = await response.json();

  return heuristics;
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

function getPrompt(data: any, heuristics: any) {
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
<heuristics>
${heuristics
  .map(
    (heuristic) => `${heuristic.id}, ${heuristic.heuristic}, ${heuristic.type}`
  )
  .join("\n ")}
</heuristics>

Instructions:
1. For each user interface design provided, you will evaluate it against all the heuristics listed above.
2. For each heuristic, determine whether it is violated in the given interface.
3. Provide your analysis using the following structure:

<heuristic_evaluation>
  <id>[ID of the heuristic]</id>
  <heuristic>[Name of the heuristic]</heuristic>
  <type>[Type of the heuristic]</type>
  <violated>[Yes/No]</violated>
  <reason>[Explanation for why the heuristic is violated or not]</reason>
  <recommendation>[Only if violated: Suggestion for improvement]</recommendation>
</heuristic_evaluation>

4. Remember that each interface may violate the same heuristic multiple times. In such cases, create separate evaluation blocks for each instance of violation.
5. Be thorough in your analysis, considering all aspects of the user interface in relation to each heuristic.

Please proceed with your analysis and evaluation of the provided user interfaces.`;
}

export async function processHeuristicEvaluation(data: any) {
  console.log("Processing heuristic evaluation:", data);

  // Get the heuristics from the database
  const heuristics = await getHeuristics(data.heuristic);

  const prompt = getPrompt(data, heuristics);

  let llm_responses: any = [];

  for (const [index, file] of data.files.entries()) {
    // Get the presigned URL for the key
    const image_url = await getPresignedUrl(file.key);

    const llm_response = await evaluate(image_url, prompt);

    llm_responses.push(llm_response.choices[0].message.parsed.results);
  }

  // Add to database
  await addHeuristicEvaluation({
    studyId: data.studyId,
    userId: data.userId,
    name: data.name,
    goal: data.goal,
    context: data.context,
    files: data.files,
    heuristic: data.heuristic,
    results: llm_responses,
  });
}
