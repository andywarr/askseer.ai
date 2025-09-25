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
  updateAttempts,
  updateStatus,
  initStudyDb,
  finalizeStudyDb,
  listPersonas,
  consumeTeamCreditByStudy,
  updateStudyTeam,
  getTeam,
  getCompanyMembers,
  updateUserSelectedTeam,
} from "@/apps/nextjs-app/lib/data";
import { logger } from "@/apps/shared/logger.ts";

// Prisma imports
import { HeuristicType } from "@prisma/client";

// Schema imports
import {
  heuristicEvaluationSchema,
  cognitiveWalkthroughSchema,
} from "@/apps/nextjs-app/lib/schema";

// Zod imports
import { z } from "zod";

// Other imports
import { v4 as uuidv4 } from "uuid";

// Resend imports
import { Resend } from "resend";
import {
  parseJobEnvelope,
  CognitiveWalkthroughPayloadV2,
  HeuristicEvaluationPayloadV2,
  PersonaPayloadV2,
  PersonaSchema,
  TaskV2Enum,
} from "@/apps/shared/jobSchema";

// Study types
const cognitiveWalkthroughType = "cognitive_walkthrough";
const heuristicEvaluationType = "heuristic_evaluation";
const personaType = "persona";

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

    logger.debug("Successfully sent message to SQS", {
      messageId: response.MessageId,
      queueUrl: process.env.AWS_SQS_QUEUE_URL,
    });

    return { success: true, messageId: response.MessageId };
  } catch (error) {
    logger.error("Error sending message to SQS", {
      error: error.message,
      queueUrl: process.env.AWS_SQS_QUEUE_URL,
      stack: error.stack,
    });
    return { success: false, error: (error as Error).message };
  }
};

export async function retryStudy(studyId: string) {
  try {
    const { user } = await auth();

    logger.debug("Starting study retry", {
      userId: user.id,
      studyId,
    });

    // Get the study
    const study = await getStudy(studyId, user.id);

    let jobData: any;
    const stored = study.jobData || {};

    try {
      parseJobEnvelope(stored);
    } catch (e) {
      logger.error("Invalid v2 jobData on retry", {
        studyId,
        error: (e as Error)?.message,
      });
      throw new Error("Invalid v2 jobData on retry");
    }

    const task = (study.type || "").toLowerCase();
    const base = stored?.payload || { files: study.files || [] };
    jobData =
      task === "heuristic_evaluation"
        ? {
            version: 2,
            studyId: study.id,
            userId: user.id,
            type: task,
            payload: {
              ...base,
              heuristic: (
                ((base as any)?.heuristic as string) || ""
              ).toUpperCase(),
            },
            retry: true,
          }
        : {
            version: 2,
            studyId: study.id,
            userId: user.id,
            type: task,
            payload: {
              ...base,
            },
            retry: true,
          };

    // Add the job to the queue
    const response = await addJobToQueue(jobData);

    if (!response.success) {
      logger.error("Failed to add retry job to queue", {
        userId: user.id,
        studyId,
        error: response.error,
      });
    }

    logger.info("Study retry job added to queue", {
      userId: user.id,
      studyId,
      studyType: study.type,
      messageId: response.messageId,
      success: response.success,
    });

    // TODO: This should be one call to the database worker
    await updateAttempts(studyId);
    await updateStatus(studyId, "pending");
  } catch (error) {
    logger.error("Error retrying study", {
      userId: user?.id,
      studyId,
      error: error.message,
      stack: error.stack,
    });
    return { success: false };
  }

  // Do not redirect; let caller handle UI refresh/state.
  return { success: true };
}

export async function signOutServerAction() {
  try {
    const { user } = await auth();

    logger.debug("User signing out", {
      userId: user?.id,
    });

    await signOut();

    logger.info("User signed out successfully", {
      userId: user?.id,
    });
  } catch (error) {
    logger.error("Error during sign out", {
      error: error.message,
      stack: error.stack,
    });
    // Still call signOut even if there's an error getting user info
    await signOut();
  }
}

