/**
 * Singleton S3 client and S3-related utilities
 */

import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { config } from "../config.ts";
import { logger } from "@/apps/shared/logger.ts";

// ============================================================================
// Singleton S3 Client
// ============================================================================

/**
 * Shared S3 client instance - initialized once and reused
 */
export const s3Client = new S3Client({
  region: config.aws.region,
  credentials: {
    accessKeyId: config.aws.accessKeyId,
    secretAccessKey: config.aws.secretAccessKey,
  },
});

// ============================================================================
// S3 Utilities
// ============================================================================

/**
 * Get a presigned URL for a file in S3
 * @param key - The S3 object key
 * @returns Presigned URL valid for 1 hour
 */
export async function getPresignedUrl(key: string): Promise<string> {
  logger.debug("Generating presigned URL", { key });

  const command = new GetObjectCommand({
    Bucket: config.aws.bucketName,
    Key: key,
  });

  try {
    const url = await getSignedUrl(s3Client, command, {
      expiresIn: config.processing.presignedUrlExpiry,
    });

    logger.debug("Presigned URL generated successfully", {
      key,
      urlLength: url.length,
      expiresIn: config.processing.presignedUrlExpiry,
    });

    return url;
  } catch (error) {
    logger.error("Error generating pre-signed URL", { error, key });
    throw error;
  }
}

/**
 * Upload a buffer to S3
 * @param params - Upload parameters
 * @returns The S3 object key
 */
export async function uploadBufferToS3(params: {
  buffer: Buffer;
  key: string;
  contentType: string;
}): Promise<string> {
  const { buffer, key, contentType } = params;

  await s3Client.send(
    new PutObjectCommand({
      Bucket: config.aws.bucketName,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })
  );

  logger.info("Uploaded file to S3", { key, bytes: buffer.byteLength });
  return key;
}
