// OpenAI imports
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";

// Zod imports
import { z } from "zod";

// Import logger
import { logger } from "./logger.ts";
import type { JobEnvelopeV2_PE } from "@/apps/shared/jobSchema.ts";

// Import utility functions
import {
  updateCredits,
  updateStatus,
  getPresignedUrl,
} from "@/apps/ai-worker/src/utils.ts";

// AWS imports
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

// Node imports
import { randomUUID } from "crypto";

// Load environment variables
import dotenv from "dotenv";
dotenv.config();

// Initialize OpenAI
const openai = new OpenAI();

// Initialize S3
const s3 = new S3Client({ region: process.env.AWS_REGION });

// Generate an image using OpenAI Images API
export async function generatePersonaImage(
  prompt: string,
  size: "1024x1024" | "512x512" | "256x256" = "1024x1024"
) {
  const start = Date.now();
  const response = await openai.images.generate({
    model: "gpt-image-1",
    prompt,
    size,
    // Default output is base64 JSON
  });

  const imageB64 = response.data?.[0]?.b64_json;
  if (!imageB64) {
    throw new Error("OpenAI image generation returned no image data");
  }

  const buffer = Buffer.from(imageB64, "base64");
  const durationMs = Date.now() - start;
  logger.debug("Generated persona image with OpenAI", {
    size,
    bytes: buffer.byteLength,
    durationMs,
  });

  return { buffer, contentType: "image/png" as const };
}

// Upload a buffer to S3 and return the object key
export async function uploadBufferToS3(params: {
  buffer: Buffer;
  key: string;
  contentType: string;
}) {
  const { buffer, key, contentType } = params;

  if (!process.env.AWS_BUCKET_NAME) {
    throw new Error("AWS_BUCKET_NAME is not set");
  }

  await s3.send(
    new PutObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })
  );

  logger.info("Uploaded image to S3", { key, bytes: buffer.byteLength });
  return key;
}

// Build an image prompt for either a photo or cover
function buildPersonaImagePrompt(
  kind: "photo" | "cover",
  name?: string | null,
  oneLiner?: string | null
) {
  const parts =
    kind === "photo"
      ? [
          "Professional, realistic portrait photo, natural lighting, shallow depth of field, 3:4 head-and-shoulders composition",
          name ? `Subject name hint: ${name}` : undefined,
          oneLiner ? `Demographic/role hint: ${oneLiner}` : undefined,
          "neutral background, high detail, cinematic, ultra photorealistic",
        ]
      : [
          "Cinematic abstract cover image, gradient shapes and subtle textures, modern, clean, minimalist",
          name ? `Theme hint: ${name}` : undefined,
          oneLiner ? `Context hint: ${oneLiner}` : undefined,
          "no text, 16:9 composition, soft lighting, high resolution",
        ];
  return parts.filter(Boolean).join(". ");
}

// Generate an image, upload to S3, and return { key, url }
async function generateAndUploadPersonaImage(params: {
  kind: "photo" | "cover";
  userId: string;
  studyId: string;
  name?: string | null;
  oneLiner?: string | null;
}) {
  const { kind, userId, studyId, name, oneLiner } = params;
  const prompt = buildPersonaImagePrompt(kind, name, oneLiner);
  const { buffer, contentType } = await generatePersonaImage(
    prompt,
    "1024x1024"
  );
  const key = `studies/${userId}/${studyId}/persona/${kind}-${randomUUID()}.png`;
  const s3Key = await uploadBufferToS3({ buffer, key, contentType });
  const url = await getPresignedUrl(s3Key);
  logger.debug(`Persona ${kind} generated and uploaded`, { key: s3Key });
  return { key: s3Key, url };
}

export async function processPersona(jobData: JobEnvelopeV2_PE) {
  logger.info("Processing persona", {
    studyId: jobData.studyId,
    userId: jobData.userId,
  });

  try {
    if (!jobData.payload.persona) {
      throw new Error("Persona not provided");
    }

    const persona = jobData.payload.persona;

    // If there is not a name or one-liner, generate the name and one-liner

    const baseName = persona.name?.trim() || jobData.payload.name?.trim();
    const baseOneLiner = persona.oneLiner?.trim();

    if (!persona.photoUrl) {
      const { url } = await generateAndUploadPersonaImage({
        kind: "photo",
        userId: jobData.userId,
        studyId: jobData.studyId,
        name: baseName,
        oneLiner: baseOneLiner,
      });
      persona.photoUrl = url;
    }

    if (!persona.coverUrl) {
      const { url } = await generateAndUploadPersonaImage({
        kind: "cover",
        userId: jobData.userId,
        studyId: jobData.studyId,
        name: baseName,
        oneLiner: baseOneLiner,
      });
      persona.coverUrl = url;
    }

    // Add the persona to the database
  } catch (error) {
    logger.error("Error processing persona", {
      studyId: jobData.studyId,
      userId: jobData.userId,
      error,
    });

    // TODO: This should be one call to the database worker

    // Refund the user credit
    if (!jobData.retry) {
      logger.info("Refunding user credit due to processing error", {
        userId: jobData.userId,
        creditsToRefund: 1,
        studyId: jobData.studyId,
      });
      await updateCredits(jobData.userId, 1);
    } else {
      logger.debug("Skipping credit refund for retry job", {
        userId: jobData.userId,
        studyId: jobData.studyId,
      });
    }

    // Update the study status
    logger.info("Updating study status to failed", {
      studyId: jobData.studyId,
    });
    await updateStatus(jobData.studyId, "failed");
  }
}
