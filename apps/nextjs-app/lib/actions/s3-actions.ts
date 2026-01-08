"use server";

import {
  S3Client,
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { logger } from "@/apps/shared/logger";
import {
  getUserTeams,
  getCompanyTeams,
  getCompanyMembers,
} from "@/apps/nextjs-app/lib/data";
import {
  requireAuth,
  actionSuccess,
  actionError,
  ActionResult,
  ROLE_OWNER,
  generateRandomFileName,
} from "@/apps/nextjs-app/lib/actions/shared";

// ==========================================
// S3 Configuration Constants
// ==========================================

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

// ==========================================
// S3 Utilities
// ==========================================

/**
 * Validates that required AWS environment variables are set.
 * @throws Error if any required environment variable is missing
 */
function validateAwsConfig(): void {
  if (!process.env.AWS_REGION) {
    throw new Error("AWS_REGION environment variable is not configured");
  }
  if (!process.env.AWS_BUCKET_NAME) {
    throw new Error("AWS_BUCKET_NAME environment variable is not configured");
  }
}

/**
 * Factory function to create an S3 client with standard configuration.
 * @throws Error if AWS environment variables are not configured
 */
function getS3Client(): S3Client {
  validateAwsConfig();
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
    const maxSizeMB = MAX_IMAGE_SIZE / (1024 * 1024);
    throw new Error(`Image too large. Max ${maxSizeMB}MB.`);
  }
}

/**
 * Generates a presigned PUT URL for uploading a file to S3.
 */
export async function generatePresignedPutUrl(
  key: string,
  contentType: string,
  expiresIn: number = PRESIGNED_PUT_URL_SHORT_EXPIRY,
): Promise<string> {
  const s3Client = getS3Client();
  const command = new PutObjectCommand({
    Bucket: process.env.AWS_BUCKET_NAME!,
    Key: key,
    ContentType: contentType,
  });
  return await getSignedUrl(s3Client, command, { expiresIn });
}

/**
 * Generates a presigned GET URL for downloading a file from S3.
 */
export async function generatePresignedGetUrl(
  key: string,
  expiresIn: number = PRESIGNED_GET_URL_EXPIRY,
): Promise<string> {
  const s3Client = getS3Client();
  const command = new GetObjectCommand({
    Bucket: process.env.AWS_BUCKET_NAME!,
    Key: key,
  });
  return await getSignedUrl(s3Client, command, { expiresIn });
}

// ==========================================
// Profile & Company Image Upload Actions
// ==========================================