export async function updateSelectedTeamAction(teamId: string) {
  const { user } = await auth();

  if (!user?.id) {
    throw new Error("Unauthorized");
  }

  if (!teamId) {
    throw new Error("Team ID is required");
  }

  try {
    await updateUserSelectedTeam(user.id, teamId);
    logger.info("Updated selected team for user", {
      userId: user.id,
      teamId,
    });
    return { success: true };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update selected team";
    logger.error("Failed to update selected team", {
      userId: user.id,
      teamId,
      error: message,
    });
    throw new Error(message);
  }
}

function generateRandomFileName(originalFileName) {
  const fileExtension = originalFileName.split(".").pop(); // Extract the file extension
  const uniqueId = uuidv4(); // Generate a unique ID
  return `${uniqueId}.${fileExtension}`; // Combine them
}

export async function getProfileImagePutUrl(
  fileName: string,
  fileType: string,
  fileSize: number,
) {
  const { user } = await auth();

  const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
  const MAX_SIZE = 5 * 1024 * 1024; // 5MB

  if (!ALLOWED_TYPES.includes(fileType)) {
    logger.warn("Invalid profile image content type", {
      userId: user.id,
      fileType,
    });
    throw new Error("Unsupported image type. Use JPEG, PNG, or WEBP.");
  }
  if (fileSize > MAX_SIZE) {
    logger.warn("Profile image exceeds max size", {
      userId: user.id,
      fileSize,
    });
    throw new Error("Image too large. Max 5MB.");
  }

  const bucketName = process.env.AWS_BUCKET_NAME;
  const s3Client = new S3Client({ region: process.env.AWS_REGION });
  const key = `users/${user.id}/profile/${generateRandomFileName(fileName)}`;

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    ContentType: fileType,
  });

  try {
    const uploadURL = await getSignedUrl(s3Client, command, { expiresIn: 60 });
    logger.debug("Generated presigned URL for profile image", {
      userId: user.id,
      key,
      fileType,
    });
    return { uploadURL, key };
  } catch (error) {
    logger.error("Error generating profile image presigned URL", {
      userId: user.id,
      fileType,
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

export async function getCompanyLogoPutUrl(
  companyId: string,
  fileName: string,
  fileType: string,
  fileSize: number,
) {
  const { user } = await auth();

  const ALLOWED_TYPES = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/svg+xml",
  ];
  const MAX_SIZE = 5 * 1024 * 1024; // 5MB

  if (!ALLOWED_TYPES.includes(fileType)) {
    logger.warn("Invalid company logo content type", {
      userId: user.id,
      fileType,
    });
    throw new Error("Unsupported image type. Use JPEG, PNG, WEBP, or SVG.");
  }
  if (fileSize > MAX_SIZE) {
    logger.warn("Company logo exceeds max size", {
      userId: user.id,
      fileSize,
    });
    throw new Error("Image too large. Max 5MB.");
  }

  const bucketName = process.env.AWS_BUCKET_NAME;
  const s3Client = new S3Client({ region: process.env.AWS_REGION });
  const key = `companies/${companyId}/logo/${generateRandomFileName(fileName)}`;

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    ContentType: fileType,
  });

  try {
    const uploadURL = await getSignedUrl(s3Client, command, { expiresIn: 60 });
    logger.debug("Generated presigned URL for company logo", {
      userId: user.id,
      companyId,
      key,
      fileType,
    });
    return { uploadURL, key };
  } catch (error) {
    logger.error("Error generating company logo presigned URL", {
      userId: user.id,
      companyId,
      fileType,
      error: (error as any).message,
    });
    throw error;
  }
}

export async function initStudy(name: string | null, type: string) {
  const { user } = await auth();
  return await initStudyDb(name, type, user.id, user.selectedTeamId);
}

export async function getStudyUploadUrls(
  studyId: string,
  fileMetadata: Array<{ name: string; size: number; type: string }>,
) {
  const { user } = await auth();
  logger.debug("Generating presigned URLs for study upload", {
    userId: user.id,
    teamId: user.selectedTeamId,
    studyId,
    fileCount: fileMetadata.length,
  });
  const bucketName = process.env.AWS_BUCKET_NAME;
  const s3Client = new S3Client({ region: process.env.AWS_REGION });
  const urls = await Promise.all(
    fileMetadata.map(async (file) => {
      const fileName = generateRandomFileName(file.name);
      const key = `studies/${user.selectedTeamId}/${studyId}/uploads/${fileName}`;
      try {
        const uploadURL = await getSignedUrl(
          s3Client,
          new PutObjectCommand({
            Bucket: bucketName,
            Key: key,
            ContentType: file.type,
          }),
          { expiresIn: 60 },
        );
        return { fileName, fileType: file.type, uploadURL, key };
      } catch (error) {
        logger.error("Error generating presigned URL (study upload)", {
          userId: user.id,
          studyId,
          file: file.name,
          error: error.message,
        });
        throw error;
      }
    }),
  );
  return urls;
}

