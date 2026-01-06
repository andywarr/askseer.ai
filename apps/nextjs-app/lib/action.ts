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

// Presigned URL expiration time in seconds (5 minutes)
// Allows time for concurrent upload batching and retries
const PRESIGNED_URL_EXPIRY_SECONDS = 300;

// Presigned URL expiration for short-lived PUT operations (profile images, logos)
const PRESIGNED_PUT_URL_SHORT_EXPIRY = 60;

// Presigned URL expiration for GET operations (1 hour)
const PRESIGNED_GET_URL_EXPIRY = 3600;

// Maximum file size for image uploads (5MB)
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

// Allowed MIME types for profile images
const PROFILE_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

// Allowed MIME types for company logos (includes SVG)
const COMPANY_LOGO_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/svg+xml",
];

/**
 * Factory function to create an S3 client with standard configuration.
 */
function getS3Client(): S3Client {
  return new S3Client({ region: process.env.AWS_REGION });
}

/**
 * Validates an image upload against allowed types and max size.
 * @throws Error if validation fails
 */
function validateImageUpload(
  fileType: string,
  fileSize: number,
  allowedTypes: string[],
  context: { userId: string; logPrefix: string },
): void {
  if (!allowedTypes.includes(fileType)) {
    logger.warn(`Invalid ${context.logPrefix} content type`, {
      userId: context.userId,
      fileType,
    });
    const typeList = allowedTypes
      .map((t) => t.replace("image/", "").toUpperCase())
      .join(", ");
    throw new Error(`Unsupported image type. Use ${typeList}.`);
  }
  if (fileSize > MAX_IMAGE_SIZE) {
    logger.warn(`${context.logPrefix} exceeds max size`, {
      userId: context.userId,
      fileSize,
    });
    throw new Error("Image too large. Max 5MB.");
  }
}

/**
 * Generates a presigned PUT URL for uploading a file to S3.
 */
async function generatePresignedPutUrl(
  key: string,
  contentType: string,
  expiresIn: number = PRESIGNED_PUT_URL_SHORT_EXPIRY,
): Promise<string> {
  const s3Client = getS3Client();
  const command = new PutObjectCommand({
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  });
  return await getSignedUrl(s3Client, command, { expiresIn });
}

/**
 * Generates a presigned GET URL for downloading a file from S3.
 */
async function generatePresignedGetUrl(
  key: string,
  expiresIn: number = PRESIGNED_GET_URL_EXPIRY,
): Promise<string> {
  const s3Client = getS3Client();
  const command = new GetObjectCommand({
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: key,
  });
  return await getSignedUrl(s3Client, command, { expiresIn });
}

//Next imports
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

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
  listHeuristicFamilies,
  consumeTeamCreditByStudy,
  updateStudyTeam,
  getTeam,
  getCompanyTeams,
  getCompanyMembers,
  updateUserSelectedTeam,
  getUserTeams,
} from "@/apps/nextjs-app/lib/data";
import { logger } from "@/apps/shared/logger.ts";
import {
  TEAM_WITHOUT_COMPANY_MAX_STUDY_FILES,
  LONG_FLOW_WARNING_THRESHOLD,
} from "@/apps/nextjs-app/lib/constants";
import { getStudyUploadLimitForTeam } from "@/apps/nextjs-app/lib/study";

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

/**
 * Helper to require authenticated user in server actions.
 * Throws an error if user is not authenticated, which will be caught
 * by the action's error handler and shown to the user.
 */
async function requireAuth() {
  const session = await auth();
  if (!session?.user?.id) {
    logger.warn("Server action called without authenticated user");
    throw new Error("Your session has expired. Please sign in again.");
  }
  return session.user;
}