export async function getProfileImagePutUrl(
  fileName: string,
  fileType: string,
  fileSize: number,
): Promise<ActionResult<{ uploadURL: string; key: string }>> {
  try {
    const user = await requireAuth();

    validateImageUpload(fileType, fileSize, PROFILE_IMAGE_TYPES, {
      userId: user.id,
      logPrefix: "profile image",
    });

    const key = `users/${user.id}/profile/${generateRandomFileName(fileName)}`;

    const uploadURL = await generatePresignedPutUrl(key, fileType);
    logger.debug("Generated presigned URL for profile image", {
      userId: user.id,
      key,
      fileType,
    });
    return actionSuccess({ uploadURL, key });
  } catch (error) {
    logger.error("Error generating profile image presigned URL", {
      fileType,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return actionError(
      error instanceof Error ? error.message : "Failed to generate upload URL",
    );
  }
}

export async function getCompanyLogoPutUrl(
  companyId: string,
  fileName: string,
  fileType: string,
  fileSize: number,
): Promise<ActionResult<{ uploadURL: string; key: string }>> {
  try {
    const user = await requireAuth();

    validateImageUpload(fileType, fileSize, COMPANY_LOGO_TYPES, {
      userId: user.id,
      logPrefix: "company logo",
    });

    const key = `companies/${companyId}/logo/${generateRandomFileName(fileName)}`;

    const uploadURL = await generatePresignedPutUrl(key, fileType);
    logger.debug("Generated presigned URL for company logo", {
      userId: user.id,
      companyId,
      key,
      fileType,
    });
    return actionSuccess({ uploadURL, key });
  } catch (error) {
    logger.error("Error generating company logo presigned URL", {
      companyId,
      fileType,
      error: error instanceof Error ? error.message : String(error),
    });
    return actionError(
      error instanceof Error ? error.message : "Failed to generate upload URL",
    );
  }
}

// ==========================================
// Presigned GET URL Actions
// ==========================================

export async function getPresignedUrls(
  key: string,
): Promise<ActionResult<string>> {
  try {
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
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Also allow access to company team resources (for COMPANY-visibility studies)
    // Check all companies the user belongs to, not just the selected team's company
    if (!allowed.some((p) => key.startsWith(p)) && userCompanyIds.size > 0) {
      try {
        // Get all teams from all companies the user is a member of
        const companyTeamPromises = Array.from(userCompanyIds).map(
          (companyId) => getCompanyTeams(companyId),
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
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    if (!allowed.some((p) => key.startsWith(p))) {
      logger.warn(
        "Forbidden presigned GET URL request due to prefix mismatch",
        {
          userId: user.id,
          key,
        },
      );
      return actionError("Forbidden");
    }

    const url = await generatePresignedGetUrl(key);
    return actionSuccess(url);
  } catch (error) {
    logger.error("Error generating presigned GET URL", {
      key,
      error: error instanceof Error ? error.message : String(error),
    });
    return actionError(
      error instanceof Error ? error.message : "Failed to generate URL",
    );
  }
}

/**
 * Generate a presigned URL for publicly shared content.
 * This function does NOT require authentication and should only be used
 * for content that has already been verified as publicly accessible.
 * The caller is responsible for verifying the content is public before calling.
 */
export async function getPublicPresignedUrl(
  key: string,
): Promise<ActionResult<string>> {
  try {
    const url = await generatePresignedGetUrl(key);
    return actionSuccess(url);
  } catch (error) {
    logger.error("Error generating public presigned GET URL", {
      key,
      error: error instanceof Error ? error.message : String(error),
    });
    return actionError(
      error instanceof Error ? error.message : "Failed to generate URL",
    );
  }
}

export async function getCompanyLogoGetUrl(
  companyId: string,
  key: string,
): Promise<ActionResult<string>> {
  try {
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
      return actionError("Forbidden");
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
      return actionError("Forbidden");
    }
    const url = await generatePresignedGetUrl(key);
    return actionSuccess(url);
  } catch (error) {
    logger.error("Error generating presigned GET URL (company)", {
      key,
      companyId,
      error: error instanceof Error ? error.message : String(error),
    });
    return actionError(
      error instanceof Error ? error.message : "Failed to generate URL",
    );
  }
}

// ==========================================
// S3 Delete Actions
// ==========================================

export async function deleteS3Objects(
  keys: string[],
): Promise<ActionResult<{ deleted: string[]; skipped: string[] }>> {
  try {
    const user = await requireAuth();
    const s3Client = getS3Client();
    const bucketName = process.env.AWS_BUCKET_NAME!;

    if (!Array.isArray(keys) || keys.length === 0) {
      logger.warn("deleteS3Objects called with empty keys array", {
        userId: user.id,
      });
      return actionSuccess({ deleted: [], skipped: [] });
    }

    // Basic ownership / scope check: allow keys that start with allowed prefixes for this user
    const allowedPrefixes = [
      `${user.id}/`, // legacy
      `studies/${user.id}/`, // pre-teams
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
          if (me && String(me.role).toUpperCase() === ROLE_OWNER) {
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
            error: error instanceof Error ? error.message : String(error),
          });
          return { key, success: false };
        }
      }),
    );

    const deleted = results.filter((r) => r.success).map((r) => r.key);
    const failedDeletes = results.filter((r) => !r.success).map((r) => r.key);

    // If some deletes failed, add them to skipped
    const allSkipped = [...skipped, ...failedDeletes];

    return actionSuccess({ deleted, skipped: allSkipped });
  } catch (error) {
    logger.error("Error in deleteS3Objects", {
      error: error instanceof Error ? error.message : String(error),
    });
    return actionError(
      error instanceof Error ? error.message : "Failed to delete objects",
    );
  }
}
