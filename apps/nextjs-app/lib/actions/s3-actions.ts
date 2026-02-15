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
} from "@/apps/nextjs-app/lib/db/data";
import {
  requireAuth,
  actionSuccess,
  actionError,
  ActionResult,
  ROLE_OWNER,
  generateRandomFileName,
} from "@/apps/nextjs-app/lib/actions/shared";

// ==========================================
// Types
// ==========================================

/** Company member data returned from getCompanyMembers */
type CompanyMember = {
  companyId: string;
  userId: string;
  role: string;
  canCreatePersonas: boolean;
  status: string;
  joinedAt: string;
  deactivatedAt: string | null;
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
    lastAccessedAt?: string | null;
  };
};

// ==========================================
// Constants
// ==========================================

// S3 path prefixes for different resource types
const S3_PREFIX_USERS = "users";
const S3_PREFIX_STUDIES = "studies";
const S3_PREFIX_COMPANIES = "companies";

// S3 path segments for specific resources
const S3_SEGMENT_PROFILE = "profile";
const S3_SEGMENT_LOGO = "logo";

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
// Private Utilities
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

// Singleton S3 client instance
let s3ClientInstance: S3Client | null = null;

/**
 * Returns a singleton S3 client instance.
 * Creates the client on first call and reuses it for subsequent calls.
 * This improves performance by reusing connections and avoiding the
 * overhead of creating a new client for each request.
 *
 * @throws Error if AWS environment variables are not configured
 */
function getS3Client(): S3Client {
  if (!s3ClientInstance) {
    validateAwsConfig();
    s3ClientInstance = new S3Client({ region: process.env.AWS_REGION });
  }
  return s3ClientInstance;
}

/**
 * Validates that a required string parameter is not empty.
 * @throws Error if the value is empty or only whitespace
 */
function validateNonEmptyString(value: string, paramName: string): void {
  if (!value || value.trim() === "") {
    throw new Error(`${paramName} is required and cannot be empty`);
  }
}

/**
 * Checks if a member role is the owner role.
 * Handles case-insensitive comparison to avoid fragile string matching.
 */
function isOwnerRole(role: string | undefined | null): boolean {
  if (!role) return false;
  return String(role).toUpperCase() === ROLE_OWNER;
}

/**
 * Validates an image upload against allowed types and max size.
 * Returns an ActionResult for consistency with other validation functions.
 */
function validateImageUpload(
  fileType: string,
  fileSize: number,
  allowedTypes: string[],
  context: { userId: string; logPrefix: string },
): ActionResult<void> {
  if (!allowedTypes.includes(fileType)) {
    logger.warn(`Invalid ${context.logPrefix} content type`, {
      userId: context.userId,
      fileType,
    });
    const typeList = allowedTypes
      .map((t) => t.replace("image/", "").toUpperCase())
      .join(", ");
    return actionError(`Unsupported image type. Use ${typeList}.`);
  }
  if (fileSize > MAX_IMAGE_SIZE) {
    logger.warn(`${context.logPrefix} exceeds max size`, {
      userId: context.userId,
      fileSize,
    });
    const maxSizeMB = MAX_IMAGE_SIZE / (1024 * 1024);
    return actionError(`Image too large. Max ${maxSizeMB}MB.`);
  }
  return actionSuccess(undefined);
}

/**
 * Get all allowed S3 key prefixes for a user.
 * This includes personal prefixes, team prefixes, and company team prefixes.
 */
