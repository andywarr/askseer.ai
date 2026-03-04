/**
 * Live Session AI Processing
 *
 * Dual-mode processing:
 * 1. Guide mode  — When the uploaded files are documents (PDFs, text), parse
 *    them to infer the research goal, questions, hypotheses, and discussion
 *    guide. Generate a study name and cover image. Triggered at study creation.
 * 2. Recording mode — When media files (audio/video) are present, delegate to
 *    the full qualitative-analysis pipeline for Whisper transcription and
 *    insight extraction. Triggered after a session is recorded.
 */

import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import OpenAI from "openai";
import { randomUUID } from "crypto";

import { logger } from "@/apps/shared/logger.ts";
import type { JobEnvelopeV2_LS } from "@/apps/shared/jobSchema.ts";

import { config } from "../config.ts";
import { openAiBreaker } from "../lib/circuitBreaker.ts";
import { withRetry } from "../lib/withRetry.ts";
import { uploadBufferToS3 } from "../lib/s3Client.ts";
import { getFiles, addQualitativeAnalysis } from "../lib/dbWorkerClient.ts";
import { handleProcessingError } from "../lib/errorHandler.ts";
import { buildInferencePrompt } from "../prompts/index.ts";
import {
  isMediaFile,
  buildFileContent,
  processQualitativeAnalysis,
  type QualitativeAnalysisResult,
} from "./qualitativeAnalysis.ts";
import { generatePersonaImage } from "./persona.ts";

// ── OpenAI client ──────────────────────────────────────────────────
const openai = new OpenAI();

// ── Schemas ────────────────────────────────────────────────────────

/** Extended inference schema that also produces hypotheses. */
const GuideInferenceSchema = z.object({
  inferredGoal: z.string().nullable(),
  inferredQuestions: z.array(z.string()).nullable(),
  inferredHypotheses: z.array(z.string()).nullable(),
  inferredGuide: z.string().nullable(),
});

const StudyNameSchema = z
  .object({
    name: z.string().min(2).max(80),
  })
  .strict();

// ── Main entry point ───────────────────────────────────────────────

/**
 * Main entry point for Live Session job processing.
 *
 * Inspects the uploaded files to determine the processing mode:
 * - If any media file is present → recording mode (full qual analysis)
 * - Otherwise → guide mode (inference + cover image)
 */
export async function processLiveSession(
  envelope: JobEnvelopeV2_LS,
): Promise<void> {
  const { studyId, userId } = envelope;

  logger.info("Starting Live Session processing", {
    studyId,
    userId,
    isRetry: envelope.retry || false,
  });

  try {
    // Fetch the actual file records from the database so we can inspect types.
    const dbFiles = await getFiles(studyId);

    if (!dbFiles || dbFiles.length === 0) {
      throw new Error("No files found for live session study");
    }

    const hasMedia = dbFiles.some(isMediaFile);

    if (hasMedia) {
      await processRecording(envelope);
    } else {
      await processGuide(envelope, dbFiles);
    }

    logger.info("Live Session processing completed successfully", {
      studyId,
      mode: hasMedia ? "recording" : "guide",
    });
  } catch (error) {
    await handleProcessingError(envelope, error, "live_session");
    throw error;
  }
}

// ── Recording mode ─────────────────────────────────────────────────

/**
 * Delegate to the full qualitative-analysis pipeline, mapping the
 * live-session envelope into a qual_analysis envelope.
 */
async function processRecording(envelope: JobEnvelopeV2_LS): Promise<void> {
  const { studyId, payload } = envelope;

  logger.info("Live Session — recording mode, delegating to qual analysis", {
    studyId,
  });

  const mappedEnvelope = {
    ...envelope,
    type: "qual_analysis" as const,
    payload: {
      name: payload.name || "Live Session Analysis",
      files: payload.files || [],
      contextFiles: payload.contextFiles || [],
      goal:
        payload.goal ||
        "Analyze the live session recording to extract key insights, pain points, and ideas.",
      researchQuestions: payload.researchQuestions,
      hypotheses: payload.hypotheses,
      discussionGuide: payload.discussionGuide,
      context: payload.context,
    },
  };

  await processQualitativeAnalysis(mappedEnvelope);
}

// ── Guide mode ─────────────────────────────────────────────────────

/**
 * Parse uploaded discussion-guide documents, run inference to extract
 * research context, generate a study name & cover image, and persist
 * the results so the study is ready for live sessions.
 */
