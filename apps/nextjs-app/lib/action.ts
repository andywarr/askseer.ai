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
import { auth, signOut } from "@/apps/nextjs-app/auth";

// Lib function imports
import {
  getStudy,
  postStudy,
  updateCredits,
  updateStatus,
} from "@/apps/nextjs-app/lib/data";

// OpenAI imports
import OpenAI from "openai";

// Prisma imports
import { HeuristicType } from "@prisma/client";

// Schema imports
import {
  heuristicEvaluationSchema,
  cognitiveWalkthroughSchema,
} from "@/apps/nextjs-app/lib/schema";

// Zod imports
import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";

// Other imports
import { v4 as uuidv4 } from "uuid";

// Resend imports
import { Resend } from "resend";

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

    let jobData = {
      data,
    };

    // Create a study
    const study = await postStudy(jobData);

    jobData.studyId = study.id;

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

    let jobData = {
      data,
    };

    // Create a study
    const study = await postStudy(jobData);

    jobData.studyId = study.id;

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
      data: study.jobData.data,
      studyId: study.id,
      task: study.type.toLowerCase(),
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

// Credit request server action
export async function submitCreditRequest(formData: FormData) {
  const resend = new Resend(process.env.AUTH_RESEND_KEY);

  // Extract form data
  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const credits = parseInt(formData.get("credits") as string);

  // Validation schema for the credit request form
  const creditRequestSchema = z.object({
    name: z
      .string()
      .min(1, "Name is required")
      .max(100, "Name must be less than 100 characters"),
    email: z.string().email("Please enter a valid email address"),
    credits: z
      .number()
      .min(1, "You must request at least 1 credit")
      .max(
        1000,
        "To purchase more than 1000 credits, please email payments@askseer.ai",
      ),
  });

  try {
    // Validate the form data
    const validation = creditRequestSchema.safeParse({ name, email, credits });
    if (!validation.success) {
      return {
        success: false,
        error: "Invalid form data",
        details: validation.error.errors,
      };
    }

    const {
      name: validName,
      email: validEmail,
      credits: validCredits,
    } = validation.data;

    // Calculate total cost using the same logic as the pricing page
    const calculateTotalCost = (credits: number): number => {
      let total = 0;

      if (credits <= 0) return 0;

      // First tier: 1-9 credits at $19.99 each
      const tier1Credits = Math.min(credits, 9);
      total += tier1Credits * 19.99;
      credits -= tier1Credits;

      if (credits <= 0) return total;

      // Second tier: 10-19 credits at $14.99 each
      const tier2Credits = Math.min(credits, 10);
      total += tier2Credits * 14.99;
      credits -= tier2Credits;

      if (credits <= 0) return total;

      // Third tier: 20-49 credits at $9.99 each
      const tier3Credits = Math.min(credits, 30);
      total += tier3Credits * 9.99;
      credits -= tier3Credits;

      if (credits <= 0) return total;

      // Fourth tier: 50+ credits at $4.99 each
      total += credits * 4.99;

      return total;
    };

    const totalCost = calculateTotalCost(validCredits);

    // Send email to payments@askseer.ai
    const { data, error } = await resend.emails.send({
      from: process.env.AUTH_RESEND_FROM || "onboarding@resend.dev",
      to: ["payments@askseer.ai"],
      subject: `Credit Purchase Request - ${validName}`,
      html: `
        <h2>New Credit Purchase Request</h2>
        <p><strong>Customer Details:</strong></p>
        <ul>
          <li><strong>Name:</strong> ${validName}</li>
          <li><strong>Email:</strong> ${validEmail}</li>
          <li><strong>Credits Requested:</strong> ${validCredits}</li>
          <li><strong>Total Cost:</strong> $${totalCost.toFixed(2)}</li>
        </ul>
        <p>Please follow up with the customer to process their credit purchase within 2 business days.</p>
      `,
      text: `
        New Credit Purchase Request
        
        Customer Details:
        Name: ${validName}
        Email: ${validEmail}
        Credits Requested: ${validCredits}
        Total Cost: $${totalCost.toFixed(2)}
        
        Please follow up with the customer to process their credit purchase within 2 business days.
      `,
    });

    if (error) {
      console.error("Resend error:", error);
      return {
        success: false,
        error: "Failed to send email",
      };
    }

    // Send confirmation email to the customer
    const customerEmailResponse = await resend.emails.send({
      from: process.env.AUTH_RESEND_FROM || "onboarding@resend.dev",
      to: [validEmail],
      subject: "Seer Credit Purchase Request Confirmation",
      html: `
        <h2>Thank you for your credit purchase request!</h2>
        <p>Hi ${validName},</p>
        <p>We've received your credit purchase request and will contact you within 2 business days to process your credit purchase.</p>
        
        <h3>Request Details:</h3>
        <ul>
          <li><strong>Name:</strong> ${validName}</li>
          <li><strong>Email:</strong> ${validEmail}</li>
          <li><strong>Credits Requested:</strong> ${validCredits}</li>
          <li><strong>Total Cost:</strong> $${totalCost.toFixed(2)}</li>
        </ul>
        
        <p>If you have any questions, please don't hesitate to reach out to us at payments@askseer.ai</p>
        
        <p>Best regards,<br>The Seer Team</p>
      `,
      text: `
        Thank you for your credit purchase request!
        
        Hi ${validName},
        
        We've received your credit purchase request and will contact you within 2 business days to process your credit purchase.
        
        Request Details:
        Name: ${validName}
        Email: ${validEmail}
        Credits Requested: ${validCredits}
        Total Cost: $${totalCost.toFixed(2)}
        
        If you have any questions, please don't hesitate to reach out to us at payments@askseer.ai

        Best regards,

        The Seer Team
      `,
    });

    if (customerEmailResponse.error) {
      console.error("Customer email error:", customerEmailResponse.error);
      // Don't fail the entire request if customer email fails, but log it
    }

    return {
      success: true,
      message: "Credit request submitted successfully",
      emailId: data?.id,
      customerEmailId: customerEmailResponse.data?.id,
    };
  } catch (error) {
    console.error("Credit request error:", error);
    return {
      success: false,
      error: "Internal server error",
    };
  }
}