async function getStudyUploadLimit(teamId: string | null | undefined) {
  if (!teamId) {
    return TEAM_WITHOUT_COMPANY_MAX_STUDY_FILES;
  }

  const team = await getTeam(teamId);
  return getStudyUploadLimitForTeam(team);
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
  let user;
  try {
    user = await requireAuth();

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
        userId: user.id,
        error: (e as Error)?.message,
      });
      throw new Error("Invalid v2 jobData on retry");
    }

    // Get companyId from team if not already in stored jobData
    const companyId =
      stored?.companyId || (await getTeam(study.teamId!))?.companyId || null;

    const task = (study.type || "").toLowerCase();
    const base = stored?.payload || { files: study.files || [] };
    jobData =
      task === "heuristic_evaluation"
        ? {
            version: 2,
            studyId: study.id,
            userId: user.id,
            teamId: study.teamId,
            companyId,
            type: task,
            payload: {
              ...base,
              heuristic: ((base as any)?.heuristic as string) || "",
            },
            retry: true,
          }
        : {
            version: 2,
            studyId: study.id,
            userId: user.id,
            teamId: study.teamId,
            companyId,
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

    revalidatePath("/studies");
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
    // Try to get user for logging, but don't require it for sign out
    const session = await auth();

    logger.debug("User signing out", {
      userId: session?.user?.id,
    });

    await signOut();

    logger.info("User signed out successfully", {
      userId: session?.user?.id,
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
  const user = await requireAuth();

  if (!teamId) {
    throw new Error("Team ID is required");
  }

  try {
    await updateUserSelectedTeam(user.id, teamId);
    logger.info("Updated selected team for user", {
      userId: user.id,
      teamId,
    });
    // Revalidate the studies page to ensure fresh data with new team context
    revalidatePath("/studies");
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
  const user = await requireAuth();

  validateImageUpload(fileType, fileSize, PROFILE_IMAGE_TYPES, {
    userId: user.id,
    logPrefix: "profile image",
  });

  const key = `users/${user.id}/profile/${generateRandomFileName(fileName)}`;

  try {
    const uploadURL = await generatePresignedPutUrl(key, fileType);
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
      error: (error as Error).message,
      stack: (error as Error).stack,
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
  const user = await requireAuth();

  validateImageUpload(fileType, fileSize, COMPANY_LOGO_TYPES, {
    userId: user.id,
    logPrefix: "company logo",
  });

  const key = `companies/${companyId}/logo/${generateRandomFileName(fileName)}`;

  try {
    const uploadURL = await generatePresignedPutUrl(key, fileType);
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
      error: (error as Error).message,
    });
    throw error;
  }
}

export async function initStudy(name: string | null, type: string) {
  const user = await requireAuth();

  // Check persona creation permission if creating a persona study
  if (type === "persona") {
    const { canUserCreatePersonas } =
      await import("@/apps/nextjs-app/lib/user");
    const hasPermission = await canUserCreatePersonas(user.id);

    if (!hasPermission) {
      logger.warn(
        "User attempted to initialize persona study without permission",
        {
          userId: user.id,
        },
      );
      throw new Error("You do not have permission to create personas");
    }
  }

  return await initStudyDb(name, type, user.id, user.selectedTeamId);
}

export async function getStudyUploadUrls(
  studyId: string,
  fileMetadata: Array<{ name: string; size: number; type: string }>,
) {
  const user = await requireAuth();
  logger.debug("Generating presigned URLs for study upload", {
    userId: user.id,
    teamId: user.selectedTeamId,
    studyId,
    fileCount: fileMetadata.length,
  });

  return generateUploadUrls(user, studyId, fileMetadata);
}

/**
 * Internal helper to generate presigned PUT URLs for study file uploads.
 * Shared by getStudyUploadUrls and putPresignedUrls.
 */
async function generateUploadUrls(
  user: { id: string; selectedTeamId: string | null },
  studyId: string,
  fileMetadata: Array<{ name: string; size?: number; type: string }>,
) {
  const maxFiles = await getStudyUploadLimit(user.selectedTeamId);
  if (fileMetadata.length > maxFiles) {
    logger.warn("Study upload file count exceeds limit", {
      userId: user.id,
      teamId: user.selectedTeamId,
      studyId,
      fileCount: fileMetadata.length,
      maxFiles,
    });
    throw new Error(`You can upload up to ${maxFiles} files for this team.`);
  }
  const urls = await Promise.all(
    fileMetadata.map(async (file) => {
      const fileName = generateRandomFileName(file.name);
      const key = `studies/${user.selectedTeamId}/${studyId}/uploads/${fileName}`;
      try {
        const uploadURL = await generatePresignedPutUrl(
          key,
          file.type,
          PRESIGNED_URL_EXPIRY_SECONDS,
        );
        return { fileName, fileType: file.type, uploadURL, key };
      } catch (error) {
        logger.error("Error generating presigned URL (study upload)", {
          userId: user.id,
          studyId,
          file: file.name,
          error: (error as Error).message,
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

/**
 * Clean up an orphaned study that was created but never finalized.
 * This is used in form error handlers to delete studies when file upload fails.
 */
export async function cleanupOrphanedStudy(studyId: string) {
  let user;
  try {
    user = await requireAuth();
  } catch {
    // If auth fails during cleanup, log and exit silently - we don't want to throw
    // during error handling
    logger.error("cleanupOrphanedStudy called without authenticated user");
    return;
  }

  try {
    logger.info("Cleaning up orphaned study", {
      studyId,
      userId: user.id,
    });

    // Delete the study record from database
    const response = await fetch(
      `${process.env.DB_WORKER_URL}/api/study?studyId=${studyId}&userId=${user.id}`,
      {
        method: "DELETE",
      },
    );

    if (!response.ok) {
      logger.error("Failed to cleanup orphaned study", {
        studyId,
        userId: user.id,
        status: response.status,
      });
      return;
    }

    logger.info("Successfully cleaned up orphaned study", {
      studyId,
      userId: user.id,
    });
  } catch (error) {
    logger.error("Error cleaning up orphaned study", {
      studyId,
      userId: user.id,
      error: error instanceof Error ? error.message : "unknown",
    });
    // Swallow the error - we don't want cleanup failures to mask the original error
  }
}

export async function putPresignedUrls(
  fileMetadata: Array<{ name: string; type: string; size: number }>,
  studyId: string,
) {
  const user = await requireAuth();

  // Additional validation for this endpoint
  if (!studyId) {
    logger.error("putPresignedUrls called without studyId (hard enforcement)", {
      userId: user.id,
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

  return generateUploadUrls(user, studyId, fileMetadata);
}

// Email template helper functions

// Format form value to display label (e.g., "data_science" -> "Data science")
function formatFormValue(value: string): string {
  return value.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

function createStyledEmailHtml(params: {
  title: string;
  subtitle: string;
  content: string;
  brandColor?: string;
  buttonText?: string;
  buttonUrl?: string;
  showFooter?: boolean;
  footerEmail?: string;
  footerResponseDays?: string;
}) {
  const {
    title,
    subtitle,
    content,
    brandColor = "#18181b",
    buttonText,
    buttonUrl,
    showFooter = true,
    footerEmail = "payments@askseer.ai",
    footerResponseDays = "2 business days",
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
          
          ${
            showFooter
              ? `
          <!-- Divider -->
          <tr>
            <td style="padding: 0 40px;">
              <hr style="border: none; border-top: 1px solid ${color.border}; margin: 0;">
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td align="center" style="padding: 32px 40px 40px 40px;">
              <p style="margin: 0 0 8px 0; font-size: 14px; color: #64748b; line-height: 1.5;">
                Questions? Contact us at ${footerEmail}
              </p>
              <p style="margin: 0; font-size: 12px; color: #94a3b8;">
                We'll respond within ${footerResponseDays}.
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

// ==========================================
// Contact Form Submission Infrastructure
// ==========================================

/** Base schema for contact form fields shared between demo and contact requests */
const baseContactSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Please enter a valid email address"),
  phone: z.string().min(1, "Phone number is required"),
  company: z.string().min(1, "Company is required"),
  jobRole: z.string().min(1, "Job role is required"),
  howDidYouHear: z.string().min(1, "Please let us know how you heard about us"),
});

/** Configuration for a contact form submission type */
interface ContactFormConfig {
  /** The type of request (used in logging) */
  requestType: "demo" | "contact";
  /** Field name for the user's message/use case content */
  contentFieldName: "useCase" | "message";
  /** Email address to send internal notifications to */
  internalEmail: string;
  /** Email subject prefix */
  subjectPrefix: string;
  /** Title for internal email */
  internalEmailTitle: string;
  /** Subtitle for internal email */
  internalEmailSubtitle: string;
  /** Title for confirmation email to user */
  confirmationEmailTitle: string;
  /** Subtitle for confirmation email to user */
  confirmationEmailSubtitle: string;
  /** Subject for confirmation email */
  confirmationEmailSubject: string;
  /** Thank you message for confirmation email */
  thankYouMessage: string;
  /** Action required text for internal email */
  actionRequiredText: string;
  /** Content section title (e.g., "Use Case" or "Message") */
  contentSectionTitle: string;
}

const DEMO_FORM_CONFIG: ContactFormConfig = {
  requestType: "demo",
  contentFieldName: "useCase",
  internalEmail: "demo@askseer.ai",
  subjectPrefix: "Demo Request",
  internalEmailTitle: "New Demo Request",
  internalEmailSubtitle: "A potential customer has requested a product demo.",
  confirmationEmailTitle: "Demo Request Received",
  confirmationEmailSubtitle:
    "We'll be in touch soon to schedule your personalized demo.",
  confirmationEmailSubject: "Thanks for requesting a Seer demo!",
  thankYouMessage:
    "Thank you for your interest in Seer! We've received your demo request and a member of our team will be in touch within 1 business day to schedule a personalized demo.",
  actionRequiredText:
    "Action Required: Please follow up with the prospect within 1 business day to schedule a demo.",
  contentSectionTitle: "Use Case",
};

const CONTACT_FORM_CONFIG: ContactFormConfig = {
  requestType: "contact",
  contentFieldName: "message",
  internalEmail: "contact@askseer.ai",
  subjectPrefix: "Contact Request",
  internalEmailTitle: "New Contact Request",
  internalEmailSubtitle: "Someone has reached out through the contact form.",
  confirmationEmailTitle: "Message Received",
  confirmationEmailSubtitle: "We'll be in touch soon with a response.",
  confirmationEmailSubject: "We've received your message - Seer",
  thankYouMessage:
    "Thank you for reaching out to Seer! We've received your message and a member of our team will respond within 1 business day.",
  actionRequiredText:
    "Action Required: Please respond to this inquiry within 1 business day.",
  contentSectionTitle: "Message",
};

/**
 * Generates HTML content for the contact details section of emails.
 */
function generateContactDetailsHtml(params: {
  name: string;
  email: string;
  phone: string;
  company: string;
  jobRole: string;
}): string {
  return `
    <div style="background-color: #f8fafc; padding: 24px; border-radius: 8px; margin: 16px 0;">
      <h3 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 600; color: #3f3f46;">Contact Details</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 12px 0; font-weight: 500; color: #3f3f46; width: 35%;">Name:</td>
          <td style="padding: 12px 0; color: #64748b;">${params.name}</td>
        </tr>
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 12px 0; font-weight: 500; color: #3f3f46;">Email:</td>
          <td style="padding: 12px 0; color: #64748b;"><a href="mailto:${params.email}" style="color: #18181b; text-decoration: none;">${params.email}</a></td>
        </tr>
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 12px 0; font-weight: 500; color: #3f3f46;">Phone:</td>
          <td style="padding: 12px 0; color: #64748b;">${params.phone}</td>
        </tr>
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 12px 0; font-weight: 500; color: #3f3f46;">Company:</td>
          <td style="padding: 12px 0; color: #64748b;">${params.company}</td>
        </tr>
        <tr>
          <td style="padding: 12px 0; font-weight: 500; color: #3f3f46;">Job Role:</td>
          <td style="padding: 12px 0; color: #64748b;">${params.jobRole}</td>
        </tr>
      </table>
    </div>
  `;
}

/**
 * Generates HTML for the "how did you hear about us" section.
 */
function generateHowDidYouHearHtml(howDidYouHear: string): string {
  return `
    <div style="background-color: #f8fafc; padding: 24px; border-radius: 8px; margin: 16px 0;">
      <h3 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 600; color: #3f3f46;">Additional Information</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 12px 0; font-weight: 500; color: #3f3f46; width: 35%;">How they heard about us:</td>
          <td style="padding: 12px 0; color: #64748b;">${howDidYouHear}</td>
        </tr>
      </table>
    </div>
  `;
}

/**
 * Generates HTML for a content section (use case or message).
 */
function generateContentSectionHtml(title: string, content: string): string {
  return `
    <div style="background-color: #f8fafc; padding: 24px; border-radius: 8px; margin: 16px 0;">
      <h3 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 600; color: #3f3f46;">${title}</h3>
      <p style="margin: 0; color: #64748b; line-height: 1.6; white-space: pre-wrap;">${content}</p>
    </div>
  `;
}

/**
 * Generates HTML for action required alert box.
 */
function generateActionRequiredHtml(text: string): string {
  return `
    <div style="background-color: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 16px; margin: 16px 0;">
      <p style="margin: 0; color: #92400e; font-weight: 500;">${text}</p>
    </div>
  `;
}

/**
 * Generates confirmation email content for the user who submitted the form.
 */
function generateConfirmationEmailHtml(params: {
  name: string;
  email: string;
  company: string;
  jobRole: string;
  content: string;
  contentTitle: string;
  thankYouMessage: string;
  contactEmail: string;
}): string {
  return `
    <p style="margin: 16px 0; font-size: 16px; color: #64748b; line-height: 1.6;">
      Hi ${params.name},
    </p>
    
    <p style="margin: 16px 0; font-size: 16px; color: #64748b; line-height: 1.6;">
      ${params.thankYouMessage}
    </p>
    
    <div style="background-color: #f8fafc; padding: 24px; border-radius: 8px; margin: 24px 0; border: 1px solid #e2e8f0;">
      <h3 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 600; color: #3f3f46;">Your Request Summary</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 12px 0; font-weight: 500; color: #3f3f46; width: 40%;">Name:</td>
          <td style="padding: 12px 0; color: #64748b;">${params.name}</td>
        </tr>
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 12px 0; font-weight: 500; color: #3f3f46;">Email:</td>
          <td style="padding: 12px 0; color: #64748b;">${params.email}</td>
        </tr>
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 12px 0; font-weight: 500; color: #3f3f46;">Company:</td>
          <td style="padding: 12px 0; color: #64748b;">${params.company}</td>
        </tr>
        <tr>
          <td style="padding: 12px 0; font-weight: 500; color: #3f3f46;">Job Role:</td>
          <td style="padding: 12px 0; color: #64748b;">${params.jobRole}</td>
        </tr>
      </table>
    </div>
    
    <div style="background-color: #f8fafc; padding: 24px; border-radius: 8px; margin: 24px 0; border: 1px solid #e2e8f0;">
      <h3 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 600; color: #3f3f46;">Your ${params.contentTitle}</h3>
      <p style="margin: 0; color: #64748b; line-height: 1.6; white-space: pre-wrap;">${params.content}</p>
    </div>
    
    <p style="margin: 24px 0 16px 0; font-size: 16px; color: #64748b; line-height: 1.6;">
      In the meantime, feel free to explore our platform by 
      <a href="https://askseer.ai/signin" style="color: #18181b; text-decoration: none; font-weight: 500;">signing up for free</a>.
    </p>
    
    <p style="margin: 16px 0; font-size: 16px; color: #64748b; line-height: 1.6;">
      If you have any questions, please don't hesitate to reach out to us at 
      <a href="mailto:${params.contactEmail}" style="color: #18181b; text-decoration: none; font-weight: 500;">${params.contactEmail}</a>
    </p>
  `;
}

/**
 * Core handler for contact form submissions (demo requests and contact requests).
 * Validates input, sends internal notification email, and sends confirmation to user.
 */
async function handleContactFormSubmission(
  formData: FormData,
  config: ContactFormConfig,
): Promise<{
  success: boolean;
  message?: string;
  error?: string;
  details?: z.ZodIssue[];
  emailId?: string;
  confirmationEmailId?: string;
}> {
  const resend = new Resend(process.env.AUTH_RESEND_KEY);

  // Extract common form fields
  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const phone = formData.get("phone") as string;
  const company = formData.get("company") as string;
  const jobRole = formData.get("jobRole") as string;
  const howDidYouHear = formData.get("howDidYouHear") as string;
  const content = formData.get(config.contentFieldName) as string;

  logger.debug(`Processing ${config.requestType} request`, {
    name,
    email,
    company,
    jobRole,
  });

  // Build schema with content field
  const schema = baseContactSchema.extend({
    [config.contentFieldName]: z
      .string()
      .min(1, `Please provide your ${config.contentFieldName}`),
  });

  try {
    // Validate the form data
    const validation = schema.safeParse({
      name,
      email,
      phone,
      company,
      jobRole,
      howDidYouHear,
      [config.contentFieldName]: content,
    });

    if (!validation.success) {
      logger.warn(`${config.requestType} request validation failed`, {
        name,
        email,
        errors: validation.error.errors,
      });
      return {
        success: false,
        error: "Invalid form data",
        details: validation.error.errors,
      };
    }

    const validData = validation.data;
    const jobRoleLabel = formatFormValue(validData.jobRole);
    const howDidYouHearLabel = formatFormValue(validData.howDidYouHear);
    const validContent = validData[config.contentFieldName] as string;

    logger.info(`Processing ${config.requestType} request`, {
      name: validData.name,
      email: validData.email,
      company: validData.company,
      jobRole: validData.jobRole,
    });

    // Build internal email content
    const internalEmailContent =
      generateContactDetailsHtml({
        name: validData.name,
        email: validData.email,
        phone: validData.phone,
        company: validData.company,
        jobRole: jobRoleLabel,
      }) +
      generateHowDidYouHearHtml(howDidYouHearLabel) +
      generateContentSectionHtml(config.contentSectionTitle, validContent) +
      generateActionRequiredHtml(config.actionRequiredText);

    // Send internal notification email
    const { data, error } = await resend.emails.send({
      from: process.env.AUTH_RESEND_FROM || "onboarding@resend.dev",
      to: [config.internalEmail],
      subject: `${config.subjectPrefix} - ${validData.name} at ${validData.company}`,
      html: createStyledEmailHtml({
        title: config.internalEmailTitle,
        subtitle: config.internalEmailSubtitle,
        content: internalEmailContent,
        showFooter: false,
      }),
      text: `
        ${config.internalEmailTitle}
        
        Contact Details:
        Name: ${validData.name}
        Email: ${validData.email}
        Phone: ${validData.phone}
        Company: ${validData.company}
        Job Role: ${jobRoleLabel}
        
        How they heard about us: ${howDidYouHearLabel}
        
        ${config.contentSectionTitle}:
        ${validContent}
        
        ${config.actionRequiredText}
      `,
    });

    if (error) {
      logger.error(`Failed to send ${config.requestType} request email`, {
        name: validData.name,
        email: validData.email,
        company: validData.company,
        error: error.message,
      });
      return {
        success: false,
        error: "Failed to send email",
      };
    }

    logger.info(`${config.requestType} request email sent`, {
      name: validData.name,
      email: validData.email,
      company: validData.company,
      emailId: data?.id,
    });

    // Build and send confirmation email to the user
    const confirmationContent = generateConfirmationEmailHtml({
      name: validData.name,
      email: validData.email,
      company: validData.company,
      jobRole: jobRoleLabel,
      content: validContent,
      contentTitle: config.contentSectionTitle,
      thankYouMessage: config.thankYouMessage,
      contactEmail: config.internalEmail,
    });

    const confirmationResponse = await resend.emails.send({
      from: process.env.AUTH_RESEND_FROM || "onboarding@resend.dev",
      to: [validData.email],
      subject: config.confirmationEmailSubject,
      html: createStyledEmailHtml({
        title: config.confirmationEmailTitle,
        subtitle: config.confirmationEmailSubtitle,
        content: confirmationContent,
        footerEmail: config.internalEmail,
        footerResponseDays: "1 business day",
      }),
      text: `
        ${config.confirmationEmailTitle}
        
        Hi ${validData.name},
        
        ${config.thankYouMessage}
        
        Your Request Summary:
        Name: ${validData.name}
        Email: ${validData.email}
        Company: ${validData.company}
        Job Role: ${jobRoleLabel}
        
        Your ${config.contentSectionTitle}:
        ${validContent}
        
        In the meantime, feel free to explore our platform by signing up for free at https://askseer.ai/signin
        
        If you have any questions, please don't hesitate to reach out to us at ${config.internalEmail}
        
        The Seer Team
      `,
    });

    if (confirmationResponse.error) {
      logger.error(`Failed to send ${config.requestType} confirmation email`, {
        name: validData.name,
        email: validData.email,
        error: confirmationResponse.error.message,
      });
      // Don't fail the entire request if confirmation email fails
    } else {
      logger.info(`${config.requestType} confirmation email sent`, {
        name: validData.name,
        email: validData.email,
        confirmationEmailId: confirmationResponse.data?.id,
      });
    }

    logger.info(`${config.requestType} request submitted successfully`, {
      name: validData.name,
      email: validData.email,
      company: validData.company,
      emailId: data?.id,
      confirmationEmailId: confirmationResponse.data?.id,
    });

    return {
      success: true,
      message: `${config.requestType.charAt(0).toUpperCase() + config.requestType.slice(1)} request submitted successfully`,
      emailId: data?.id,
      confirmationEmailId: confirmationResponse.data?.id,
    };
  } catch (error) {
    logger.error(`Error processing ${config.requestType} request`, {
      name,
      email,
      company,
      error: (error as Error).message,
      stack: (error as Error).stack,
    });
    return {
      success: false,
      error: "Internal server error",
    };
  }
}

/**
 * Send an email alert when a user runs a study with more screens than the warning threshold.
 * This is a fire-and-forget operation that logs errors but doesn't block the study.
 */
async function sendLongFlowAlert(params: {
  userId: string;
  userEmail: string;
  userName: string | null;
  teamId: string | null;
  teamName: string | null;
  companyName: string | null;
  studyId: string;
  studyName: string;
  studyType: string;
  screenCount: number;
}) {
  try {
    const resend = new Resend(process.env.AUTH_RESEND_KEY);
    const content = `
      <div style="background:#fef3c7;border:1px solid #f59e0b;padding:16px;margin-bottom:16px;border-radius:8px;">
        <p style="margin:0;font-size:14px;color:#92400e;font-weight:500;">
          A user has submitted a study with <strong>${params.screenCount} screens</strong>, 
          exceeding the ${LONG_FLOW_WARNING_THRESHOLD} screen threshold.
        </p>
      </div>
      <div style="background:#f8fafc;padding:24px;border-radius:8px;border:1px solid #e2e8f0;">
        <h3 style="margin:0 0 16px 0;font-size:18px;font-weight:600;color:#3f3f46;">Study Details</h3>
        <table style="width:100%;border-collapse:collapse;">
          <tr style="border-bottom:1px solid #e2e8f0;">
            <td style="padding:8px 0;font-weight:500;color:#3f3f46;width:35%;">Study Name</td>
            <td style="padding:8px 0;color:#64748b;">${params.studyName}</td>
          </tr>
          <tr style="border-bottom:1px solid #e2e8f0;">
            <td style="padding:8px 0;font-weight:500;color:#3f3f46;">Study Type</td>
            <td style="padding:8px 0;color:#64748b;">${params.studyType === "heuristic_evaluation" ? "Heuristic Evaluation" : "Cognitive Walkthrough"}</td>
          </tr>
          <tr style="border-bottom:1px solid #e2e8f0;">
            <td style="padding:8px 0;font-weight:500;color:#3f3f46;">Screen Count</td>
            <td style="padding:8px 0;color:#c2410c;font-weight:600;">${params.screenCount}</td>
          </tr>
          <tr style="border-bottom:1px solid #e2e8f0;">
            <td style="padding:8px 0;font-weight:500;color:#3f3f46;">User</td>
            <td style="padding:8px 0;color:#64748b;">${params.userName || "(no name)"} &lt;${params.userEmail}&gt;</td>
          </tr>
          <tr style="border-bottom:1px solid #e2e8f0;">
            <td style="padding:8px 0;font-weight:500;color:#3f3f46;">Team</td>
            <td style="padding:8px 0;color:#64748b;">${params.teamName || "(no team)"}</td>
          </tr>
          <tr style="border-bottom:1px solid #e2e8f0;">
            <td style="padding:8px 0;font-weight:500;color:#3f3f46;">Company</td>
            <td style="padding:8px 0;color:#64748b;">${params.companyName || "(no company)"}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;font-weight:500;color:#3f3f46;">Study ID</td>
            <td style="padding:8px 0;color:#64748b;font-family:monospace;font-size:12px;">${params.studyId}</td>
          </tr>
        </table>
      </div>`;

    await resend.emails.send({
      from: process.env.AUTH_RESEND_FROM || "onboarding@resend.dev",
      to: ["alert@askseer.ai"],
      subject: `Long Flow Alert: ${params.screenCount} screens - ${params.studyName}`,
      html: createStyledEmailHtml({
        title: "Long Flow Study Submitted",
        subtitle: `A study with ${params.screenCount} screens has been submitted.`,
        content,
        showFooter: false,
      }),
      text: `Long Flow Alert\n\nA user has submitted a study with ${params.screenCount} screens.\n\nStudy: ${params.studyName}\nType: ${params.studyType}\nUser: ${params.userName || "(no name)"} <${params.userEmail}>\nTeam: ${params.teamName || "(no team)"}\nCompany: ${params.companyName || "(no company)"}\nStudy ID: ${params.studyId}`,
    });

    logger.info("Long flow alert email sent", {
      studyId: params.studyId,
      screenCount: params.screenCount,
      userId: params.userId,
    });
  } catch (error: any) {
    logger.error("Failed to send long flow alert email", {
      studyId: params.studyId,
      screenCount: params.screenCount,
      userId: params.userId,
      error: error?.message,
    });
  }
}

// Credit request server action
export async function getPresignedUrls(key: string) {
  const user = await requireAuth();
  // Basic ownership / scope check: allow keys that start with allowed prefixes for this user
  const allowed = [
    `${user.id}/`, // legacy
    `studies/${user.id}/`, // Pre-teams studies
    `users/${user.id}/`, // profile images
  ];

  // Allow access to all teams the user is a member of, and collect company IDs
  const userCompanyIds = new Set<string>();
  try {
    const userTeams = await getUserTeams(user.id);
    for (const team of userTeams) {
      allowed.push(`studies/${team.id}/`);
      // Collect company IDs for COMPANY-visibility access
      if (team.companyId) {
        userCompanyIds.add(team.companyId);
      }
    }
  } catch (error) {
    logger.debug("Could not fetch user teams for presigned URL access", {
      userId: user.id,
      error: error.message,
    });
    // Fallback: only allow currently selected team if we couldn't fetch all teams
    if (user.selectedTeamId) {
      allowed.push(`studies/${user.selectedTeamId}/`);
    }
  }

  // Also allow access to company team resources (for COMPANY-visibility studies)
  // Check all companies the user belongs to, not just the selected team's company
  if (!allowed.some((p) => key.startsWith(p)) && userCompanyIds.size > 0) {
    try {
      // Get all teams from all companies the user is a member of
      const companyTeamPromises = Array.from(userCompanyIds).map((companyId) =>
        getCompanyTeams(companyId),
      );
      const companyTeamsArrays = await Promise.all(companyTeamPromises);
      for (const companyTeams of companyTeamsArrays) {
        for (const t of companyTeams) {
          allowed.push(`studies/${t.id}/`);
        }
      }
    } catch (error) {
      logger.debug("Could not check company team access", {
        userId: user.id,
        error: error.message,
      });
    }
  }

  if (!allowed.some((p) => key.startsWith(p))) {
    logger.warn("Forbidden presigned GET URL request due to prefix mismatch", {
      userId: user.id,
      key,
    });
    throw new Error("Forbidden");
  }

  try {
    const url = await generatePresignedGetUrl(key);
    return url;
  } catch (error) {
    logger.error("Error generating presigned GET URL", {
      key,
      userId: user.id,
      error: (error as Error).message,
    });
    throw error;
  }
}

/**
 * Generate a presigned URL for publicly shared content.
 * This function does NOT require authentication and should only be used
 * for content that has already been verified as publicly accessible.
 * The caller is responsible for verifying the content is public before calling.
 */
export async function getPublicPresignedUrl(key: string) {
  try {
    const url = await generatePresignedGetUrl(key);
    return url;
  } catch (error) {
    logger.error("Error generating public presigned GET URL", {
      key,
      error: (error as Error).message,
    });
    throw error;
  }
}

export async function getCompanyLogoGetUrl(companyId: string, key: string) {
  const user = await requireAuth();
  if (!key.startsWith(`companies/${companyId}/`)) {
    logger.warn(
      "Forbidden presigned GET URL request for company due to prefix mismatch",
      {
        userId: user.id,
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
        userId: user.id,
        companyId,
      },
    );
    throw new Error("Forbidden");
  }
  try {
    const url = await generatePresignedGetUrl(key);
    return url;
  } catch (error) {
    logger.error("Error generating presigned GET URL (company)", {
      key,
      companyId,
      userId: user?.id,
      error: (error as Error).message,
    });
    throw error;
  }
}

export async function listMyPersonas() {
  const user = await requireAuth();
  const teamId = user.selectedTeamId;
  if (!teamId) {
    logger.warn("listMyPersonas called without a selected team", {
      userId: user.id,
    });
    return { teamPersonas: [], companyPersonas: [], isDefaultTeam: false };
  }
  // Fetch all personas for the team
  const teamPersonasRaw = await listPersonas(user.id, teamId);

  // Split personas by visibility
  const privatePersonas = (teamPersonasRaw || []).filter(
    (p: any) => p.visibility === "PRIVATE" && p.createdByUserId === user.id,
  );
  const teamPersonas = (teamPersonasRaw || []).filter(
    (p: any) => p.visibility === "TEAM",
  );

  let companyPersonas: any[] = [];
  let isDefaultTeam = false;

  try {
    const team = await getTeam(teamId);
    const companyId = team?.companyId || null;
    isDefaultTeam = team?.isDefaultForCompany || false;

    if (companyId) {
      const companyTeams = await getCompanyTeams(companyId);
      const defaultTeamId = companyTeams.find(
        (t: any) => t.isDefaultForCompany,
      )?.id;

      if (defaultTeamId && defaultTeamId !== teamId) {
        // User is on a non-default team, fetch company personas from the default team
        const companyPersonasRaw = await listPersonas(user.id, defaultTeamId);
        companyPersonas = (companyPersonasRaw || []).filter(
          (p: any) => p.visibility === "COMPANY",
        );
      } else if (isDefaultTeam) {
        // User is on the default team, company personas are in teamPersonasRaw
        companyPersonas = (teamPersonasRaw || []).filter(
          (p: any) => p.visibility === "COMPANY",
        );
      }
    }
  } catch (error) {
    logger.error("Failed to load company personas", {
      userId: user.id,
      teamId,
      error,
    });
  }

  return { privatePersonas, teamPersonas, companyPersonas, isDefaultTeam };
}

export async function listMyHeuristicFamilies() {
  await requireAuth();

  // Get the user's company via their email domain (same approach as library page)
  const { getCompanyByMyDomain } = await import("@/apps/nextjs-app/lib/data");
  const domainInfo = await getCompanyByMyDomain();
  const companyId = domainInfo?.company?.id || null;

  // Fetch heuristic families visible to this company (includes global and company-specific)
  return await listHeuristicFamilies(companyId);
}

export async function deleteS3Objects(keys: string[]) {
  const user = await requireAuth();
  const bucketName = process.env.AWS_BUCKET_NAME;
  const s3Client = getS3Client();

  if (!Array.isArray(keys) || keys.length === 0) {
    logger.warn("deleteS3Objects called with empty keys array", {
      userId: user.id,
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
          error: (error as Error).message,
        });
        return { key, success: false, error: (error as Error).message };
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
    const user = await requireAuth();
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
          teamId: user.selectedTeamId,
          companyId: team?.companyId || null,
          type: taskType,
          payload: {
            name: payload.name,
            goal: payload.goal,
            user: payload.user,
            context: payload.context,
            files: payload.files,
            heuristic: payload.heuristic,
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
          teamId: user.selectedTeamId,
          companyId: team?.companyId || null,
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
          teamId: user.selectedTeamId,
          companyId: team?.companyId || null,
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
        logger.error("Unhandled study kind in switch", {
          kind,
          studyId,
          userId: user.id,
        });
        return { success: false, error: "Invalid study type" };
      }
    }

    try {
      parseJobEnvelope(jobData);
    } catch (e) {
      logger.error("Invalid v2 jobData on finalize", {
        studyId,
        userId: user.id,
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

    // Send email alert if the study has more screens than the warning threshold
    // This is for heuristic_evaluation and cognitive_walkthrough studies only
    if (
      (kind === "heuristic_evaluation" || kind === "cognitive_walkthrough") &&
      filesToPersist.length > LONG_FLOW_WARNING_THRESHOLD
    ) {
      // Fire-and-forget: don't block the user flow for email sending
      sendLongFlowAlert({
        userId: user.id,
        userEmail: user.email || "unknown",
        userName: user.name || null,
        teamId: user.selectedTeamId,
        teamName: team?.name || null,
        companyName: null, // Company name not readily available, companyId is in team
        studyId,
        studyName: payload.name || "Unnamed Study",
        studyType: kind,
        screenCount: filesToPersist.length,
      }).catch((err) => {
        // Silently log any errors - don't fail the study
        logger.error("Failed to send long flow alert (caught)", {
          studyId,
          error: err?.message,
        });
      });
    }
  } catch (error) {
    logger.error(`Error finalizing & queueing ${kind}`, {
      studyId,
      userId: user?.id,
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
  const user = await requireAuth();
  logger.debug("Creating persona (stub)", { userId: user.id });

  // Check if user has permission to create personas
  const { canUserCreatePersonas } = await import("@/apps/nextjs-app/lib/user");
  const hasPermission = await canUserCreatePersonas(user.id);

  if (!hasPermission) {
    logger.warn("User attempted to create persona without permission", {
      userId: user.id,
    });
    return {
      success: false,
      error: "You do not have permission to create personas",
    };
  }

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

// Update Persona (server action)
export async function updatePersona(
  studyId: string,
  payload: z.infer<typeof PersonaSchema>,
) {
  const user = await requireAuth();

  logger.debug("Updating persona", { userId: user.id, studyId });

  // Validate payload using schema
  const parsed = PersonaSchema.safeParse(payload);
  if (!parsed.success) {
    logger.warn("Persona validation failed during update", {
      userId: user.id,
      studyId,
      errors: parsed.error.errors,
    });
    return {
      success: false,
      error: "Invalid persona data",
      details: parsed.error.errors,
    };
  }

  try {
    const response = await fetch(
      `${process.env.DB_WORKER_URL}/api/persona/update`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          studyId,
          userId: user.id,
          data: parsed.data,
        }),
      },
    );

    if (!response.ok) {
      logger.error("Failed to update persona", {
        userId: user.id,
        studyId,
        status: response.status,
      });
      return { success: false, error: "Failed to update persona" };
    }

    const result = await response.json();
    logger.info("Persona updated successfully (new version created)", {
      userId: user.id,
      oldStudyId: studyId,
      newStudyId: result.data?.study?.id,
      version: result.data?.persona?.version,
    });

    // Revalidate paths
    revalidatePath(`/persona/${studyId}`);
    if (result.data?.study?.id) {
      revalidatePath(`/persona/${result.data.study.id}`);
    }
    revalidatePath("/studies");

    return {
      success: true,
      data: result.data,
      newStudyId: result.data?.study?.id,
    };
  } catch (error) {
    logger.error("Error updating persona", {
      userId: user.id,
      studyId,
      error: (error as Error).message,
    });
    return { success: false, error: "Internal server error" };
  }
}

// Demo request server action
export async function submitDemoRequest(formData: FormData) {
  return handleContactFormSubmission(formData, DEMO_FORM_CONFIG);
}

// Contact request server action
export async function submitContactRequest(formData: FormData) {
  return handleContactFormSubmission(formData, CONTACT_FORM_CONFIG);
}
