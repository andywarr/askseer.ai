// AWS imports
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Import logger
import { logger } from "./logger.ts";

// Load environment variables
import dotenv from "dotenv";
dotenv.config();

// Interfaces
export interface File {
  id: string;
  name: string;
  key: string | null;
  size: number;
  type: string;
}

// Get files for a study
export async function getFiles(studyId: string) {
  logger.debug("Fetching files for study", { studyId });

  // Get files
  const response = await fetch(
    `${process.env.DB_WORKER_URL}/api/files?studyId=${studyId}`
  );

  if (!response.ok) {
    logger.error("Failed to fetch files", {
      studyId,
      status: response.status,
      statusText: response.statusText,
    });
    throw new Error(
      `Failed to fetch files: ${response.status} ${response.statusText}`
    );
  }

  const { data: files } = await response.json();

  logger.debug("Files retrieved successfully", {
    studyId,
    fileCount: files?.length || 0,
    fileSizes: files?.map((f: File) => ({ name: f.name, size: f.size })) || [],
  });

  return files;
}

// Get a presigned URL for a file in S3
export async function getPresignedUrl(key: string) {
  logger.debug("Generating presigned URL", { key });

  const s3Client = new S3Client({ region: process.env.AWS_REGION });

  const command = new GetObjectCommand({
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: key, // Path to your image in S3
  });

  try {
    // Generate a pre-signed URL valid for 1 hour (3600 seconds)
    const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

    logger.debug("Presigned URL generated successfully", {
      key,
      urlLength: url.length,
      expiresIn: 3600,
    });

    return url;
  } catch (error) {
    logger.error("Error generating pre-signed URL", { error, key });
    throw error;
  }
}

// Update user credits
export async function updateCredits(userId: string, credits: number) {
  logger.debug("Updating user credits", { userId, credits });

  try {
    const response = await fetch(
      `${process.env.DB_WORKER_URL}/api/updateCredits`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId: userId, delta: credits }),
      }
    );

    if (!response.ok) {
      logger.error("Failed to update user credits", {
        userId,
        credits,
        status: response.status,
        statusText: response.statusText,
      });
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    logger.info("User credits updated successfully", {
      userId,
      creditsDelta: credits,
      newBalance: data.credits || "unknown",
    });

    return data;
  } catch (error) {
    logger.error("Error updating credits", { error, userId, credits });
    throw error;
  }
}

// Update study status
export async function updateStatus(studyId: string, status: string) {
  logger.debug("Updating study status", { studyId, status });

  try {
    const response = await fetch(
      `${process.env.DB_WORKER_URL}/api/studyStatus`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ studyId: studyId, status: status }),
      }
    );

    if (!response.ok) {
      logger.error("Failed to update study status", {
        studyId,
        status,
        httpStatus: response.status,
        statusText: response.statusText,
      });
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    logger.info("Study status updated successfully", {
      studyId,
      newStatus: status,
      previousStatus: data.previousStatus || "unknown",
    });

    return data;
  } catch (error) {
    logger.error("Error updating study status", { error, studyId, status });
    throw error;
  }
}
