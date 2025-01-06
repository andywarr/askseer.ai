// @ts-nocheck
"use server";

// AWS imports
import {
  S3Client,
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

//Next imports
import { redirect } from "next/navigation";

// NextAuth imports
import { auth, signOut } from "@/auth";

// Lib function imports
import {
  getHeuristics,
  getUser,
  setCognitiveWalkthrough,
  setHeuristicEvaluation,
} from "@/lib/data";

// Prisma imports
import { FileType, HeuristicType, ImageType } from "@prisma/client";

// OpenAI imports
import OpenAI from "openai";

// Schema imports
import {
  heuristicEvaluationSchema,
  heuristicEvaluationResultFormat,
  cognitiveWalkthroughSchema,
  cognitiveWalkthroughResultFormat,
} from "@/lib/schema";

// Type imports
import { FileData, User } from "@/types/types";

// Zod imports
import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";

// Other imports
import { v4 as uuidv4 } from "uuid";

const openai = new OpenAI();

export async function convertFromHeuristicType(
  heuristic: HeuristicType,
): string {
  switch (heuristic) {
    case HeuristicType.NIELSEN:
      return "Nielsen";
    case HeuristicType.TENETS:
      return "Tenets & Traps";
    default:
      return "Other";
  }
}

function convertToHeuristicType(heuristic: string): HeuristicType | null {
  switch (heuristic.toUpperCase()) {
    case "NIELSEN":
      return HeuristicType.NIELSEN;
    case "TENETS":
      return HeuristicType.TENETS;
    default:
      return null;
  }
}

async function convertFilesToBase64(files: Array<File>) {
  return Promise.all(
    files.map(async (file) => {
      const bytes = await file.arrayBuffer();
      const data = Buffer.from(bytes).toString("base64");
      return { name: file.name, size: file.size, type: file.type, data };
    }),
  );
}

export async function cognitiveWalkthrough(
  goal: string,
  files: Array<FileData>,
  context: string,
) {
  let llm_responses = [];

  for (const [index, file] of files.entries()) {
    let content = [];

    content.push({
      type: "text",
      text: `You are a detail-oriented, skilled user experience researcher who provides a balanced, but critical view evaluating designs and experiences. You have been tasked with walking through and evaluating a user flow. Your goal is to identify discoverability, learnability, and usability issues, as well as provide recommendations for improvement at each step of the process. This is step ${index + 1} of ${files.length + 1}.

First, let's review the context for this evaluation:

User Goal:
<user_goal>
${goal}
</user_goal>

${
  context
    ? `Additional Context:
<context>
${context}
</context>`
    : ""
}

${
  index > 0
    ? `<expectation>
${llm_responses.findLast((last_llm_response) => last_llm_response.questions[2].questionAnswer)}
<expectation>`
    : ""
}

<questions>
1. What is the next task the user needs to take at this step to achieve their goal?
2. How will the user achieve this task at this step?
3. What will the user expect to happen next after completing this task?
</questions>

Instructions:
1. Was this step expected? The first step will always be expected.
1. For this user interface design provided, you will answer the questions listed above.
2. Are there any issues with discoverability, learnability, or usability at this step? If so, what is the issue and recommendations for improvement for each issue.`,
    });

    content.push({
      type: "image_url",
      image_url: {
        url: `data:${file.type};base64, ${file.data}`,
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
        "cognitive_walkthrough_format",
      ),
      max_tokens: 2000,
    };

    const llm_response = await openai.beta.chat.completions.parse(params);

    llm_responses.push(llm_response.choices[0].message.parsed.results);
  }

  return llm_responses;
}

export async function cognitiveWalkthroughFormAction(
  data: FormData,
  keys: Array<string>,
) {
  const { user } = await auth();

  const name: string = data.get("name") as string;
  const goal: string = data.get("goal") as string;
  const files: Array<File> = data.getAll("file") as Array<File>;
  const context: string | null = data.get("context") as string;

  const result = cognitiveWalkthroughSchema.safeParse({
    name: name,
    goal: goal,
    files: files,
    context: context,
  });

  if (!result.success) {
    return {
      errors: { fieldErrors: { form: `The upload data is not valid.` } },
    };
  }

  // The user does not have enough credits
  if (user.credits <= 0) {
    return {
      errors: { fieldErrors: { credits: `You don't have enough credits.` } },
    };
  }

  // Convert the files to base64
  const base64_files = await convertFilesToBase64(files);

  // Process data
  const llm_responses = await cognitiveWalkthrough(goal, base64_files, context);

  // Add the results to the database
  const db_response = await setCognitiveWalkthrough(
    user.id,
    name,
    goal,
    context,
    base64_files,
    keys,
    llm_responses,
  );

  // Open the results view
  redirect(`/walkthrough/${db_response.id}`);
}

export async function heuristicEvaluation(
  goal: string,
  files: Array<FileData>,
  heuristic: string,
  context: string,
) {
  const heuristicType = convertToHeuristicType(heuristic);

  if (!heuristicType) {
    throw new Error(`Invalid heuristic type: ${heuristic}`);
  }

  // Get the heuristics from the database
  const heuristics = await getHeuristics(heuristicType);

  let content = [];

  content.push({
    type: "text",
    text: `You are a detail-oriented, skilled user experience researcher who provides a balanced, but critical view evaluating designs and experiences. You have been tasked with assessing multiple user interface designs against a set of heuristics. Your goal is to identify violations of these heuristics and provide recommendations for improvement.

First, let's review the context for this evaluation:

User Goal:
<user_goal>
${goal}
</user_goal>

${
  context
    ? `Additional Context:
<context>
${context}
</context>`
    : ""
}

Heuristics to Evaluate:
<heuristics>
${heuristics.map((heuristic) => `${heuristic.id}, ${heuristic.heuristic}, ${heuristic.type}`).join("\n ")}
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

Please proceed with your analysis and evaluation of the provided user interfaces.`,
  });

  files.forEach((file) => {
    content.push({
      type: "image_url",
      image_url: {
        url: `data:${file.type};base64, ${file.data}`,
      },
    });
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
      "heuristic_evaluation_format",
    ),
    max_tokens: 2000,
  };

  const response = await openai.beta.chat.completions.parse(params);

  return response;
}

export async function heuristicEvaluationFormAction(
  data: FormData,
  keys: Array<string>,
) {
  const { user } = await auth();

  const name: string = data.get("name") as string;
  const goal: string = data.get("goal") as string;
  const files: Array<File> = data.getAll("file") as Array<File>;
  const heuristic: string = data.get("heuristic") as string;
  const context: string | null = data.get("context") as string;

  const result = heuristicEvaluationSchema.safeParse({
    name: name,
    goal: goal,
    files: files,
    heuristic: heuristic,
    context: context,
  });

  if (!result.success) {
    return {
      errors: { fieldErrors: { form: `The upload data is not valid.` } },
    };
  }

  // The user does not have enough credits
  if (user.credits <= 0) {
    return {
      errors: { fieldErrors: { credits: `You don't have enough credits.` } },
    };
  }

  // Convert the files to base64
  const base64_files = await convertFilesToBase64(files);

  // Process data
  const llm_response = await heuristicEvaluation(
    goal,
    base64_files,
    heuristic,
    context,
  );

  // Check if the model refused to respond
  if (llm_response.choices[0].message.refusal) {
    return {
      redirect: {
        destination: "/error",
        permanent: false,
      },
    };
  }

  // // Add the results to the database
  const db_response = await setHeuristicEvaluation(
    user.id,
    name,
    goal,
    context,
    base64_files,
    keys,
    heuristic,
    llm_response.choices[0].message.parsed.results,
  );

  // Open the results view
  redirect(`/heuristic/${db_response.id}`);
}

export async function signOutServerAction() {
  await signOut();
}

function generateRandomFileName(originalFileName) {
  const fileExtension = originalFileName.split(".").pop(); // Extract the file extension
  const uniqueId = uuidv4(); // Generate a unique ID
  return `${uniqueId}.${fileExtension}`; // Combine them
}

export async function putPresignedUrls(fileMetadata) {
  const { user } = await auth();

  const bucketName = process.env.AWS_BUCKET_NAME;
  const s3Client = new S3Client({ region: process.env.AWS_REGION });

  // Generate a pre-signed URL for each file
  const urls = await Promise.all(
    fileMetadata.map(async (file) => {
      const fileName = generateRandomFileName(file.name);
      const fileType = file.type;

      const s3Params = {
        Bucket: bucketName,
        Key: `${user.id}/${fileName}`,
        ContentType: fileType,
      };

      try {
        // Generate pre-signed URL with a 1 minute expiration
        const uploadURL = await getSignedUrl(
          s3Client,
          new PutObjectCommand(s3Params),
          { expiresIn: 60 },
        );

        return {
          fileName,
          fileType,
          uploadURL,
          key: `${user.id}/${fileName}`,
        };
      } catch (error) {
        console.error("Error generating pre-signed URL", error);
        throw error; // Re-throw or handle as needed
      }
    }),
  );

  return urls;
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

export async function deleteS3Objects(keys) {
  keys.forEach(async (key) => {
    const bucketName = process.env.AWS_BUCKET_NAME;
    const s3Client = new S3Client({ region: process.env.AWS_REGION });

    const command = new DeleteObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: key,
    });

    try {
      await s3Client.send(command);
      console.log(`Deleted object ${key}`);
    } catch (error) {
      console.error("Error deleting object", error);
      throw error;
    }
  });
}
