// OpenAI imports
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";

// Zod imports
import { z } from "zod";

// Import logger
import { logger } from "@/apps/shared/logger.ts";
import type { JobEnvelopeV2_PE, Persona } from "@/apps/shared/jobSchema.ts";

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
    description: z.string().min(5).max(500),
  })
  .strict();

// Generate a persona name and description using OpenAI given extra context.
async function generatePersonaBasics(params: {
  extra: unknown;
  name?: string | null;
  description?: string | null;
}) {
  const { extra, name, description } = params;

  const provided = {
    name: name?.trim() || undefined,
    description: description?.trim() || undefined,
  };

  const messages = [
    {
      role: "system" as const,
      content:
        "You create concise, realistic persona basics for UX research. Return only JSON matching the schema.",
    },
    {
      role: "user" as const,
      content: [
        "Persona content (JSON):",
        (() => {
          try {
            return JSON.stringify(extra ?? {}, null, 2);
          } catch {
            return String(extra ?? {});
          }
        })(),
        "\nExisting values (if any):",
        JSON.stringify(provided, null, 2),
        "\nTask: Produce a realistic person title and a crisp, description using only the context provided. The name and description should be complete and less than the character limits.",
      ].join("\n"),
    },
  ];

  let completion;
  try {
    completion = await openai.responses.create({
      model: process.env.PERSONA_MODEL || "gpt-5-2025-08-07",
      input: messages,
      text: {
        format: zodTextFormat(PersonaBasicsSchema, "persona_basics"),
      },
      stream: false,
    });
  } catch (error) {
    console.log(error);
    logger.error("Failed to call OpenAI API for persona basics", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      model: process.env.HE_EVAL_MODEL || "gpt-5-2025-08-07",
    });
    throw error;
  }

  const content = completion.output_text?.trim();
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
    description: provided.description ?? parsed!.description,
  };

  logger.debug("Generated persona basics", {
    hasName: !!provided.name,
    hasDescription: !!provided.description,
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

  let response;
  try {
    response = await openai.images.generate({
      model: "gpt-image-1",
      prompt,
      size,
      // Default output is base64 JSON
    });
  } catch (error) {
    logger.error("Failed to call OpenAI Images API", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      model: "gpt-image-1",
      size,
    });
    throw error;
  }

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
  persona?: Record<string, any> | null
) {
  const parts =
    kind === "photo"
      ? [
          "Professional, realistic portrait photo, natural lighting, shallow depth of field, 3:4 head-and-shoulders composition",
          persona?.name ? `Subject name hint: ${persona.name}` : undefined,
          persona?.oneLiner
            ? `Demographic/role hint: ${persona.oneLiner}`
            : undefined,
          "neutral background, high detail, cinematic, ultra photorealistic",
        ]
      : [
          "Cinematic abstract cover image, gradient shapes and subtle textures, modern, clean, minimalist",
          persona?.name ? `Theme hint: ${persona.name}` : undefined,
          persona?.oneLiner ? `Context hint: ${persona.oneLiner}` : undefined,
          "no text, 16:9 composition, soft lighting, high resolution",
        ];
  const base = parts.filter(Boolean).join(". ");
  let personaJson: string | undefined;
  if (persona) {
    try {
      personaJson = JSON.stringify(persona, null, 2);
    } catch {
      personaJson = String(persona);
    }
  }
  return personaJson ? `${base}\n\nPersona JSON:\n${personaJson}` : base;
}

// Generate an image, upload to S3, and return { key, url }
async function generateAndUploadPersonaImage(params: {
  kind: "photo" | "cover";
  teamId: string;
  studyId: string;
  persona?: Record<string, any> | null;
}) {
  const { kind, teamId, studyId, persona } = params;
  const prompt = buildPersonaImagePrompt(kind, persona);
  const { buffer, contentType } = await generatePersonaImage(
    prompt,
    "1024x1024"
  );
  const key = `studies/${teamId}/${studyId}/persona/${kind}-${randomUUID()}.png`;
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
    const persona = jobData.payload.persona;
    if (!persona || typeof persona !== "object") {
      logger.warn("Persona not provided in payload", {
        hasPayloadPersona: !!persona,
      });
      throw new Error("Persona not provided");
    }

    // Work with the structured persona data bag (strictly typed)
    const data: Persona = persona.data ?? {};

    // Ensure basics: generate name/description when missing
    const providedName = (data.name as string | undefined)?.trim();
    const providedDescription = (
      data.description as string | undefined
    )?.trim();
    let finalName = providedName;
    let finalDescription = providedDescription;
    if (!finalName || !finalDescription) {
      const basics = await generatePersonaBasics({
        extra: data,
        name: finalName,
        description: finalDescription,
      });
      if (!finalName) finalName = basics.name;
      if (!finalDescription) finalDescription = basics.description;
    }

    // Prefer provided image keys from structured data if present
    const images: NonNullable<Persona["images"]> = data.images ?? {};
    let photoKey: string | undefined = images.photoKey;
    let coverKey: string | undefined = images.coverKey;

    // Only generate if no key and no URL provided
    if (!photoKey && !persona.photoUrl) {
      try {
        const { url, key } = await generateAndUploadPersonaImage({
          kind: "photo",
          teamId: jobData.teamId || jobData.userId, // Fall back to userId for legacy jobs
          studyId: jobData.studyId,
          persona,
        });
        persona.photoUrl = url;
        photoKey = key;
        images.photoKey = key;
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
          teamId: jobData.teamId || jobData.userId, // Fall back to userId for legacy jobs
          studyId: jobData.studyId,
          persona,
        });
        persona.coverUrl = url;
        coverKey = key;
        images.coverKey = key;
      } catch (e) {
        logger.warn("Skipping cover generation due to error", {
          studyId: jobData.studyId,
          error: String(e),
        });
      }
    }

    // Persist back updated images into structured data
    if (Object.keys(images).length) {
      persona.data = { ...data, images };
    }
    // Also persist the resolved name if it was missing in data
    if (!providedName && finalName) {
      persona.data = { ...(persona.data || {}), name: finalName };
    }
    // Also persist the resolved description if it was missing in data
    if (!providedDescription && finalDescription) {
      persona.data = { ...(persona.data || {}), description: finalDescription };
    }

    // Add the persona to the database
    const response = await fetch(`${process.env.DB_WORKER_URL}/api/persona`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studyData: jobData,
        persona: {
          name: finalName,
          description: finalDescription ?? providedDescription,
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
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    // TODO: This should be one call to the database worker

    // Refund the user credit
    if (!jobData.retry) {
      logger.info("Refunding user credit due to processing error", {
        userId: jobData.userId,
        creditsToRefund: 1,
        studyId: jobData.studyId,
      });
      await updateCredits(jobData.userId, 1, jobData.studyId);
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
