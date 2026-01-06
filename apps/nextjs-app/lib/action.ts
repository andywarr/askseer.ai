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
  const user = await requireAuth();

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
          { expiresIn: PRESIGNED_URL_EXPIRY_SECONDS },
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
  const maxFiles = await getStudyUploadLimit(user.selectedTeamId);
  if (fileMetadata.length > maxFiles) {
    logger.warn("File upload request exceeds team limit", {
      userId: user.id,
      teamId: user.selectedTeamId,
      studyId,
      fileCount: fileMetadata.length,
      maxFiles,
    });
    throw new Error(`You can upload up to ${maxFiles} files for this team.`);
  }
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
          { expiresIn: PRESIGNED_URL_EXPIRY_SECONDS },
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
      userId: user.id,
      error: error.message,
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
    logger.error("Error generating public presigned GET URL", {
      key,
      error: error.message,
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
      userId: user?.id,
      error: (error as any).message,
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
  const region = process.env.AWS_REGION;
  const s3Client = new S3Client({ region });

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
  const resend = new Resend(process.env.AUTH_RESEND_KEY);

  // Extract form data
  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const phone = formData.get("phone") as string;
  const company = formData.get("company") as string;
  const jobRole = formData.get("jobRole") as string;
  const howDidYouHear = formData.get("howDidYouHear") as string;
  const useCase = formData.get("useCase") as string;

  logger.debug("Processing demo request", {
    name,
    email,
    company,
    jobRole,
  });

  // Validation schema for the demo request form
  const demoRequestSchema = z.object({
    name: z.string().min(1, "Name is required"),
    email: z.string().email("Please enter a valid email address"),
    phone: z.string().min(1, "Phone number is required"),
    company: z.string().min(1, "Company is required"),
    jobRole: z.string().min(1, "Job role is required"),
    howDidYouHear: z
      .string()
      .min(1, "Please let us know how you heard about us"),
    useCase: z.string().min(1, "Please describe your use case"),
  });

  try {
    // Validate the form data
    const validation = demoRequestSchema.safeParse({
      name,
      email,
      phone,
      company,
      jobRole,
      howDidYouHear,
      useCase,
    });

    if (!validation.success) {
      logger.warn("Demo request validation failed", {
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

    const {
      name: validName,
      email: validEmail,
      phone: validPhone,
      company: validCompany,
      jobRole: validJobRole,
      howDidYouHear: validHowDidYouHear,
      useCase: validUseCase,
    } = validation.data;

    const jobRoleLabel = formatFormValue(validJobRole);
    const howDidYouHearLabel = formatFormValue(validHowDidYouHear);

    logger.info("Processing demo request", {
      name: validName,
      email: validEmail,
      company: validCompany,
      jobRole: validJobRole,
    });

    // Create styled email content for demo team
    const demoEmailContent = `
      <div style="background-color: #f8fafc; padding: 24px; border-radius: 8px; margin: 16px 0;">
        <h3 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 600; color: #3f3f46;">Contact Details</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 12px 0; font-weight: 500; color: #3f3f46; width: 35%;">Name:</td>
            <td style="padding: 12px 0; color: #64748b;">${validName}</td>
          </tr>
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 12px 0; font-weight: 500; color: #3f3f46;">Email:</td>
            <td style="padding: 12px 0; color: #64748b;"><a href="mailto:${validEmail}" style="color: #18181b; text-decoration: none;">${validEmail}</a></td>
          </tr>
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 12px 0; font-weight: 500; color: #3f3f46;">Phone:</td>
            <td style="padding: 12px 0; color: #64748b;">${validPhone}</td>
          </tr>
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 12px 0; font-weight: 500; color: #3f3f46;">Company:</td>
            <td style="padding: 12px 0; color: #64748b;">${validCompany}</td>
          </tr>
          <tr>
            <td style="padding: 12px 0; font-weight: 500; color: #3f3f46;">Job Role:</td>
            <td style="padding: 12px 0; color: #64748b;">${jobRoleLabel}</td>
          </tr>
        </table>
      </div>
      
      <div style="background-color: #f8fafc; padding: 24px; border-radius: 8px; margin: 16px 0;">
        <h3 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 600; color: #3f3f46;">Additional Information</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 12px 0; font-weight: 500; color: #3f3f46; width: 35%;">How they heard about us:</td>
            <td style="padding: 12px 0; color: #64748b;">${howDidYouHearLabel}</td>
          </tr>
        </table>
      </div>
      
      <div style="background-color: #f8fafc; padding: 24px; border-radius: 8px; margin: 16px 0;">
        <h3 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 600; color: #3f3f46;">Use Case</h3>
        <p style="margin: 0; color: #64748b; line-height: 1.6; white-space: pre-wrap;">${validUseCase}</p>
      </div>
      
      <div style="background-color: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 16px; margin: 16px 0;">
        <p style="margin: 0; color: #92400e; font-weight: 500;">
          Action Required: Please follow up with the prospect within 1 business day to schedule a demo.
        </p>
      </div>
    `;

    // Send email to demo@askseer.ai
    const { data, error } = await resend.emails.send({
      from: process.env.AUTH_RESEND_FROM || "onboarding@resend.dev",
      to: ["demo@askseer.ai"],
      subject: `Demo Request - ${validName} at ${validCompany}`,
      html: createStyledEmailHtml({
        title: "New Demo Request",
        subtitle: "A potential customer has requested a product demo.",
        content: demoEmailContent,
        showFooter: false,
      }),
      text: `
        New Demo Request
        
        Contact Details:
        Name: ${validName}
        Email: ${validEmail}
        Phone: ${validPhone}
        Company: ${validCompany}
        Job Role: ${jobRoleLabel}
        
        How they heard about us: ${howDidYouHearLabel}
        
        Use Case:
        ${validUseCase}
        
        Please follow up with the prospect within 1 business day to schedule a demo.
      `,
    });

    if (error) {
      logger.error("Failed to send demo request email to demo team", {
        name: validName,
        email: validEmail,
        company: validCompany,
        error: error.message,
      });
      return {
        success: false,
        error: "Failed to send email",
      };
    }

    logger.info("Demo request email sent to demo team", {
      name: validName,
      email: validEmail,
      company: validCompany,
      emailId: data?.id,
    });

    // Create styled email content for prospect confirmation
    const prospectEmailContent = `
      <p style="margin: 16px 0; font-size: 16px; color: #64748b; line-height: 1.6;">
        Hi ${validName},
      </p>
      
      <p style="margin: 16px 0; font-size: 16px; color: #64748b; line-height: 1.6;">
        Thank you for your interest in Seer! We've received your demo request and a member of our team will be in touch within 1 business day to schedule a personalized demo.
      </p>
      
      <div style="background-color: #f8fafc; padding: 24px; border-radius: 8px; margin: 24px 0; border: 1px solid #e2e8f0;">
        <h3 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 600; color: #3f3f46;">Your Request Summary</h3>
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
            <td style="padding: 12px 0; font-weight: 500; color: #3f3f46;">Company:</td>
            <td style="padding: 12px 0; color: #64748b;">${validCompany}</td>
          </tr>
          <tr>
            <td style="padding: 12px 0; font-weight: 500; color: #3f3f46;">Job Role:</td>
            <td style="padding: 12px 0; color: #64748b;">${jobRoleLabel}</td>
          </tr>
        </table>
      </div>
      
      <div style="background-color: #f8fafc; padding: 24px; border-radius: 8px; margin: 24px 0; border: 1px solid #e2e8f0;">
        <h3 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 600; color: #3f3f46;">Your Use Case</h3>
        <p style="margin: 0; color: #64748b; line-height: 1.6; white-space: pre-wrap;">${validUseCase}</p>
      </div>
      
      <p style="margin: 24px 0 16px 0; font-size: 16px; color: #64748b; line-height: 1.6;">
        In the meantime, feel free to explore our platform by 
        <a href="https://askseer.ai/signin" style="color: #18181b; text-decoration: none; font-weight: 500;">signing up for free</a>.
      </p>
      
      <p style="margin: 16px 0; font-size: 16px; color: #64748b; line-height: 1.6;">
        If you have any questions, please don't hesitate to reach out to us at 
        <a href="mailto:demo@askseer.ai" style="color: #18181b; text-decoration: none; font-weight: 500;">demo@askseer.ai</a>
      </p>
    `;

    // Send confirmation email to the prospect
    const prospectEmailResponse = await resend.emails.send({
      from: process.env.AUTH_RESEND_FROM || "onboarding@resend.dev",
      to: [validEmail],
      subject: "Thanks for requesting a Seer demo!",
      html: createStyledEmailHtml({
        title: "Demo Request Received",
        subtitle: "We'll be in touch soon to schedule your personalized demo.",
        content: prospectEmailContent,
        footerEmail: "demo@askseer.ai",
        footerResponseDays: "1 business day",
      }),
      text: `
        Demo Request Received
        
        Hi ${validName},
        
        Thank you for your interest in Seer! We've received your demo request and a member of our team will be in touch within 1 business day to schedule a personalized demo.
        
        Your Request Summary:
        Name: ${validName}
        Email: ${validEmail}
        Company: ${validCompany}
        Job Role: ${jobRoleLabel}
        
        Your Use Case:
        ${validUseCase}
        
        In the meantime, feel free to explore our platform by signing up for free at https://askseer.ai/signin
        
        If you have any questions, please don't hesitate to reach out to us at demo@askseer.ai
        
        The Seer Team
      `,
    });

    if (prospectEmailResponse.error) {
      logger.error(
        "Failed to send demo request confirmation email to prospect",
        {
          name: validName,
          email: validEmail,
          error: prospectEmailResponse.error.message,
        },
      );
      // Don't fail the entire request if prospect email fails, but log it
    }

    logger.info("Demo request confirmation email sent to prospect", {
      name: validName,
      email: validEmail,
      prospectEmailId: prospectEmailResponse.data?.id,
    });

    logger.info("Demo request submitted successfully", {
      name: validName,
      email: validEmail,
      company: validCompany,
      demoEmailId: data?.id,
      prospectEmailId: prospectEmailResponse.data?.id,
    });

    return {
      success: true,
      message: "Demo request submitted successfully",
      emailId: data?.id,
      prospectEmailId: prospectEmailResponse.data?.id,
    };
  } catch (error) {
    logger.error("Error processing demo request", {
      name,
      email,
      company,
      error: error.message,
      stack: error.stack,
    });
    return {
      success: false,
      error: "Internal server error",
    };
  }
}

// Contact request server action
export async function submitContactRequest(formData: FormData) {
  const resend = new Resend(process.env.AUTH_RESEND_KEY);

  // Extract form data
  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const phone = formData.get("phone") as string;
  const company = formData.get("company") as string;
  const jobRole = formData.get("jobRole") as string;
  const howDidYouHear = formData.get("howDidYouHear") as string;
  const message = formData.get("message") as string;

  logger.debug("Processing contact request", {
    name,
    email,
    company,
    jobRole,
  });

  // Validation schema for the contact request form
  const contactRequestSchema = z.object({
    name: z.string().min(1, "Name is required"),
    email: z.string().email("Please enter a valid email address"),
    phone: z.string().min(1, "Phone number is required"),
    company: z.string().min(1, "Company is required"),
    jobRole: z.string().min(1, "Job role is required"),
    howDidYouHear: z
      .string()
      .min(1, "Please let us know how you heard about us"),
    message: z.string().min(1, "Please enter your message"),
  });

  try {
    // Validate the form data
    const validation = contactRequestSchema.safeParse({
      name,
      email,
      phone,
      company,
      jobRole,
      howDidYouHear,
      message,
    });

    if (!validation.success) {
      logger.warn("Contact request validation failed", {
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

    const {
      name: validName,
      email: validEmail,
      phone: validPhone,
      company: validCompany,
      jobRole: validJobRole,
      howDidYouHear: validHowDidYouHear,
      message: validMessage,
    } = validation.data;

    const jobRoleLabel = formatFormValue(validJobRole);
    const howDidYouHearLabel = formatFormValue(validHowDidYouHear);

    logger.info("Processing contact request", {
      name: validName,
      email: validEmail,
      company: validCompany,
      jobRole: validJobRole,
    });

    // Create styled email content for contact team
    const contactEmailContent = `
      <div style="background-color: #f8fafc; padding: 24px; border-radius: 8px; margin: 16px 0;">
        <h3 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 600; color: #3f3f46;">Contact Details</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 12px 0; font-weight: 500; color: #3f3f46; width: 35%;">Name:</td>
            <td style="padding: 12px 0; color: #64748b;">${validName}</td>
          </tr>
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 12px 0; font-weight: 500; color: #3f3f46;">Email:</td>
            <td style="padding: 12px 0; color: #64748b;"><a href="mailto:${validEmail}" style="color: #18181b; text-decoration: none;">${validEmail}</a></td>
          </tr>
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 12px 0; font-weight: 500; color: #3f3f46;">Phone:</td>
            <td style="padding: 12px 0; color: #64748b;">${validPhone}</td>
          </tr>
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 12px 0; font-weight: 500; color: #3f3f46;">Company:</td>
            <td style="padding: 12px 0; color: #64748b;">${validCompany}</td>
          </tr>
          <tr>
            <td style="padding: 12px 0; font-weight: 500; color: #3f3f46;">Job Role:</td>
            <td style="padding: 12px 0; color: #64748b;">${jobRoleLabel}</td>
          </tr>
        </table>
      </div>
      
      <div style="background-color: #f8fafc; padding: 24px; border-radius: 8px; margin: 16px 0;">
        <h3 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 600; color: #3f3f46;">Additional Information</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 12px 0; font-weight: 500; color: #3f3f46; width: 35%;">How they heard about us:</td>
            <td style="padding: 12px 0; color: #64748b;">${howDidYouHearLabel}</td>
          </tr>
        </table>
      </div>
      
      <div style="background-color: #f8fafc; padding: 24px; border-radius: 8px; margin: 16px 0;">
        <h3 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 600; color: #3f3f46;">Message</h3>
        <p style="margin: 0; color: #64748b; line-height: 1.6; white-space: pre-wrap;">${validMessage}</p>
      </div>
      
      <div style="background-color: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 16px; margin: 16px 0;">
        <p style="margin: 0; color: #92400e; font-weight: 500;">
          Action Required: Please respond to this inquiry within 1 business day.
        </p>
      </div>
    `;

    // Send email to contact@askseer.ai
    const { data, error } = await resend.emails.send({
      from: process.env.AUTH_RESEND_FROM || "onboarding@resend.dev",
      to: ["contact@askseer.ai"],
      subject: `Contact Request - ${validName} at ${validCompany}`,
      html: createStyledEmailHtml({
        title: "New Contact Request",
        subtitle: "Someone has reached out through the contact form.",
        content: contactEmailContent,
        showFooter: false,
      }),
      text: `
        New Contact Request
        
        Contact Details:
        Name: ${validName}
        Email: ${validEmail}
        Phone: ${validPhone}
        Company: ${validCompany}
        Job Role: ${jobRoleLabel}
        
        How they heard about us: ${howDidYouHearLabel}
        
        Message:
        ${validMessage}
        
        Please respond to this inquiry within 1 business day.
      `,
    });

    if (error) {
      logger.error("Failed to send contact request email to contact team", {
        name: validName,
        email: validEmail,
        company: validCompany,
        error: error.message,
      });
      return {
        success: false,
        error: "Failed to send email",
      };
    }

    logger.info("Contact request email sent to contact team", {
      name: validName,
      email: validEmail,
      company: validCompany,
      emailId: data?.id,
    });

    // Create styled email content for sender confirmation
    const senderEmailContent = `
      <p style="margin: 16px 0; font-size: 16px; color: #64748b; line-height: 1.6;">
        Hi ${validName},
      </p>
      
      <p style="margin: 16px 0; font-size: 16px; color: #64748b; line-height: 1.6;">
        Thank you for reaching out to Seer! We've received your message and a member of our team will respond within 1 business day.
      </p>
      
      <div style="background-color: #f8fafc; padding: 24px; border-radius: 8px; margin: 24px 0; border: 1px solid #e2e8f0;">
        <h3 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 600; color: #3f3f46;">Your Message Summary</h3>
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
            <td style="padding: 12px 0; font-weight: 500; color: #3f3f46;">Company:</td>
            <td style="padding: 12px 0; color: #64748b;">${validCompany}</td>
          </tr>
          <tr>
            <td style="padding: 12px 0; font-weight: 500; color: #3f3f46;">Job Role:</td>
            <td style="padding: 12px 0; color: #64748b;">${jobRoleLabel}</td>
          </tr>
        </table>
      </div>
      
      <div style="background-color: #f8fafc; padding: 24px; border-radius: 8px; margin: 24px 0; border: 1px solid #e2e8f0;">
        <h3 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 600; color: #3f3f46;">Your Message</h3>
        <p style="margin: 0; color: #64748b; line-height: 1.6; white-space: pre-wrap;">${validMessage}</p>
      </div>
      
      <p style="margin: 24px 0 16px 0; font-size: 16px; color: #64748b; line-height: 1.6;">
        In the meantime, feel free to explore our platform by 
        <a href="https://askseer.ai/signin" style="color: #18181b; text-decoration: none; font-weight: 500;">signing up for free</a>.
      </p>
      
      <p style="margin: 16px 0; font-size: 16px; color: #64748b; line-height: 1.6;">
        If you have any urgent questions, please don't hesitate to reach out to us at 
        <a href="mailto:contact@askseer.ai" style="color: #18181b; text-decoration: none; font-weight: 500;">contact@askseer.ai</a>
      </p>
    `;

    // Send confirmation email to the sender
    const senderEmailResponse = await resend.emails.send({
      from: process.env.AUTH_RESEND_FROM || "onboarding@resend.dev",
      to: [validEmail],
      subject: "We've received your message - Seer",
      html: createStyledEmailHtml({
        title: "Message Received",
        subtitle: "We'll be in touch soon with a response.",
        content: senderEmailContent,
        footerEmail: "contact@askseer.ai",
        footerResponseDays: "1 business day",
      }),
      text: `
        Message Received
        
        Hi ${validName},
        
        Thank you for reaching out to Seer! We've received your message and a member of our team will respond within 1 business day.
        
        Your Message Summary:
        Name: ${validName}
        Email: ${validEmail}
        Company: ${validCompany}
        Job Role: ${jobRoleLabel}
        
        Your Message:
        ${validMessage}
        
        In the meantime, feel free to explore our platform by signing up for free at https://askseer.ai/signin
        
        If you have any urgent questions, please don't hesitate to reach out to us at contact@askseer.ai
        
        The Seer Team
      `,
    });

    if (senderEmailResponse.error) {
      logger.error(
        "Failed to send contact request confirmation email to sender",
        {
          name: validName,
          email: validEmail,
          error: senderEmailResponse.error.message,
        },
      );
      // Don't fail the entire request if sender email fails, but log it
    }

    logger.info("Contact request confirmation email sent to sender", {
      name: validName,
      email: validEmail,
      senderEmailId: senderEmailResponse.data?.id,
    });

    logger.info("Contact request submitted successfully", {
      name: validName,
      email: validEmail,
      company: validCompany,
      contactEmailId: data?.id,
      senderEmailId: senderEmailResponse.data?.id,
    });

    return {
      success: true,
      message: "Contact request submitted successfully",
      emailId: data?.id,
      senderEmailId: senderEmailResponse.data?.id,
    };
  } catch (error) {
    logger.error("Error processing contact request", {
      name,
      email,
      company,
      error: error.message,
      stack: error.stack,
    });
    return {
      success: false,
      error: "Internal server error",
    };
  }
}
