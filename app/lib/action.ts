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
import { getHeuristics, getUser, setHeuristicEvaluation } from "@/app/lib/data";

// Prisma imports
import { FileType, HeuristicType, ImageType } from "@prisma/client";

// OpenAI imports
import OpenAI from "openai";

// Zod imports
import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";

// Other imports
import { v4 as uuidv4 } from "uuid";

interface FileData {
  name: string;
  data: string;
}

interface User {
  id: string;
  name: string | null;
  email: string;
  emailVerified: Date | null;
  image: string | null;
  credits: number;
  createdAt: Date;
  updatedAt: Date;
}

const heuristicEvaluationFormat = z.object({
  results: z.array(
    z.object({
      id: z.string(),
      heuristic: z.string(),
      type: z.string(),
      violated: z.union([z.literal("yes"), z.literal("no")]),
      reason: z.string(),
      recommendation: z.string(),
    }),
  ),
});

const openai = new OpenAI();

// const nielsen = `The design should always keep users informed about what is going on, through appropriate feedback within a reasonable amount of time;
//                  The design should speak the users' language. Use words, phrases, and concepts familiar to the user, rather than internal jargon. Follow real-world conventions, making information appear in a natural and logical order;
//                  Users often perform actions by mistake. They need a clearly marked "emergency exit" to leave the unwanted action without having to go through an extended process;
//                  Users should not have to wonder whether different words, situations, or actions mean the same thing. Follow platform and industry conventions;
//                  Good error messages are important, but the best designs carefully prevent problems from occurring in the first place. Either eliminate error-prone conditions, or check for them and present users with a confirmation option before they commit to the action;
//                  Minimize the user's memory load by making elements, actions, and options visible. The user should not have to remember information from one part of the interface to another. Information required to use the design (e.g. field labels or menu items) should be visible or easily retrievable when needed;
//                  Shortcuts — hidden from novice users — may speed up the interaction for the expert user so that the design can cater to both inexperienced and experienced users. Allow users to tailor frequent actions;
//                  Interfaces should not contain information that is irrelevant or rarely needed. Every extra unit of information in an interface competes with the relevant units of information and diminishes their relative visibility;
//                  Error messages should be expressed in plain language (no error codes), precisely indicate the problem, and constructively suggest a solution;
//                  It’s best if the system doesn’t need any additional explanation. However, it may be necessary to provide documentation to help users understand how to complete their tasks.`;

// const tenets = `A provided cue is not noticed, or is slow to be noticed, because its appearance or location differs from what the user expects;
//                 No cue is provided to signal to the user how to achieve a goal, and the user has insufficient prior learning to overcome its absence;
//                 Something in the UI suddenly appears or others draws the user's attention, distracting them from their goal;
//                 A cue critical to achieving a goal is noticed, but is meaning, or the required method or interacting with it, is unclear;
//                 A cue is incorrectly judged as a means for achieving a goal. It looks right, but is wrong;
//                 A critical relationship between two or more otherwise notiable cues is not obvious;
//                 The system does not allow the user to issue a command or complete a sequence of actions in the order or manner that is most nature to them;
//                 The system requires the user to remember information that us easy to forget;
//                 The system fails to provide noticeable, comprehensive, and actionable feedback in response to user actions;
//                 An action the system requires the user to perform is physically effortful, difficult, or impossible;
//                 The system misinterprets a user's physical actions resulting in an unintended outcome;
//                 The user is prevented from achieving a goal in a timely manner because of actual or perceived poor system performance;
//                 The user is prevented from achieving a goal in a timely manner because the system intentionally prevents them from advancing and/or backing out of a process;
//                 When the product is being used as intended, the number of actual or perceived steps required to achieve a goal is too high;
//                 The system re-prompts the user for information it previously gathered, or otherwise fails to leverage the user's prior work;
//                 Information presented to the user is comprehensible, but there is too much of it;
//                 The system incorrectly predicts or interprets the user's intent or preference, resulting in the user having to work around the problem;
//                 The system does not allow the user to undo an action they have taken;
//                 The system makes the user's data or behavior public in a way that is harmful or embarassing to the user;
//                 The system can lose the user's work through some action or inaction on the user's part;
//                 The system presents duplicate cues for the same action on the same level, or directly nested level of the UI;
//                 The system responds differently at different times to the same user action;
//                 The physical location of a cue for a given action varies across the UI;
//                 The visual appearance of a cue for a given action varies across the UI;
//                 The UI provides no single place the user can return to at any time to begin a new task or get re-iriented;
//                 The UI is aesthetically pleasing, inconsistent, and/or inappropriate for its intended users.`;

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

export async function heuristicEvaluation(
  goal: string,
  files: Array<FileData>,
  heuristic: string,
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
    text: `Each of the files uploaded contains a user interface to achieve the following user goal: ${goal}. For each interface and heuristic, identify which of the below heuristics are violated. Return the id of the heuristic, the heuristic, the heuristic type, the reason the heuristic is violated or not, and a recommendation to improve the interface only if the heuristic is violated. Each interface may violate the same heuristic multiple times. The heuristics to evaluate are: ${heuristics.map((heuristic) => `${heuristic.id}, ${heuristic.heuristic}, ${heuristic.type}`).join("\n ")}`,
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
          "You are a detail-oriented user experience researcher who provides a balanced, but critical view evaluating designs and experiences",
      },
      {
        role: "user",
        content: content,
      },
    ],
    stream: false,
    response_format: zodResponseFormat(
      heuristicEvaluationFormat,
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

  const name: string | null = data.get("name") as string;
  const goal: string | null = data.get("goal") as string;
  const files: Array<File> | null = data.getAll("file") as Array<File>;
  const heuristic: string | null = data.get("heuristic") as string;

  // The user does not have enough credits
  if (user.credits <= 0) {
    return {
      errors: { fieldErrors: { credits: `You don't have enough credits.` } },
    };
  }

  if (user?.id && goal && files && heuristic) {
    const base64_files = await Promise.all(
      files.map(async (file) => {
        const bytes = await file.arrayBuffer();
        const data = Buffer.from(bytes).toString("base64");
        return {
          name: file.name,
          size: file.size,
          type: file.type,
          data: data,
        };
      }),
    );

    // Process data
    const openai_response = await heuristicEvaluation(
      goal,
      base64_files,
      heuristic,
    );

    // Check if the model refused to respond
    if (openai_response.choices[0].message.refusal) {
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
      base64_files,
      keys,
      heuristic,
      openai_response.choices[0].message.parsed.results,
    );

    // Open the results view
    redirect(`/heuristic/${db_response.id}`);
  }
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