export async function finalizeStudy(studyId: string, data: any) {
  // data expected: { studyId, files, jobData }
  return await finalizeStudyDb(studyId, data.files, data.jobData);
}

export async function putPresignedUrls(
  fileMetadata: Array<{ name: string; type: string; size: number }>,
  studyId: string,
) {
  const { user } = await auth();
  if (!studyId) {
    logger.error("putPresignedUrls called without studyId (hard enforcement)", {
      userId: user?.id,
    });
    throw new Error("studyId is required");
  }
  if (!Array.isArray(fileMetadata) || fileMetadata.length === 0) {
    logger.error("putPresignedUrls called with invalid file metadata", {
      userId: user.id,
      studyId,
    });
    throw new Error("fileMetadata must be a non-empty array");
  }
  if (fileMetadata.some((f) => !f.name || !f.type || !f.size)) {
    logger.error("putPresignedUrls called with incomplete file metadata", {
      userId: user.id,
      studyId,
      fileMetadata,
    });
    throw new Error("Each file must have name, type, and size");
  }
  logger.debug("Generating presigned URLs for file upload", {
    userId: user.id,
    fileCount: fileMetadata.length,
    studyId,
  });
  const bucketName = process.env.AWS_BUCKET_NAME;
  const s3Client = new S3Client({ region: process.env.AWS_REGION });
  const urls = await Promise.all(
    fileMetadata.map(async (file) => {
      const fileName = generateRandomFileName(file.name);
      const fileType = file.type;
      const key = `studies/${user.selectedTeamId}/${studyId}/uploads/${fileName}`;
      try {
        const uploadURL = await getSignedUrl(
          s3Client,
          new PutObjectCommand({
            Bucket: bucketName,
            Key: key,
            ContentType: fileType,
          }),
          { expiresIn: 60 },
        );
        return { fileName, fileType, uploadURL, key };
      } catch (error) {
        logger.error("Error generating pre-signed URL", {
          userId: user.id,
          fileName: file.name,
          fileType,
          studyId,
          error: error.message,
        });
        throw error;
      }
    }),
  );
  return urls;
}

