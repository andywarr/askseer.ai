/**
 * Live Session AI Processing
 *
 * Dual-mode processing:
 * 1. Guide mode  — When the uploaded files are documents (PDFs, text), parse
 *    them to infer the research goal, questions, hypotheses, and discussion
 *    guide. Generate a study name and cover image. Triggered at study creation.
 * 2. Recording mode — When media files (audio/video) are present, transcribe
 *    them via Whisper and save the transcript to the LiveSession record.
 *    The full qualitative-analysis pipeline is NOT run here — it is triggered
 *    separately when the user presses "Run Analysis" (queues a qual_analysis job).
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
import { getPresignedUrl, uploadBufferToS3 } from "../lib/s3Client.ts";
import {
  getFiles,
  addQualitativeAnalysis,
  updateFileTranscript,
  saveLiveSessionTranscript,
} from "../lib/dbWorkerClient.ts";
import { handleProcessingError } from "../lib/errorHandler.ts";
import { buildInferencePrompt } from "../prompts/index.ts";
import {
  isMediaFile,
  buildFileContent,
  transcribeFile,
  transcribeLargeFile,
  extractAudioFromVideo,
  needsAudioExtraction,
  WHISPER_SUPPORTED_EXTENSIONS,
  WHISPER_MAX_BYTES,
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
 * Transcribe the live-session recording via Whisper and save the
 * transcript to both the File record and the LiveSession record.
 *
 * Does NOT run the full qualitative-analysis pipeline — that only
 * happens when the user explicitly presses "Run Analysis", which
 * queues a separate `qual_analysis` job via `runLiveStudyAnalysis`.
 */
async function processRecording(envelope: JobEnvelopeV2_LS): Promise<void> {
  const { studyId, payload } = envelope;
  const liveSessionId = payload.liveSessionId;

  logger.info("Live Session — recording mode, transcribing recording", {
    studyId,
    liveSessionId,
  });

  // Fetch file records to find the media file
  const dbFiles = await getFiles(studyId);
  const mediaFile = dbFiles.find(isMediaFile);

  if (!mediaFile) {
    throw new Error("No media file found for live session recording");
  }

  const name = (mediaFile.originalName || "").toLowerCase();
  const canWhisper = WHISPER_SUPPORTED_EXTENSIONS.test(name);

  if (!canWhisper) {
    logger.warn("Recording format not supported for Whisper transcription", {
      studyId,
      fileName: mediaFile.originalName,
    });
    return;
  }

  // Download from S3
  const presignedUrl = await getPresignedUrl(mediaFile.key || "");
  const response = await fetch(presignedUrl);
  let buffer = Buffer.from(await response.arrayBuffer());
  let whisperFileName = mediaFile.originalName || "recording.mp3";

  // Extract audio from video if needed (converts to small mp3)
  if (needsAudioExtraction(name)) {
    logger.info("Extracting audio from video file", {
      studyId,
      fileName: mediaFile.originalName,
      videoBytes: buffer.byteLength,
    });
    buffer = Buffer.from(
      await extractAudioFromVideo(
        buffer,
        mediaFile.originalName || "video.mov",
      ),
    );
    whisperFileName = whisperFileName.replace(/\.[^.]+$/, ".mp3");
  }

  // Transcribe via Whisper (chunked if >25 MB)
  let transcript: string;

  if (buffer.byteLength > WHISPER_MAX_BYTES) {
    logger.info(
      "File exceeds Whisper 25 MB limit, using chunked transcription",
      {
        studyId,
        sizeBytes: buffer.byteLength,
      },
    );
    transcript = await transcribeLargeFile(buffer, whisperFileName);
  } else {
    logger.info("Transcribing recording via Whisper", {
      studyId,
      sizeBytes: buffer.byteLength,
    });
    transcript = await transcribeFile(buffer, whisperFileName);
  }

  if (!transcript) {
    logger.warn("Whisper produced no transcript for recording", { studyId });
    return;
  }

  logger.info("Transcription complete", {
    studyId,
    transcriptLength: transcript.length,
  });

  // Cache transcript on the File record for future qual_analysis runs
  await updateFileTranscript(mediaFile.id, transcript).catch((err) =>
    logger.warn("Failed to cache transcript on File record", {
      fileId: mediaFile.id,
      error: (err as Error).message,
    }),
  );

  // Save transcript to the LiveSession record (also sets status → COMPLETED)
  if (liveSessionId) {
    // Upload transcript text to S3 for reference
    const teamId = envelope.teamId || envelope.userId;
    const transcriptKey = `studies/${teamId}/${studyId}/transcripts/${liveSessionId}.txt`;
    const transcriptUrl = await uploadBufferToS3({
      buffer: Buffer.from(transcript, "utf-8"),
      key: transcriptKey,
      contentType: "text/plain",
    });

    await saveLiveSessionTranscript(liveSessionId, transcriptUrl, transcript);

    logger.info("Transcript saved to LiveSession", {
      studyId,
      liveSessionId,
      transcriptUrl,
    });
  } else {
    logger.warn(
      "No liveSessionId in envelope — transcript cached on File only",
      { studyId },
    );
  }
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
