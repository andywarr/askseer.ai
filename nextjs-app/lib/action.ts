// @ts-nocheck
"use server";

// AWS imports
import {
  S3Client,
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

//Next imports
import { redirect } from "next/navigation";

// NextAuth imports
import { auth, signOut } from "@/auth";

// Lib function imports
import { getStudy, postStudy, updateCredits, updateStatus } from "@/lib/data";

// OpenAI imports
import OpenAI from "openai";

// Prisma imports
import { HeuristicType } from "@prisma/client";

// Schema imports
import {
  heuristicEvaluationSchema,
  cognitiveWalkthroughSchema,
} from "@/lib/schema";

// Zod imports
import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";

// Other imports
import { v4 as uuidv4 } from "uuid";

// Study types
const cognitiveWalkthroughType = "cognitive_walkthrough";
const heuristicEvaluationType = "heuristic_evaluation";

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

export async function cognitiveWalkthroughFormAction(
  formData: FormData,
  keys: Array<string>,
) {
  try {
    const { user } = await auth();

    // Validate the data
    if (!validateData(formData, cognitiveWalkthroughSchema)) {
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

    // Process the data
    const data = processFormData(
      formData,
      keys,
      cognitiveWalkthroughType,
      user.id,
    );

    // Create a study
    const study = await postStudy({
      data,
      task: cognitiveWalkthroughType,
    });

    const jobData = {
      data,
      studyId: study.id,
      task: cognitiveWalkthroughType,
    };

    // Add the Cognitive Walkthrough job to the queue
    const response = await addJobToQueue(jobData);

    console.log("Job added:", response);
    if (!response.success) {
      return {
        errors: { fieldErrors: { form: `Error adding job to queue.` } },
      };
    }

    // Update the user credits
    await updateCredits(user.id, -1);
  } catch (error) {
    console.error("Error processing form data:", error);
    return {
      errors: { fieldErrors: { form: `Error processing form data.` } },
    };
  }

  // Redirect to the studies page
  redirect(`/studies`);
}

const validateData = (data, schema) => {
  const result = schema.safeParse(data);

  return result;
};

const addJobToQueue = async (jobData: object) => {
  try {
    const sqsClient = new SQSClient({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });

    const params = {
      QueueUrl: process.env.AWS_SQS_QUEUE_URL!,
      MessageBody: JSON.stringify(jobData),
    };

    const command = new SendMessageCommand(params);
    const response = await sqsClient.send(command);

    return { success: true, messageId: response.MessageId };
  } catch (error) {
    console.error("Error sending message to SQS:", error);
    return { success: false, error: (error as Error).message };
  }
};

const processFormData = (
  formData: FormData,
  keys: Array<string>,
  type: string,
  userId: string,
) => {
  const files = formData.getAll("file") as Array<File>;

  const filesMetadata = files.map((file: File, index: number) => ({
    name: file.name,
    key: keys[index],
    size: file.size,
    type: file.type,
  }));

  const data = {
    name: formData.get("name") as string,
    goal: formData.get("goal") as string,
    files: filesMetadata,
    context: formData.get("context") as string | null,
    heuristic: formData.get("heuristic")
      ? formData.get("heuristic")
      : ("" as string | null),
    type: type,
    userId: userId,
  };

  return data;
};

export async function heuristicEvaluationFormAction(
  formData: FormData,
  keys: Array<string>,
) {
  try {
    const { user } = await auth();

    // Validate the data
    if (!validateData(formData, heuristicEvaluationSchema)) {
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

    // Process the data
    let data = processFormData(
      formData,
      keys,
      heuristicEvaluationType,
      user.id,
    );

    // Create a study
    const study = await postStudy({
      data,
      task: heuristicEvaluationType,
    });

    const jobData = {
      data,
      studyId: study.id,
      task: heuristicEvaluationType,
    };

    // Add the Cognitive Walkthrough job to the queue
    const response = await addJobToQueue(jobData);

    console.log("Job added:", response);

    if (!response.success) {
      return {
        errors: { fieldErrors: { form: `Error adding job to queue.` } },
      };
    }

    // Update the user credits
    await updateCredits(user.id, -1);
  } catch (error) {
    console.error("Error processing form data:", error);
    return {
      errors: { fieldErrors: { form: `Error processing form data.` } },
    };
  }

  // Redirect to the studies page
  redirect(`/studies`);
}

export async function retryStudy(studyId: string) {
  try {
    const { user } = await auth();

    // Get the study
    const study = await getStudy(studyId, user.id);

    const jobData = {
      data,
      studyId: study.id,
      task: study.type,
    };

    // Add the Cognitive Walkthrough job to the queue
    const response = await addJobToQueue(jobData);

    await updateStatus(studyId, "pending");

    console.log("Job added:", response);
  } catch (error) {
    console.error("Error retrying study:", error);
  }

  // Redirect to the studies page
  redirect(`/studies`);
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