async function getAllowedPrefixesForUser(userId: string): Promise<string[]> {
  const allowed = [
    `${userId}/`, // legacy
    `${S3_PREFIX_STUDIES}/${userId}/`, // Pre-teams studies
    `${S3_PREFIX_USERS}/${userId}/`, // profile images
  ];

  // Allow access to all teams the user is a member of, and collect company IDs
  const userCompanyIds = new Set<string>();
  try {
    const userTeams = await getUserTeams(userId);
    for (const team of userTeams) {
      allowed.push(`${S3_PREFIX_STUDIES}/${team.id}/`);
      // Collect company IDs for COMPANY-visibility access
      if (team.companyId) {
        userCompanyIds.add(team.companyId);
      }
    }
  } catch (error) {
    logger.debug("Could not fetch user teams for S3 key authorization", {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Also allow access to company team resources (for COMPANY-visibility studies)
  if (userCompanyIds.size > 0) {
    try {
      // Get all teams from all companies the user is a member of
      const companyTeamPromises = Array.from(userCompanyIds).map((companyId) =>
        getCompanyTeams(companyId),
      );
      const companyTeamsArrays = await Promise.all(companyTeamPromises);
      for (const companyTeams of companyTeamsArrays) {
        for (const t of companyTeams) {
          allowed.push(`${S3_PREFIX_STUDIES}/${t.id}/`);
        }
      }
    } catch (error) {
      logger.debug(
        "Could not check company team access for S3 key authorization",
        {
          userId,
          error: error instanceof Error ? error.message : String(error),
        },
      );
    }
  }

  return allowed;
}

// ==========================================
// Internal URL Generators
// ==========================================

/**
 * Generates a presigned PUT URL for uploading a file to S3.
 * Exported for use by study-lifecycle-actions.
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
 * Internal function - use getPresignedUrls or getPublicPresignedUrl for external access.
 */
async function generatePresignedGetUrl(
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
// Public Actions - PUT URLs (Uploads)
// ==========================================

export async function getProfileImagePutUrl(
  fileName: string,
  fileType: string,
  fileSize: number,
): Promise<ActionResult<{ uploadURL: string; key: string }>> {
  try {
    validateNonEmptyString(fileName, "fileName");
    validateNonEmptyString(fileType, "fileType");

    const user = await requireAuth();

    const validation = validateImageUpload(
      fileType,
      fileSize,
      PROFILE_IMAGE_TYPES,
      {
        userId: user.id,
        logPrefix: "profile image",
      },
    );
    if (!validation.success) {
      return validation;
    }

    const key = `${S3_PREFIX_USERS}/${user.id}/${S3_SEGMENT_PROFILE}/${generateRandomFileName(fileName)}`;

    const uploadURL = await generatePresignedPutUrl(key, fileType);
    logger.debug("Generated presigned URL for profile image", {
      userId: user.id,
      key,
      fileType,
    });
    return actionSuccess({ uploadURL, key });
  } catch (error) {
    logger.error("Error generating profile image presigned URL", {
      fileName,
      fileType,
      fileSize,
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
    validateNonEmptyString(companyId, "companyId");
    validateNonEmptyString(fileName, "fileName");
    validateNonEmptyString(fileType, "fileType");

    const user = await requireAuth();

    const validation = validateImageUpload(
      fileType,
      fileSize,
      COMPANY_LOGO_TYPES,
      {
        userId: user.id,
        logPrefix: "company logo",
      },
    );
    if (!validation.success) {
      return validation;
    }

    const key = `${S3_PREFIX_COMPANIES}/${companyId}/${S3_SEGMENT_LOGO}/${generateRandomFileName(fileName)}`;

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
      fileName,
      fileType,
      fileSize,
      error: error instanceof Error ? error.message : String(error),
    });
    return actionError(
      error instanceof Error ? error.message : "Failed to generate upload URL",
    );
  }
}

// ==========================================
// Public Actions - GET URLs (Downloads)
// ==========================================

export async function getPresignedUrls(
  key: string,
): Promise<ActionResult<string>> {
  try {
    validateNonEmptyString(key, "key");

    const user = await requireAuth();

    // Get all allowed prefixes for this user
    const allowed = await getAllowedPrefixesForUser(user.id);

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
 * Generate presigned GET URLs for multiple keys in a single batch.
 * Performs auth and prefix authorization once, then generates all URLs in parallel.
 * Returns only the successfully generated URLs (nulls filtered out).
 */
export async function getPresignedUrlsBatch(keys: string[]): Promise<string[]> {
  if (keys.length === 0) return [];

  try {
    const user = await requireAuth();
    const allowed = await getAllowedPrefixesForUser(user.id);

    const results = await Promise.all(
      keys.map(async (key) => {
        if (!allowed.some((p) => key.startsWith(p))) {
          logger.warn(
            "Forbidden presigned GET URL request due to prefix mismatch",
            { userId: user.id, key },
          );
          return null;
        }
        try {
          return await generatePresignedGetUrl(key);
        } catch (error) {
          logger.error("Error generating presigned GET URL in batch", {
            key,
            error: error instanceof Error ? error.message : String(error),
          });
          return null;
        }
      }),
    );

    return results.filter((url): url is string => url !== null);
  } catch (error) {
    logger.error("Error in batch presigned URL generation", {
      keyCount: keys.length,
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

/**
 * Generate a presigned URL for publicly shared content.
 *
 * ⚠️ SECURITY WARNING: This function does NOT require authentication.
 *
 * This should ONLY be used for content that has already been verified as
 * publicly accessible (e.g., studies with a valid shareToken). The caller
 * is responsible for:
 * 1. Verifying the content is marked as public in the database
 * 2. Validating any share tokens before calling this function
 * 3. Ensuring the key corresponds to the verified public resource
 *
 * DO NOT call this function with user-provided keys without validation.
 * Misuse could expose private user data.
 *
 * @param key - The S3 key for the public resource (must be pre-validated)
 */
export async function getPublicPresignedUrl(
  key: string,
): Promise<ActionResult<string>> {
  try {
    validateNonEmptyString(key, "key");

    // Log all public URL access for security auditing
    logger.info("Generating public presigned URL (unauthenticated access)", {
      key,
      timestamp: new Date().toISOString(),
    });

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
    validateNonEmptyString(companyId, "companyId");
    validateNonEmptyString(key, "key");

    const user = await requireAuth();
    if (!key.startsWith(`${S3_PREFIX_COMPANIES}/${companyId}/`)) {
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
    const isMember = members?.some((m: CompanyMember) => m.userId === user.id);
    if (!isMember) {
      logger.warn(
        "Forbidden presigned GET URL request for company due to membership check",
        {
          userId: user.id,
          companyId,
          key,
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
// Public Actions - Delete
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

    // Validate that all keys are non-empty strings
    const invalidKeys = keys.filter(
      (k) => !k || typeof k !== "string" || k.trim() === "",
    );
    if (invalidKeys.length > 0) {
      logger.warn("deleteS3Objects called with invalid keys", {
        userId: user.id,
        invalidCount: invalidKeys.length,
      });
      return actionError("All keys must be non-empty strings");
    }

    // Get all allowed prefixes for this user
    const allowedPrefixes = await getAllowedPrefixesForUser(user.id);

    // Check for company resources once (optimization)
    const companyPrefix = `${S3_PREFIX_COMPANIES}/`;
    const companyKeys = keys.filter((k) => k.startsWith(companyPrefix));
    const companyAuthMap = new Map<string, boolean>();

    if (companyKeys.length > 0) {
      // Extract unique company IDs
      const companyIds = new Set(
        companyKeys.map((k) => k.split("/")[1]).filter(Boolean),
      );

      // Check authorization for each company
      await Promise.all(
        Array.from(companyIds).map(async (companyId) => {
          try {
            const members = await getCompanyMembers(companyId);
            const me = members?.find(
              (m: CompanyMember) => m.userId === user.id,
            );
            const isAuthorized = me && isOwnerRole(me.role);
            companyAuthMap.set(companyId, Boolean(isAuthorized));
          } catch (e) {
            companyAuthMap.set(companyId, false);
          }
        }),
      );
    }

    const authorized: string[] = [];
    const skipped: string[] = [];

    for (const k of keys) {
      // Check standard prefixes
      if (allowedPrefixes.some((p) => k.startsWith(p))) {
        authorized.push(k);
        continue;
      }

      // Check company authorization
      if (k.startsWith(companyPrefix)) {
        const companyId = k.split("/")[1];
        if (companyId && companyAuthMap.get(companyId)) {
          authorized.push(k);
          continue;
        }
      }

      skipped.push(k);
    }

    if (skipped.length) {
      logger.warn("Some keys skipped due to failed ownership / prefix check", {
        userId: user.id,
        skippedCount: skipped.length,
        skippedSample: skipped.slice(0, 3), // Log first 3 skipped keys for debugging
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
      keyCount: keys?.length ?? 0,
      sampleKeys: keys?.slice(0, 3), // Log first 3 keys for debugging
      error: error instanceof Error ? error.message : String(error),
    });
    return actionError(
      error instanceof Error ? error.message : "Failed to delete objects",
    );
  }
}