// Email template helper functions
function createStyledEmailHtml(params: {
  title: string;
  subtitle: string;
  content: string;
  brandColor?: string;
  buttonText?: string;
  buttonUrl?: string;
  showFooter?: boolean;
}) {
  const {
    title,
    subtitle,
    content,
    brandColor = "#18181b",
    buttonText,
    buttonUrl,
    showFooter = true,
  } = params;

  const baseUrl = process.env.NEXTAUTH_URL || "https://askseer.ai";

  const color = {
    background: "#f8fafc",
    text: "#3f3f46",
    mainBackground: "#ffffff",
    cardBackground: "#ffffff",
    buttonBackground: brandColor,
    buttonBorder: brandColor,
    buttonText: "#ffffff",
    accent: "#f1f5f9",
    border: "#e2e8f0",
  };

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: ${color.background}; font-family: 'Roboto', system-ui, -apple-system, Arial, sans-serif; line-height: 1.6;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: ${color.background}; min-height: 100vh;">
    <tr>
      <td align="center" style="padding: 20px 20px;">
        <!-- Main container -->
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: ${color.cardBackground}; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); border: 1px solid ${color.border};">
          <!-- Header with logo -->
          <tr>
            <td align="center" style="padding: 40px 40px 20px 40px;">
              <div style="text-align:center;">
                <img src="${baseUrl}/logo-black.png" alt="Seer logo" height="30" width="32" style="display:block;margin:0 auto 8px;" />
                <h1 style="margin: 0; font-size: 28px; font-weight: 800; color: ${brandColor}; letter-spacing: -0.025em;">Seer</h1>
              </div>
            </td>
          </tr>
          
          <!-- Main content -->
          <tr>
            <td align="center" style="padding: 0 40px 20px 40px;">
              <h2 style="margin: 0 0 16px 0; font-size: 24px; font-weight: 600; color: ${color.text}; line-height: 1.25;">
                ${title}
              </h2>
              <p style="margin: 0 0 32px 0; font-size: 16px; color: #64748b; line-height: 1.5;">
                ${subtitle}
              </p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 0 40px 32px 40px;">
              ${content}
            </td>
          </tr>
          
          ${
            buttonText && buttonUrl
              ? `
          <!-- CTA Button -->
          <tr>
            <td align="center" style="padding: 0 40px 32px 40px;">
              <table border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center" style="border-radius: 8px; background-color: ${color.buttonBackground}; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);">
                    <a href="${buttonUrl}" target="_blank" style="display: inline-block; padding: 12px 32px; font-size: 16px; font-weight: 500; color: ${color.buttonText}; text-decoration: none; border-radius: 8px; transition: all 0.2s ease;">
                      ${buttonText}
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          `
              : ""
          }
          
          <!-- Divider -->
          <tr>
            <td style="padding: 0 40px;">
              <hr style="border: none; border-top: 1px solid ${color.border}; margin: 0;">
            </td>
          </tr>
          
          ${
            showFooter
              ? `
          <!-- Footer -->
          <tr>
            <td align="center" style="padding: 32px 40px 40px 40px;">
              <p style="margin: 0 0 8px 0; font-size: 14px; color: #64748b; line-height: 1.5;">
                Questions? Contact us at payments@askseer.ai
              </p>
              <p style="margin: 0; font-size: 12px; color: #94a3b8;">
                We'll respond within 2 business days.
              </p>
            </td>
          </tr>
          `
              : `
          <!-- Minimal footer spacing -->
          <tr>
            <td style="padding: 20px 40px;">
            </td>
          </tr>
          `
          }
        </table>
        
        <!-- Footer text outside card -->
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; margin-top: 24px;">
          <tr>
            <td align="center">
              <p style="margin: 0; font-size: 12px; color: #94a3b8; line-height: 1.5;">
                © ${new Date().getFullYear()} Seer. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
}