async function processGuide(
  envelope: JobEnvelopeV2_LS,
  dbFiles: Awaited<ReturnType<typeof getFiles>>,
): Promise<void> {
  const { studyId, payload } = envelope;
  const startTime = Date.now();

  logger.info("Live Session — guide mode, processing discussion guide files", {
    studyId,
    fileCount: dbFiles.length,
  });

  // ── 1. Parse document files to text ──────────────────────────────
  const guideContent = await buildFileContent(dbFiles);

  if (guideContent.length === 0) {
    throw new Error(
      "Could not extract any text from the uploaded discussion guide files",
    );
  }

  const combinedText = guideContent.join("\n\n");

  logger.info("Discussion guide text extracted", {
    studyId,
    segments: guideContent.length,
    totalLength: combinedText.length,
  });

  // ── 2. Inference — goal, questions, hypotheses, guide summary ────
  let inferredGoal: string | undefined;
  let inferredQuestions: string[] | undefined;
  let inferredHypotheses: string[] | undefined;
  let inferredGuide: string | undefined;

  const inferencePrompt = buildInferencePrompt({
    goal: payload.goal,
    researchQuestions: payload.researchQuestions,
    hypotheses: payload.hypotheses,
    discussionGuide: payload.discussionGuide,
    context: payload.context ?? undefined,
  });

  const inferenceResponse = await openAiBreaker.execute(() =>
    withRetry(
      async () => {
        const response = await openai.responses.create({
          model: config.models.qualitativeAnalysis,
          reasoning: { effort: config.qualitativeAnalysis.reasoningEffort },
          stream: false,
          input: [
            { role: "system", content: inferencePrompt },
            { role: "user", content: combinedText },
          ],
          text: {
            format: zodTextFormat(GuideInferenceSchema, "guide_inference"),
          },
        });
        return response;
      },
      {
        maxAttempts: 3,
        operationName: `live-session-inference-${studyId}`,
      },
    ),
  );

  const inferenceText = inferenceResponse.output_text?.trim();
  if (inferenceText) {
    try {
      const parsed = JSON.parse(inferenceText) as z.infer<
        typeof GuideInferenceSchema
      >;
      inferredGoal = parsed.inferredGoal ?? undefined;
      inferredQuestions = parsed.inferredQuestions ?? undefined;
      inferredHypotheses = parsed.inferredHypotheses ?? undefined;
      inferredGuide = parsed.inferredGuide ?? undefined;

      logger.info("Guide inference completed", {
        studyId,
        hasInferredGoal: !!inferredGoal,
        inferredQuestionCount: inferredQuestions?.length || 0,
        inferredHypothesesCount: inferredHypotheses?.length || 0,
        hasInferredGuide: !!inferredGuide,
      });
    } catch (parseError) {
      logger.warn("Failed to parse guide inference response", {
        studyId,
        error: (parseError as Error).message,
      });
    }
  }

  // ── 3. Generate study name ───────────────────────────────────────
  let generatedStudyName: string | undefined;
  const providedName = payload.name?.trim();

  if (!providedName) {
    const effectiveGoal = payload.goal || inferredGoal;
    if (effectiveGoal) {
      try {
        logger.info("Generating study name from research goal", { studyId });
        const nameCompletion = await openAiBreaker.execute(() =>
          openai.responses.create({
            model: config.models.persona,
            input: [
              {
                role: "system" as const,
                content:
                  "You create concise, descriptive study names for UX research. Return only JSON matching the schema. The name should be short (2-6 words), descriptive, and capture the essence of the research goal. Do not use generic names like 'User Study' or 'Research Project'.",
              },
              {
                role: "user" as const,
                content: `Research goal: ${effectiveGoal}`,
              },
            ],
            text: {
              format: zodTextFormat(StudyNameSchema, "study_name"),
            },
            stream: false,
          }),
        );

        const nameContent = nameCompletion.output_text?.trim();
        if (nameContent) {
          const nameParsed = StudyNameSchema.parse(JSON.parse(nameContent));
          generatedStudyName = nameParsed.name;
          logger.info("Generated study name", {
            studyId,
            generatedStudyName,
          });
        }
      } catch (e) {
        logger.warn("Failed to generate study name, continuing without", {
          studyId,
          error: (e as Error).message,
        });
      }
    }
  }

  // ── 4. Generate cover image ──────────────────────────────────────
  let coverImageKey: string | undefined;

  try {
    const effectiveGoal = payload.goal || inferredGoal || "";
    const coverPromptParts = [
      "Abstract, modern cover image for a qualitative research study. Clean, minimalist, professional.",
      effectiveGoal ? `Research theme: ${effectiveGoal}` : undefined,
      inferredQuestions && inferredQuestions.length > 0
        ? `Key topics: ${inferredQuestions.slice(0, 3).join(", ")}`
        : undefined,
      generatedStudyName
        ? `Study title hint: ${generatedStudyName}`
        : undefined,
      "no text, no people, 16:9 composition, soft lighting, high resolution, muted colors, editorial style",
    ];
    const coverPrompt = coverPromptParts.filter(Boolean).join(". ");

    logger.info("Generating cover image for live session study", { studyId });
    const { buffer, contentType } = await generatePersonaImage(
      coverPrompt,
      "1024x1024",
    );
    const teamId = envelope.teamId || envelope.userId;
    const key = `studies/${teamId}/${studyId}/analysis/cover-${randomUUID()}.png`;
    coverImageKey = await uploadBufferToS3({ buffer, key, contentType });
    logger.info("Cover image generated and uploaded", {
      studyId,
      key: coverImageKey,
    });
  } catch (e) {
    logger.warn("Failed to generate cover image, continuing without", {
      studyId,
      error: (e as Error).message,
    });
  }

  // ── 5. Persist results ───────────────────────────────────────────
  const result: QualitativeAnalysisResult = {
    summary: "Discussion guide processed. Study is ready for live sessions.",
    inferredGoal,
    inferredQuestions,
    inferredGuide,
    studyName: generatedStudyName,
    coverImageKey,
    insights: [], // No insights yet — those come from recording processing
  };

  await addQualitativeAnalysis(envelope, result);

  const duration = Date.now() - startTime;
  logger.info("Guide processing completed", {
    studyId,
    duration,
    hasGoal: !!inferredGoal,
    hasQuestions: !!(inferredQuestions && inferredQuestions.length),
    hasCover: !!coverImageKey,
    hasStudyName: !!generatedStudyName,
  });
}
