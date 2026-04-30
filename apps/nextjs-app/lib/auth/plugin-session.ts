/**
 * Figma Plugin Session Data
 *
 * Server-side data fetching for plugin upload sessions.
 */

import {
  S3Client,
  GetObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { logger } from "@/apps/shared/logger";

const s3Client = new S3Client({ region: process.env.AWS_REGION });
const BUCKET_NAME = process.env.AWS_BUCKET_NAME!;
const PRESIGNED_URL_EXPIRY = 3600; // 1 hour

export interface PluginSessionFrame {
  key: string;
  nodeId: string;
  name: string;
  width: number;
  height: number;
  url?: string; // Presigned URL
}

export interface PluginSessionData {
  userId: string;
  teamId: string | null;
  fileName: string;
  studyType: "evaluation" | "walkthrough";
  name?: string;
  goal?: string;
  frames: PluginSessionFrame[];
  createdAt: string;
}

/**
 * Fetch plugin session data and generate presigned URLs for frames
 */
export async function getPluginSessionData(
  sessionId: string,
  userId: string,
): Promise<PluginSessionData | null> {
  try {
    // Try to find the session in S3 (metadata file)
    const metadataKey = `plugin-temp/${userId}/${sessionId}/metadata.json`;

    try {
      const response = await s3Client.send(
        new GetObjectCommand({
          Bucket: BUCKET_NAME,
          Key: metadataKey,
        }),
      );

      const bodyString = await response.Body?.transformToString();
      if (!bodyString) {
        return null;
      }

      const metadata: PluginSessionData = JSON.parse(bodyString);

      // Check if session is expired (older than 1 hour)
      const createdAt = new Date(metadata.createdAt);
      const now = new Date();
      const ageMinutes = (now.getTime() - createdAt.getTime()) / (1000 * 60);

      if (ageMinutes > 60) {
        logger.info("Plugin session expired", { sessionId, ageMinutes });
        return null;
      }

      // Generate presigned URLs for each frame
      const framesWithUrls = await Promise.all(
        metadata.frames.map(async (frame) => {
          const url = await getSignedUrl(
            s3Client,
            new GetObjectCommand({
              Bucket: BUCKET_NAME,
              Key: frame.key,
            }),
            { expiresIn: PRESIGNED_URL_EXPIRY },
          );
          return { ...frame, url };
        }),
      );

      return {
        ...metadata,
        frames: framesWithUrls,
      };
    } catch (error: any) {
      if (error.name === "NoSuchKey") {
        // Try listing objects with prefix to find frames directly
        const prefix = `plugin-temp/${userId}/${sessionId}/`;
        const listResponse = await s3Client.send(
          new ListObjectsV2Command({
            Bucket: BUCKET_NAME,
            Prefix: prefix,
          }),
        );

        const files =
          listResponse.Contents?.filter((obj) => obj.Key?.endsWith(".png")) ||
          [];

        if (files.length === 0) {
          return null;
        }

        // Build session data from files
        const frames = await Promise.all(
          files.map(async (file) => {
            const key = file.Key!;
            const name = key.split("/").pop()?.replace(".png", "") || "frame";
            const url = await getSignedUrl(
              s3Client,
              new GetObjectCommand({
                Bucket: BUCKET_NAME,
                Key: key,
              }),
              { expiresIn: PRESIGNED_URL_EXPIRY },
            );
            return {
              key,
              nodeId: "",
              name,
              width: 0,
              height: 0,
              url,
            };
          }),
        );

        return {
          userId,
          teamId: null,
          fileName: "Figma Import",
          studyType: "evaluation",
          frames,
          createdAt: new Date().toISOString(),
        };
      }
      throw error;
    }
  } catch (error) {
    logger.error("Failed to get plugin session data", {
      sessionId,
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Convert plugin session frames to File objects for form upload
 */
export async function downloadPluginFrames(
  frames: PluginSessionFrame[],
): Promise<Array<{ file: File; metadata: { nodeId: string; name: string } }>> {
  const results = [];

  for (const frame of frames) {
    if (!frame.url) continue;

    try {
      const response = await fetch(frame.url);
      const blob = await response.blob();
      const file = new File([blob], `${frame.name}.png`, { type: "image/png" });

      results.push({
        file,
        metadata: {
          nodeId: frame.nodeId,
          name: frame.name,
        },
      });
    } catch (error) {
      logger.warn("Failed to download plugin frame", {
        frameKey: frame.key,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return results;
}
