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

// Schema for generating persona basics
const PersonaBasicsSchema = z
  .object({
    name: z.string().min(2).max(100),
    oneLiner: z.string().min(5).max(200),
  })
  .strict();

// Generate a persona name and one-liner using OpenAI given extra context.
async function generatePersonaBasics(params: {
  extra: unknown;
  name?: string | null;
  oneLiner?: string | null;
}) {
  const { extra, name, oneLiner } = params;

  const provided = {
    name: name?.trim() || undefined,
    oneLiner: oneLiner?.trim() || undefined,
  };

  const messages = [
    {
      role: "system" as const,
      content:
        "You create concise, realistic persona basics for UX research. Return only JSON matching the schema. Keep any provided value and generate the missing one to be coherent and professional.",
    },
    {
      role: "user" as const,
      content: [
        "Persona extra/context (JSON):",
        (() => {
          try {
            return JSON.stringify(extra ?? {}, null, 2);
          } catch {
            return String(extra ?? {});
          }
        })(),
        "\nExisting values (if any):",
        JSON.stringify(provided, null, 2),
        "\nTask: Produce a realistic person title and a crisp, human one-liner (role/context/value).",
      ].join("\n"),
    },
  ];

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages,
    response_format: zodResponseFormat(PersonaBasicsSchema, "persona_basics"),
    temperature: 0.7,
  });

  const content = completion.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI returned no content for persona basics");
  }

  let parsed: z.infer<typeof PersonaBasicsSchema> | null = null;
  try {
    parsed = PersonaBasicsSchema.parse(JSON.parse(content));
  } catch (e) {
    logger.warn(
      "Failed to parse persona basics JSON; attempting lenient parse",
      {
        error: (e as Error)?.message,
        contentSnippet: content.slice(0, 200),
      }
    );
  }

  // Honor any provided value by overriding the model output
  const resolved = {
    name: provided.name ?? parsed!.name,
    oneLiner: provided.oneLiner ?? parsed!.oneLiner,
  };

  logger.debug("Generated persona basics", {
    hasName: !!provided.name,
    hasOneLiner: !!provided.oneLiner,
    resolved,
  });
  return resolved;
}

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
    const payloadPersona = (jobData.payload as any)?.persona;
    const extraPersona = (jobData.payload as any)?.extra?.persona;
    const persona: any = payloadPersona ?? extraPersona;
    if (!persona || typeof persona !== "object") {
      logger.warn("Persona not provided in payload", {
        hasPayloadPersona: !!payloadPersona,
        hasExtraPersona: !!extraPersona,
        payloadKeys: Object.keys(jobData.payload || {}),
      });
      throw new Error("Persona not provided");
    }

    // If there is not a name or one-liner, generate using persona.extra; if one is provided, use it to generate the other.
    const hasName = !!(persona.name && persona.name.trim());
    const hasOneLiner = !!(
      (persona.oneLiner && String(persona.oneLiner).trim()) ||
      (persona.description && String(persona.description).trim())
    );
    if (!hasName || !hasOneLiner) {
      const basics = await generatePersonaBasics({
        extra: persona,
        name: persona.name,
        oneLiner: persona.oneLiner ?? persona.description,
      });
      if (!hasName) persona.name = basics.name;
      if (!hasOneLiner) {
        persona.oneLiner = basics.oneLiner;
      }
    }

    // If description exists and oneLiner isn't set, mirror it so DB has a value
    if (persona.description && !persona.oneLiner) {
      persona.oneLiner = String(persona.description).trim();
    }

    const baseName = persona.name?.trim() || jobData.payload.name?.trim();
    const baseOneLiner = (persona.oneLiner ?? persona.description)?.trim();

    // Prefer provided image keys from the payload if present
    let photoKey: string | undefined = persona.images?.photoKey;
    let coverKey: string | undefined = persona.images?.coverKey;

    // Only generate if no key and no URL provided
    if (!photoKey && !persona.photoUrl) {
      try {
        const { url, key } = await generateAndUploadPersonaImage({
          kind: "photo",
          userId: jobData.userId,
          studyId: jobData.studyId,
          name: baseName,
          oneLiner: baseOneLiner,
        });
        persona.photoUrl = url;
        photoKey = key;
      } catch (e) {
        logger.warn("Skipping photo generation due to error", {
          studyId: jobData.studyId,
          error: String(e),
        });
      }
    }

    if (!coverKey && !persona.coverUrl) {
      try {
        const { url, key } = await generateAndUploadPersonaImage({
          kind: "cover",
          userId: jobData.userId,
          studyId: jobData.studyId,
          name: baseName,
          oneLiner: baseOneLiner,
        });
        persona.coverUrl = url;
        coverKey = key;
      } catch (e) {
        logger.warn("Skipping cover generation due to error", {
          studyId: jobData.studyId,
          error: String(e),
        });
      }
    }

    // Add the persona to the database
    const response = await fetch(`${process.env.DB_WORKER_URL}/api/persona`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studyData: jobData,
        persona: {
          name: persona.name,
          oneLiner: persona.oneLiner ?? persona.description,
          photoKey: photoKey,
          coverKey: coverKey,
          payload: persona,
        },
      }),
    });
    if (!response.ok) {
      let errorBody: string | undefined;
      try {
        errorBody = await response.text();
      } catch {}
      logger.error("Failed to save persona to database", {
        studyId: jobData.studyId,
        status: response.status,
        statusText: response.statusText,
        body: errorBody?.slice(0, 500),
      });
      throw new Error(`Error adding persona to database: ${response.status}`);
    }
    logger.info("Persona saved to database successfully", {
      studyId: jobData.studyId,
    });

    // Update the study status to completed
    await updateStatus(jobData.studyId, "completed");
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
