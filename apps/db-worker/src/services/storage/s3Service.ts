import {
  CopyObjectCommand,
  DeleteObjectsCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { logger } from "@/apps/shared/logger.ts";
import { InternalServerError } from "../shared/errors.ts";

const s3Client = new S3Client({ region: process.env.AWS_REGION });

export interface DeleteResult {
  deleted: string[];
  errors: Array<{ key: string; message: string }>;
}

/**
 * Delete multiple S3 objects in batches
 * @param keys Array of S3 object keys to delete
 * @returns Object containing deleted keys and any errors
 */
export async function deleteS3Objects(keys: string[]): Promise<DeleteResult> {
  const bucket = process.env.AWS_BUCKET || process.env.AWS_BUCKET_NAME;

  if (!bucket) {
    throw InternalServerError("AWS bucket not configured");
  }

  if (!keys.length) {
    return {
      deleted: [],
      errors: [],
    };
  }

  const deleted: string[] = [];
  const errors: Array<{ key: string; message: string }> = [];

  // S3 DeleteObjects supports up to 1000 keys per request
  const batches = Array.from(
    { length: Math.ceil(keys.length / 1000) },
    (_, index) => keys.slice(index * 1000, (index + 1) * 1000),
  );

  const responses = await Promise.allSettled(
    batches.map((batch) =>
      s3Client.send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: { Objects: batch.map((key) => ({ Key: key })) },
        }),
      ),
    ),
  );

  responses.forEach((result, idx) => {
    const batch = batches[idx];

    if (result.status === "fulfilled") {
      result.value.Deleted?.forEach((item) => {
        if (item.Key) deleted.push(item.Key);
      });

      result.value.Errors?.forEach((item) => {
        errors.push({
          key: item.Key || "",
          message: item.Message || "Unknown error",
        });
      });
      return;
    }

    logger.error("Failed to delete S3 objects batch", {
      bucket,
      count: batch.length,
      error: result.reason,
    });

    batch.forEach((key) =>
      errors.push({ key, message: result.reason?.message || "Unknown error" }),
    );
  });

  return { deleted, errors };
}

export interface CopyResult {
  oldKey: string;
  newKey: string;
}

/**
 * Copy S3 objects from one key to another within the same bucket.
 * Returns the list of successfully copied pairs.
 * Throws if any copy fails.
 */
export async function copyS3Objects(
  pairs: Array<{ oldKey: string; newKey: string }>,
): Promise<CopyResult[]> {
  const bucket = process.env.AWS_BUCKET || process.env.AWS_BUCKET_NAME;
  if (!bucket) {
    throw InternalServerError("AWS bucket not configured");
  }
  if (!pairs.length) return [];

  const results = await Promise.allSettled(
    pairs.map(async ({ oldKey, newKey }) => {
      const encodedSource = encodeURIComponent(oldKey).replace(/%2F/g, "/");
      await s3Client.send(
        new CopyObjectCommand({
          Bucket: bucket,
          Key: newKey,
          CopySource: `${bucket}/${encodedSource}`,
          MetadataDirective: "COPY",
        }),
      );
      return { oldKey, newKey };
    }),
  );

  const copied: CopyResult[] = [];
  results.forEach((result, idx) => {
    if (result.status === "fulfilled") {
      copied.push(result.value);
    } else {
      logger.error("Failed to copy S3 object", {
        pair: pairs[idx],
        error: result.reason,
      });
      throw result.reason;
    }
  });

  return copied;
}

/**
 * Get the configured S3 bucket name
 */
export function getS3Bucket(): string {
  const bucket = process.env.AWS_BUCKET || process.env.AWS_BUCKET_NAME;
  if (!bucket) {
    throw InternalServerError("AWS bucket not configured");
  }
  return bucket;
}