// Credit request server action
export async function submitCreditRequest(formData: FormData) {
  const resend = new Resend(process.env.AUTH_RESEND_KEY);

  // Extract form data
  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const credits = parseInt(formData.get("credits") as string);

  logger.debug("Processing credit request", {
    name,
    email,
    credits,
  });

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
      logger.warn("Credit request validation failed", {
        name,
        email,
        credits,
        errors: validation.error.errors,
      });
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

    logger.info("Processing credit request with calculated cost", {
      name: validName,
      email: validEmail,
      credits: validCredits,
      totalCost,
    });

    // Create styled email content for payments team
    const paymentsEmailContent = `
      <div style="background-color: #f8fafc; padding: 24px; border-radius: 8px; margin: 16px 0;">
        <h3 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 600; color: #3f3f46;">Customer Details</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 12px 0; font-weight: 500; color: #3f3f46; width: 35%;">Name:</td>
            <td style="padding: 12px 0; color: #64748b;">${validName}</td>
          </tr>
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 12px 0; font-weight: 500; color: #3f3f46;">Email:</td>
            <td style="padding: 12px 0; color: #64748b;">${validEmail}</td>
          </tr>
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 12px 0; font-weight: 500; color: #3f3f46;">Credits Requested:</td>
            <td style="padding: 12px 0; color: #64748b;">${validCredits}</td>
          </tr>
          <tr>
            <td style="padding: 12px 0; font-weight: 500; color: #3f3f46;">Total Cost:</td>
            <td style="padding: 12px 0; color: #16a34a; font-weight: 600; font-size: 18px;">$${totalCost.toFixed(2)}</td>
          </tr>
        </table>
      </div>
      <div style="background-color: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 16px; margin: 16px 0;">
        <p style="margin: 0; color: #92400e; font-weight: 500;">
          Action Required: Please follow up with the customer within 2 business days to process their credit purchase.
        </p>
      </div>
    `;

    // Send email to payments@askseer.ai
    const { data, error } = await resend.emails.send({
      from: process.env.AUTH_RESEND_FROM || "onboarding@resend.dev",
      to: ["payments@askseer.ai"],
      subject: `Credit Purchase Request - ${validName}`,
      html: createStyledEmailHtml({
        title: "New Credit Purchase Request",
        subtitle:
          "A customer has submitted a credit purchase request that requires processing.",
        content: paymentsEmailContent,
        showFooter: false,
      }),
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
      logger.error("Failed to send credit request email to payments team", {
        name: validName,
        email: validEmail,
        credits: validCredits,
        error: error.message,
      });
      return {
        success: false,
        error: "Failed to send email",
      };
    }

    logger.info("Credit request email sent to payments team", {
      name: validName,
      email: validEmail,
      credits: validCredits,
      totalCost,
      emailId: data?.id,
    });

    // Create styled email content for customer confirmation
    const customerEmailContent = `
      <p style="margin: 16px 0; font-size: 16px; color: #64748b; line-height: 1.6;">
        Hi ${validName},
      </p>
      
      <p style="margin: 16px 0; font-size: 16px; color: #64748b; line-height: 1.6;">
        We've received your credit purchase request and will contact you within 2 business days to process your credit purchase.
      </p>
      
      <div style="background-color: #f8fafc; padding: 24px; border-radius: 8px; margin: 24px 0; border: 1px solid #e2e8f0;">
        <h3 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 600; color: #3f3f46;">Credit Request Summary</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 12px 0; font-weight: 500; color: #3f3f46; width: 40%;">Name:</td>
            <td style="padding: 12px 0; color: #64748b;">${validName}</td>
          </tr>
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 12px 0; font-weight: 500; color: #3f3f46;">Email:</td>
            <td style="padding: 12px 0; color: #64748b;">${validEmail}</td>
          </tr>
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 12px 0; font-weight: 500; color: #3f3f46;">Credits Requested:</td>
            <td style="padding: 12px 0; color: #64748b; font-weight: 500;">${validCredits}</td>
          </tr>
          <tr>
            <td style="padding: 12px 0; font-weight: 500; color: #3f3f46;">Total Cost:</td>
            <td style="padding: 12px 0; color: #16a34a; font-weight: 600; font-size: 18px;">$${totalCost.toFixed(2)}</td>
          </tr>
        </table>
      </div>
      
      <p style="margin: 24px 0 16px 0; font-size: 16px; color: #64748b; line-height: 1.6;">
        If you have any questions in the meantime, please don't hesitate to reach out to us at 
        <a href="mailto:payments@askseer.ai" style="color: #18181b; text-decoration: none; font-weight: 500;">payments@askseer.ai</a>
      </p>
      
      <div style="margin: 32px 0; padding: 20px; background-color: #f8fafc; border-radius: 8px; text-align: center;">
        <p style="margin: 0; font-size: 16px; color: #3f3f46; font-weight: 500;">
          Best regards,<br>
          <span style="color: #18181b; font-weight: 600;">The Seer Team</span>
        </p>
      </div>
    `;

    // Send confirmation email to the customer
    const customerEmailResponse = await resend.emails.send({
      from: process.env.AUTH_RESEND_FROM || "onboarding@resend.dev",
      to: [validEmail],
      subject: "Seer Credit Purchase Request Confirmation",
      html: createStyledEmailHtml({
        title: "Thank you for your request",
        subtitle:
          "Your credit purchase request is being processed and we'll be in touch soon.",
        content: customerEmailContent,
      }),
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
      logger.error(
        "Failed to send credit request confirmation email to customer",
        {
          name: validName,
          email: validEmail,
          error: customerEmailResponse.error.message,
        },
      );
      // Don't fail the entire request if customer email fails, but log it
    }

    logger.info("Credit request confirmation email sent to customer", {
      name: validName,
      email: validEmail,
      customerEmailId: customerEmailResponse.data?.id,
    });

    logger.info("Credit request submitted successfully", {
      name: validName,
      email: validEmail,
      credits: validCredits,
      totalCost,
      paymentsEmailId: data?.id,
      customerEmailId: customerEmailResponse.data?.id,
    });

    return {
      success: true,
      message: "Credit request submitted successfully",
      emailId: data?.id,
      customerEmailId: customerEmailResponse.data?.id,
    };
  } catch (error) {
    logger.error("Error processing credit request", {
      name,
      email,
      credits,
      error: error.message,
      stack: error.stack,
    });
    return {
      success: false,
      error: "Internal server error",
    };
  }
}

export async function getPresignedUrls(key: string) {
  const { user } = await auth();
  // Basic ownership / scope check: allow keys that start with allowed prefixes for this user
  const allowed = [
    `${user?.id}/`, // legacy
    `studies/${user?.id}/`, // Pre-teams studies
    `studies/${user?.selectedTeamId}/`, // Post-teams studies
    `users/${user?.id}/`, // profile images
  ];
  if (!allowed.some((p) => key.startsWith(p))) {
    logger.warn("Forbidden presigned GET URL request due to prefix mismatch", {
      userId: user?.id,
      key,
    });
    throw new Error("Forbidden");
  }

  const s3Client = new S3Client({ region: process.env.AWS_REGION });
  const TIMEOUT = 3600;
  try {
    const url = await getSignedUrl(
      s3Client,
      new GetObjectCommand({ Bucket: process.env.AWS_BUCKET_NAME, Key: key }),
      { expiresIn: TIMEOUT },
    );
    return url;
  } catch (error) {
    logger.error("Error generating presigned GET URL", {
      key,
      error: error.message,
    });
    throw error;
  }
}

export async function getCompanyLogoGetUrl(companyId: string, key: string) {
  const { user } = await auth();
  if (!key.startsWith(`companies/${companyId}/`)) {
    logger.warn(
      "Forbidden presigned GET URL request for company due to prefix mismatch",
      {
        userId: user?.id,
        companyId,
        key,
      },
    );
    throw new Error("Forbidden");
  }
  const members = await getCompanyMembers(companyId);
  const isMember = members?.some((m: any) => m.userId === user.id);
  if (!isMember) {
    logger.warn(
      "Forbidden presigned GET URL request for company due to membership check",
      {
        userId: user?.id,
        companyId,
      },
    );
    throw new Error("Forbidden");
  }
  const s3Client = new S3Client({ region: process.env.AWS_REGION });
  const TIMEOUT = 3600;
  try {
    const url = await getSignedUrl(
      s3Client,
      new GetObjectCommand({ Bucket: process.env.AWS_BUCKET_NAME, Key: key }),
      { expiresIn: TIMEOUT },
    );
    return url;
  } catch (error) {
    logger.error("Error generating presigned GET URL (company)", {
      key,
      companyId,
      error: (error as any).message,
    });
    throw error;
  }
}

export async function listMyPersonas() {
  const { user } = await auth();
  // Reuse existing data layer function which validates auth and fetches from db-worker
  return await listPersonas(user.id);
}

export async function deleteS3Objects(keys: string[]) {
  const { user } = await auth();
  const bucketName = process.env.AWS_BUCKET_NAME;
  const region = process.env.AWS_REGION;
  const s3Client = new S3Client({ region });

  if (!Array.isArray(keys) || keys.length === 0) {
    logger.warn("deleteS3Objects called with empty keys array", {
      userId: user?.id,
    });
    return { success: true, deleted: [], skipped: [], errors: [] };
  }

  // Basic ownership / scope check: allow keys that start with allowed prefixes for this user
  const allowedPrefixes = [
    `${user.id}/`, // legacy
    `studies/${user.id}/`, // pre-teams
    `studies/${user.selectedTeamId}/`, // post-teams
    `users/${user.id}/`, // profile images
  ];

  const authorized: string[] = [];
  const skipped: string[] = [];
  for (const k of keys) {
    if (allowedPrefixes.some((p) => k.startsWith(p))) {
      authorized.push(k);
      continue;
    }
    if (k.startsWith("companies/")) {
      const parts = k.split("/");
      const companyId = parts[1];
      try {
        const members = await getCompanyMembers(companyId);
        const me = members?.find((m: any) => m.userId === user.id);
        if (me && String(me.role).toUpperCase() === "OWNER") {
          authorized.push(k);
          continue;
        }
      } catch (e) {
        // fall through
      }
    }
    skipped.push(k);
  }

  if (skipped.length) {
    logger.warn("Some keys skipped due to failed ownership / prefix check", {
      userId: user.id,
      skippedCount: skipped.length,
    });
  }

  const results = await Promise.all(
    authorized.map(async (key) => {
      try {
        await s3Client.send(
          new DeleteObjectCommand({ Bucket: bucketName, Key: key }),
        );
        logger.debug("Deleted S3 object", { userId: user.id, key });
        return { key, success: true };
      } catch (error) {
        logger.error("Failed to delete S3 object", {
          userId: user.id,
          key,
          error: error.message,
        });
        return { key, success: false, error: error.message };
      }
    }),
  );

  const deleted = results.filter((r) => r.success).map((r) => r.key);
  const errors = results
    .filter((r) => !r.success)
    .map((r) => ({ key: r.key, error: r.error }));

  return {
    success: errors.length === 0,
    deleted,
    skipped,
    errors,
  };
}

const STUDY_CONFIG = {
  cognitive_walkthrough: {
    type: cognitiveWalkthroughType,
    logLabel: "Cognitive walkthrough",
  },
  heuristic_evaluation: {
    type: heuristicEvaluationType,
    logLabel: "Heuristic evaluation",
  },
  persona: {
    type: personaType,
    logLabel: "Persona",
  },
} as const;

// Overloads for stricter payloads per study kind
export async function finalizeAndQueueStudy(
  kind: "cognitive_walkthrough",
  studyId: string,
  payload: CognitiveWalkthroughPayloadV2 & {
    files: NonNullable<CognitiveWalkthroughPayloadV2["files"]>;
  },
): Promise<any>;
export async function finalizeAndQueueStudy(
  kind: "heuristic_evaluation",
  studyId: string,
  payload: HeuristicEvaluationPayloadV2 & {
    files: NonNullable<HeuristicEvaluationPayloadV2["files"]>;
  },
): Promise<any>;
export async function finalizeAndQueueStudy(
  kind: "persona",
  studyId: string,
  payload: PersonaPayloadV2,
): Promise<any>;
export async function finalizeAndQueueStudy(
  kind: keyof typeof STUDY_CONFIG,
  studyId: string,
  payload: any,
) {
  try {
    const { user } = await auth();
    // Check team credits instead of user credits
    const team = await getTeam(user.selectedTeamId);
    if (!team || (team?.credits ?? 0) <= 0) {
      logger.warn(`Team lacks credits for ${kind} (finalize phase)`, {
        userId: user.id,
        teamId: user.selectedTeamId,
        studyId,
      });
      return {
        success: false,
        error: "Your team doesn't have enough credits.",
      };
    }

    const config = STUDY_CONFIG[kind as keyof typeof STUDY_CONFIG];
    if (!config || !config.type) {
      logger.error("Unrecognized study type in finalizeAndQueueStudy", {
        userId: user.id,
        studyId,
        kind,
      });
      return { success: false, error: "Invalid study type" };
    }
    const taskType = config.type;
    const allowedTypeCheck = TaskV2Enum.safeParse(taskType);
    if (!allowedTypeCheck.success) {
      logger.error("Study type not allowed by TaskV2Enum", {
        userId: user.id,
        studyId,
        kind,
        type: taskType,
      });
      return { success: false, error: "Invalid study type" };
    }

    let jobData: any;
    switch (kind) {
      case "heuristic_evaluation": {
        jobData = {
          version: 2,
          studyId,
          userId: user.id,
          type: taskType,
          payload: {
            name: payload.name,
            goal: payload.goal,
            user: payload.user,
            context: payload.context,
            files: payload.files,
            heuristic: (payload.heuristic || "").toUpperCase(),
            persona: (payload as any)?.persona,
          },
        };
        break;
      }
      case "persona": {
        // Minimal handling: ensure persona exists, then pass payload through.
        if (
          !payload ||
          typeof payload !== "object" ||
          !payload.persona ||
          typeof payload.persona !== "object"
        ) {
          logger.error(
            "Persona payload missing or invalid in finalizeAndQueueStudy",
            {
              userId: user.id,
              studyId,
            },
          );
          return { success: false, error: "Invalid job data" };
        }

        jobData = {
          version: 2,
          studyId,
          userId: user.id,
          type: taskType,
          payload,
        };
        break;
      }
      case "cognitive_walkthrough": {
        jobData = {
          version: 2,
          studyId,
          userId: user.id,
          type: taskType,
          payload: {
            name: payload.name,
            goal: payload.goal,
            user: payload.user,
            context: payload.context,
            files: payload.files,
            persona: (payload as any)?.persona,
          },
        };
        break;
      }
      default: {
        logger.error("Unhandled study kind in switch", { kind, studyId });
        return { success: false, error: "Invalid study type" };
      }
    }

    try {
      parseJobEnvelope(jobData);
    } catch (e) {
      logger.error("Invalid v2 jobData on finalize", {
        studyId,
        kind,
        error: (e as Error)?.message,
      });
      return { success: false, error: "Invalid job data" };
    }

    // Persist uploaded files according to study kind
    // - heuristic_evaluation and cognitive_walkthrough: files live at payload.files
    // - persona: optional generated/uploaded assets live at payload.persona.files
    const filesToPersist =
      kind === "persona"
        ? Array.isArray(payload?.persona?.files)
          ? payload.persona.files
          : []
        : Array.isArray(payload?.files)
          ? payload.files
          : [];

    const selectedTeamId = user.selectedTeamId;
    if (!selectedTeamId) {
      logger.error("User missing selected team when finalizing study", {
        userId: user.id,
        studyId,
      });
      return {
        success: false,
        error: "Please select a team before running the study.",
      };
    }

    try {
      await updateStudyTeam(studyId, selectedTeamId, user.id);
    } catch (error) {
      logger.error("Failed to update study team prior to finalize", {
        userId: user.id,
        studyId,
        teamId: selectedTeamId,
        error: (error as Error)?.message,
      });
      return {
        success: false,
        error:
          error instanceof Error && error.message
            ? error.message
            : "Failed to update study team",
      };
    }

    await finalizeStudy(studyId, {
      studyId,
      files: filesToPersist,
      jobData,
    });

    const resp = await addJobToQueue(jobData);
    if (!resp.success) {
      logger.error(`Failed to enqueue ${kind} after finalize`, {
        userId: user.id,
        studyId,
        error: resp.error,
      });
      return { success: false, error: "Failed to enqueue job" };
    }

    // Consume a credit from the team's balance for this study
    await consumeTeamCreditByStudy(studyId, user.id);
    logger.info(`${config.logLabel} finalized & queued`, {
      userId: user.id,
      studyId,
      messageId: resp.messageId,
      heuristic:
        kind === "heuristic_evaluation" ? payload.heuristic : undefined,
    });
  } catch (error) {
    logger.error(`Error finalizing & queueing ${kind}`, {
      studyId,
      error: (error as Error).message,
      stack: (error as Error).stack,
    });
    return { success: false, error: "Internal server error" };
  }
  redirect("/studies");
}

// Create Persona (server action)
// Validates input, generates simple basics (name/one-liner/photo placeholder) and returns the payload.
// NOTE: Persistence is not implemented yet; this is a stub to unblock the UI flow.
export async function createPersona(payload: z.infer<typeof PersonaSchema>) {
  const { user } = await auth();
  logger.debug("Creating persona (stub)", { userId: user?.id });

  // Validate payload using schema
  const parsed = PersonaSchema.safeParse(payload);
  if (!parsed.success) {
    logger.warn("Persona validation failed", {
      userId: user?.id,
      errors: parsed.error.errors,
    });
    return {
      success: false,
      error: "Invalid persona data",
      details: parsed.error.errors,
    };
  }

  const data = parsed.data;

  // Simple generation for basics until backend persistence + AI generation is wired
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const role = data.firmographics?.roleSeniority?.trim();
  const dept = data.firmographics?.department?.trim();
  const industry = data.firmographics?.industry?.trim();
  const location = data.demographics?.location?.trim();
  const goal = data.goals?.trim();

  const baseLabel = role || dept || industry || "Persona";
  const generatedName = `${baseLabel} – ${date}`;
  const generatedOneLiner = goal
    ? goal
    : `A representative ${industry ? `${industry.toLowerCase()} ` : ""}persona${location ? ` in ${location}` : ""}.`;
  const photoUrl: string | null = null; // Placeholder until image generation is wired

  const persona = {
    id: uuidv4(),
    userId: user.id,
    name: generatedName,
    oneLiner: generatedOneLiner,
    photoUrl,
    data,
    createdAt: now.toISOString(),
  };

  logger.info("Persona created (stub; not persisted)", {
    userId: user.id,
    personaId: persona.id,
  });

  // In the future: persist to db-worker and redirect to a persona detail page
  return { success: true, persona };
}
