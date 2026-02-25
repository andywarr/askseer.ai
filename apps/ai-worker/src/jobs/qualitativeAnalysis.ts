/**
 * Qualitative Analysis Processing
 *
 * Processes interview data (audio, video, transcripts) to extract structured insights.
 * Audio and video files are first transcribed via OpenAI Whisper with segment-level
 * timestamps, producing text like "[00:12:34] I couldn't find the button..."
 * Uses a two-phase approach:
 * 1. Inference phase: Infer missing research context (goal, questions, guide)
 * 2. Analysis phase: Extract key insights with the three-pillar framework
 */

// OpenAI imports
import OpenAI, { toFile } from "openai";
import { zodTextFormat } from "openai/helpers/zod";

// Zod imports
import { z } from "zod";

// Node imports
import { randomUUID } from "crypto";
import { execFile } from "child_process";
import { writeFile, unlink, readFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { promisify } from "util";
import { createRequire } from "module";

const execFileAsync = promisify(execFile);

// Import from shared modules
import { logger } from "@/apps/shared/logger.ts";
import type { JobEnvelopeV2_AN } from "@/apps/shared/jobSchema.ts";

// Import from local modules
import { config } from "../config.ts";
import { getPresignedUrl, uploadBufferToS3 } from "../lib/s3Client.ts";
import {
  getFiles,
  addQualitativeAnalysis,
  updateFileTranscript,
  updateFileIdentifier,
} from "../lib/dbWorkerClient.ts";
import { handleProcessingError } from "../lib/errorHandler.ts";
import { withRetry } from "../lib/withRetry.ts";
import { openAiBreaker } from "../lib/circuitBreaker.ts";
import { generatePersonaImage } from "./persona.ts";
import {
  buildInferencePrompt,
  buildAnalysisPrompt,
  buildCodebookPrompt,
  buildConsolidationPrompt,
} from "../prompts/index.ts";
import { PDFParse } from "pdf-parse";
import type { File } from "../types.ts";

// ============================================================================
// Schemas for OpenAI structured output
// ============================================================================

const InferenceResultSchema = z.object({
  inferredGoal: z.string().nullable(),
  inferredQuestions: z.array(z.string()).nullable(),
  inferredGuide: z.string().nullable(),
});

const AnalysisQuoteSchema = z.object({
  quote: z.string(),
  participant: z.string().nullable(),
  timestamp: z.string().nullable(),
});

const AnalysisInsightSchema = z.object({
  title: z.string(),
  observation: z.string(),
  motivation: z.string(),
  implication: z.string(),
  insightStatement: z.string(),
  theme: z.string().nullable(),
  severity: z.number().int().min(1).max(5).nullable(),
  participantCount: z.number().int().nullable(),
  quotes: z.array(AnalysisQuoteSchema),
  tags: z.array(z.string()),
});

const AnalysisResultSchema = z.object({
  summary: z.string(),
  insights: z.array(AnalysisInsightSchema),
});

const CodebookThemeSchema = z.object({
  name: z.string(),
  definition: z.string(),
  codes: z.array(z.string()),
});

const CodebookSchema = z.object({
  themes: z.array(CodebookThemeSchema),
});

const FileIdentifierSchema = z.object({
  identifiers: z.array(
    z.object({
      fileName: z.string(),
      identifier: z.string().nullable(),
    }),
  ),
});

// Initialize OpenAI
const openai = new OpenAI();

// ============================================================================
// Types
// ============================================================================

export interface QualitativeAnalysisResult {
  summary: string;
  inferredGoal?: string;
  inferredQuestions?: string[];
  inferredGuide?: string;
  studyName?: string;
  coverImageKey?: string;
  insights: Array<{
    title: string;
    observation: string;
    motivation: string;
    implication: string;
    insightStatement: string;
    theme?: string;
    severity?: number;
    participantCount?: number;
    quotes: Array<{
      quote: string;
      participant?: string;
      sourceFileId?: string;
      timestamp?: string;
    }>;
    tags: string[];
  }>;
}

// Schema for generating a short study name from research context
const StudyNameSchema = z
  .object({
    name: z.string().min(2).max(80),
  })
  .strict();

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Determine if a file is an interview file (audio/video/transcript)
 * vs a context file (research plan, discussion guide doc)
 */
function isInterviewFile(file: File): boolean {
  const fileType = (file.fileType || "").toUpperCase();
  const name = (file.originalName || "").toLowerCase();

  // Audio files (Prisma FileType enum)
  if (fileType === "AUDIO") return true;
  if (name.match(/\.(mp3|wav|m4a|aac|ogg|flac|wma)$/)) return true;

  // Video files (Prisma FileType enum)
  if (fileType === "VIDEO") return true;
  if (name.match(/\.(mp4|webm|mov|avi|mkv|m4v)$/)) return true;

  // Transcript files (text-based)
  if (name.match(/\.(txt|vtt|srt)$/)) return true;
  if (fileType === "DOCUMENT" && name.match(/\.(txt|vtt|srt)$/)) return true;

  return false;
}

// Whisper-supported file extensions for transcription
const WHISPER_SUPPORTED_EXTENSIONS = /\.(mp3|mp4|mpeg|mpga|m4a|wav|webm|mov)$/i;
// Maximum file size for Whisper API (25 MB)
const WHISPER_MAX_BYTES = 25 * 1024 * 1024;

/**
 * Format seconds into a human-readable timestamp (HH:MM:SS)
 */
function formatTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * Video file extensions that require audio extraction via ffmpeg before Whisper.
 */
const VIDEO_EXTENSIONS = /\.(mov|mp4|avi|mkv|m4v|webm|mpeg)$/i;

/**
 * Check if a file needs audio extraction via ffmpeg before Whisper can process it.
 */
function needsAudioExtraction(fileName: string): boolean {
  return VIDEO_EXTENSIONS.test(fileName);
}

// Path to the ffmpeg binary provided by ffmpeg-static
let ffmpegPath: string | null = null;
try {
  const esmRequire = createRequire(import.meta.url);
  ffmpegPath = esmRequire("ffmpeg-static") as string;
  logger.info("ffmpeg-static loaded", { ffmpegPath });
} catch {
  logger.warn("ffmpeg-static not available, video transcription will be limited");
}

/**
 * Extract audio track from a video file using ffmpeg.
 * Converts to mp3 mono 16kHz (optimal for Whisper) which dramatically reduces file size.
 * Returns the extracted audio as a Buffer.
 */
async function extractAudioFromVideo(videoBuffer: Buffer, fileName: string): Promise<Buffer> {
  if (!ffmpegPath) {
    throw new Error("ffmpeg is not available for audio extraction");
  }

  const id = randomUUID();
  const ext = fileName.split(".").pop() || "mov";
  const inputPath = join(tmpdir(), `whisper-input-${id}.${ext}`);
  const outputPath = join(tmpdir(), `whisper-output-${id}.mp3`);

  try {
    // Write video buffer to temp file
    await writeFile(inputPath, videoBuffer);

    // Extract audio as mono 16kHz mp3 (optimal for Whisper, very small file size)
    await execFileAsync(ffmpegPath, [
      "-i", inputPath,
      "-vn",              // no video
      "-ac", "1",         // mono
      "-ar", "16000",     // 16kHz sample rate
      "-b:a", "48k",      // 48kbps bitrate (good enough for speech)
      "-f", "mp3",        // output format
      "-y",               // overwrite
      outputPath,
    ], { timeout: 120_000 }); // 2 minute timeout

    const audioBuffer = Buffer.from(await readFile(outputPath));

    logger.info("Audio extracted from video", {
      fileName,
      videoBytes: videoBuffer.byteLength,
      audioBytes: audioBuffer.byteLength,
      compressionRatio: (videoBuffer.byteLength / audioBuffer.byteLength).toFixed(1),
    });

    return audioBuffer;
  } finally {
    // Clean up temp files
    await unlink(inputPath).catch(() => {});
    await unlink(outputPath).catch(() => {});
  }
}

/**
 * Transcribe an audio or video file using OpenAI Whisper.
 * Returns a timestamped transcript string, e.g.:
 *   [00:00:00] Hello, welcome to our interview.
 *   [00:05:42] So tell me about your experience with...
 */
async function transcribeFile(
  fileBuffer: Buffer,
  fileName: string,
): Promise<string> {
  const file = await toFile(fileBuffer, fileName);

  const transcription = await withRetry(
    async () => {
      const result = await openai.audio.transcriptions.create({
        file,
        model: "whisper-1",
        response_format: "verbose_json",
        timestamp_granularities: ["segment"],
      });
      return result;
    },
    {
      maxAttempts: 2,
      operationName: `whisper-transcribe-${fileName}`,
    },
  );

  // Format segments with timestamps
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const segments = (transcription as any).segments as
    | Array<{ start: number; end: number; text: string }>
    | undefined;

  if (segments && segments.length > 0) {
    return segments
      .map((seg) => `[${formatTimestamp(seg.start)}] ${seg.text.trim()}`)
      .join("\n");
  }

  // Fallback: return plain text if segments aren't available
  return transcription.text || "";
}

/**
 * Target chunk size for splitting large files (20 MB, under the 25 MB Whisper limit)
 */
const CHUNK_TARGET_BYTES = 20 * 1024 * 1024;

/**
 * Transcribe a large audio/video file by splitting into byte-sized chunks,
 * transcribing each via Whisper, and concatenating with adjusted timestamps.
 *
 * Splitting compressed audio at byte boundaries may cause minor artifacts at
 * chunk edges, but Whisper is robust enough to handle this for transcription.
 */
async function transcribeLargeFile(
  buffer: Buffer,
  fileName: string,
): Promise<string> {
  const totalBytes = buffer.byteLength;
  const chunkCount = Math.ceil(totalBytes / CHUNK_TARGET_BYTES);

  logger.info("Splitting large file for chunked transcription", {
    fileName,
    totalBytes,
    chunkCount,
  });

  const allSegments: Array<{ timestamp: string; text: string }> = [];
  let cumulativeDurationSec = 0;

  for (let i = 0; i < chunkCount; i++) {
    const start = i * CHUNK_TARGET_BYTES;
    const end = Math.min(start + CHUNK_TARGET_BYTES, totalBytes);
    const chunk = buffer.subarray(start, end);

    logger.info(`Transcribing chunk ${i + 1}/${chunkCount}`, {
      fileName,
      chunkBytes: chunk.byteLength,
    });

    try {
      const ext = fileName.split(".").pop() || "mp3";
      const chunkFileName = `chunk_${i}.${ext}`;
      const file = await toFile(chunk, chunkFileName);

      const transcription = await withRetry(
        async () => {
          const result = await openai.audio.transcriptions.create({
            file,
            model: "whisper-1",
            response_format: "verbose_json",
            timestamp_granularities: ["segment"],
          });
          return result;
        },
        {
          maxAttempts: 2,
          operationName: `whisper-chunk-${fileName}-${i}`,
        },
      );

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const segments = (transcription as any).segments as
        | Array<{ start: number; end: number; text: string }>
        | undefined;

      if (segments && segments.length > 0) {
        // Offset timestamps by the cumulative duration of prior chunks
        for (const seg of segments) {
          allSegments.push({
            timestamp: formatTimestamp(seg.start + cumulativeDurationSec),
            text: seg.text.trim(),
          });
        }
        // Use the last segment's end time to estimate this chunk's duration
        cumulativeDurationSec += segments[segments.length - 1].end;
      } else if (transcription.text) {
        // No segments — add as a single block with cumulative offset
        allSegments.push({
          timestamp: formatTimestamp(cumulativeDurationSec),
          text: transcription.text.trim(),
        });
        // Estimate ~1 second per 15 words for duration offset
        const wordCount = transcription.text.split(/\s+/).length;
        cumulativeDurationSec += Math.max(wordCount / 2.5, 10);
      }
    } catch (error) {
      logger.warn(`Failed to transcribe chunk ${i + 1}/${chunkCount}`, {
        fileName,
        error: (error as Error).message,
      });
      // Continue with remaining chunks
    }
  }

  if (allSegments.length === 0) {
    return "";
  }

  return allSegments.map((s) => `[${s.timestamp}] ${s.text}`).join("\n");
}

/**
 * Check if a file is an audio/video file that should be transcribed
 */
function isMediaFile(file: File): boolean {
  const fileType = (file.fileType || "").toUpperCase();
  const name = (file.originalName || "").toLowerCase();
  return (
    fileType === "AUDIO" ||
    fileType === "VIDEO" ||
    !!name.match(
      /\.(mp3|mp4|mpeg|mpga|m4a|wav|webm|mov|avi|mkv|m4v|aac|ogg|flac|wma)$/,
    )
  );
}

/**
 * Build text content from interview files for analysis.
 *
 * Audio and video files are transcribed via Whisper to produce timestamped
 * transcripts. Text/transcript files are included directly. All content
 * is returned as text strings ready for the analysis LLM.
 */
async function buildFileContent(files: File[]): Promise<string[]> {
  const content: string[] = [];
  const CONCURRENCY_LIMIT = 3;

  for (let i = 0; i < files.length; i += CONCURRENCY_LIMIT) {
    const chunk = files.slice(i, i + CONCURRENCY_LIMIT);
    const chunkResults = await Promise.all(
      chunk.map(async (file) => {
        // Use cached transcript if available
    if (file.transcript) {
      logger.info("Using cached transcript", {
        fileName: file.originalName,
          transcriptLength: file.transcript.length,
        });
        const label = isMediaFile(file) ? "Transcription" : "Transcript/Document";
        return `--- ${label}: ${file.originalName} ---\n${file.transcript}\n--- End of ${file.originalName} ---`;
      }

      const presignedUrl = await getPresignedUrl(file.key || "");
    const name = (file.originalName || "").toLowerCase();

    if (isMediaFile(file)) {
      // Transcribe audio/video via Whisper
      const canWhisper = WHISPER_SUPPORTED_EXTENSIONS.test(name);

      if (!canWhisper) {
        logger.warn("Unsupported format for Whisper transcription, skipping", {
          fileName: file.originalName,
        });
        return `[Media file: ${file.originalName} — format not supported for automatic transcription. Supported formats: mp3, mp4, mpeg, mpga, m4a, wav, webm]`;
      }

      try {
        // Fetch the file from S3
        const response = await fetch(presignedUrl);
        let buffer = Buffer.from(await response.arrayBuffer());
        let whisperFileName = file.originalName || "audio.mp3";

        // Extract audio from video files using ffmpeg
        if (needsAudioExtraction(name)) {
          try {
            logger.info("Extracting audio from video file", {
              fileName: file.originalName,
              videoBytes: buffer.byteLength,
            });
            buffer = Buffer.from(await extractAudioFromVideo(buffer, file.originalName || "video.mov"));
            whisperFileName = whisperFileName.replace(/\.[^.]+$/, ".mp3");
          } catch (extractError) {
            logger.error("Failed to extract audio from video", {
              fileName: file.originalName,
              error: (extractError as Error).message,
            });
            return `[Media file: ${file.originalName} — could not extract audio: ${(extractError as Error).message}. Please provide a pre-made transcript or convert to mp3.]`;
          }
        }

        if (buffer.byteLength > WHISPER_MAX_BYTES) {
          logger.info(
            "File exceeds Whisper 25 MB limit, using chunked transcription",
            {
              fileName: file.originalName,
              sizeBytes: buffer.byteLength,
            },
          );

          const transcript = await transcribeLargeFile(
            buffer,
            whisperFileName,
          );

          if (transcript) {
            content.push(
              `--- Transcription: ${file.originalName} ---\n${transcript}\n--- End of ${file.originalName} ---`,
            );

            logger.info("Chunked transcription complete", {
              fileName: file.originalName,
              transcriptLength: transcript.length,
            });

            // Cache the transcript for future runs
            updateFileTranscript(file.id, transcript).catch((err) =>
              logger.warn("Failed to cache transcript", {
                fileId: file.id,
                error: (err as Error).message,
              }),
            );
            
            return `--- Transcription: ${file.originalName} ---\n${transcript}\n--- End of ${file.originalName} ---`;
          } else {
            return `[Media file: ${file.originalName} — chunked transcription produced no output. Please provide a pre-made transcript for best results.]`;
          }
        }

        logger.info("Transcribing media file via Whisper", {
          fileName: file.originalName,
          sizeBytes: buffer.byteLength,
        });

        const transcript = await transcribeFile(
          buffer,
          whisperFileName,
        );

        content.push(
          `--- Transcription: ${file.originalName} ---\n${transcript}\n--- End of ${file.originalName} ---`,
        );

        logger.info("Whisper transcription complete", {
          fileName: file.originalName,
          transcriptLength: transcript.length,
        });

          // Cache the transcript for future runs
          updateFileTranscript(file.id, transcript).catch((err) =>
            logger.warn("Failed to cache transcript", {
              fileId: file.id,
              error: (err as Error).message,
            }),
          );
          
          return `--- Transcription: ${file.originalName} ---\n${transcript}\n--- End of ${file.originalName} ---`;
        } catch (error) {
          logger.error("Failed to transcribe media file", {
            fileName: file.originalName,
            error: (error as Error).message,
          });
          return `[Media file: ${file.originalName} — transcription failed: ${(error as Error).message}]`;
        }
      } else {
      // For text/transcript/document files, fetch and include as text
      try {
        const response = await fetch(presignedUrl);
        const isPdf =
          name.endsWith(".pdf") ||
          ((file.fileType || "").toUpperCase() === "DOCUMENT" &&
            name.endsWith(".pdf"));

        let text: string;
        if (isPdf) {
          // Parse PDF to extract readable text using pdf-parse v2 class API
          const buffer = Buffer.from(await response.arrayBuffer());
          const pdf = new PDFParse({ data: new Uint8Array(buffer) });
          const pdfData = await pdf.getText();
          text = pdfData.text;
          logger.info("PDF text extracted", {
            fileName: file.originalName,
            pages: pdfData.total,
            textLength: text.length,
          });
          await pdf.destroy();
        } else {
          text = await response.text();
        }

        if (!text || text.trim().length === 0) {
          logger.warn("File produced no readable text", {
            fileName: file.originalName,
          });
          return `[Document: ${file.originalName} — no readable text could be extracted]`;
        }

        // Cache extracted text for future runs (PDFs and other documents)
        updateFileTranscript(file.id, text).catch((err) =>
          logger.warn("Failed to cache extracted text", {
            fileId: file.id,
            error: (err as Error).message,
          }),
        );
        return `--- Transcript/Document: ${file.originalName} ---\n${text}\n--- End of ${file.originalName} ---`;
      } catch (error) {
        logger.warn("Failed to fetch/parse file", {
          fileName: file.originalName,
          error: (error as Error).message,
        });
        return `[Document: ${file.originalName} — could not be loaded: ${(error as Error).message}]`;
      }
    }
  }));
  
  content.push(...chunkResults);
  }

  return content.filter(Boolean) as string[];
}

// ============================================================================
// Main Processing Function
// ============================================================================

/**
 * Process a qualitative analysis job
 */
export async function processQualitativeAnalysis(
  jobData: JobEnvelopeV2_AN,
): Promise<void> {
  const { studyId, payload } = jobData;
  const startTime = Date.now();

  logger.info("Starting qualitative analysis processing", {
    studyId,
    hasGoal: !!payload.goal,
    hasQuestions: !!(
      payload.researchQuestions && payload.researchQuestions.length > 0
    ),
    hasGuide: !!payload.discussionGuide,
    hasContext: !!payload.context,
  });

  try {
    // Get files from the database
    const dbFiles = await getFiles(studyId);
    if (!dbFiles || dbFiles.length === 0) {
      throw new Error("No files found for analysis");
    }

    // Use the payload's file/contextFile keys to partition DB records correctly.
    // The form tracks interview vs context files separately, so we trust that.
    const interviewKeys = new Set(
      (payload.files || []).map((f: { key: string }) => f.key),
    );
    const contextKeys = new Set(
      (payload.contextFiles || []).map((f: { key: string }) => f.key),
    );

    let interviewFiles: File[];
    let contextFiles: File[];

    if (interviewKeys.size > 0 || contextKeys.size > 0) {
      // Payload has file keys — use them to partition
      interviewFiles = dbFiles.filter((f) => f.key && interviewKeys.has(f.key));
      contextFiles = dbFiles.filter((f) => f.key && contextKeys.has(f.key));
    } else {
      // Fallback for older jobs without payload file keys: guess by file type
      interviewFiles = dbFiles.filter(isInterviewFile);
      contextFiles = dbFiles.filter((f) => !isInterviewFile(f));
    }

    logger.info("Files categorized for analysis", {
      studyId,
      totalFiles: dbFiles.length,
      interviewFiles: interviewFiles.length,
      contextFiles: contextFiles.length,
    });

    if (interviewFiles.length === 0) {
      throw new Error(
        "No interview files (audio, video, or transcripts) found. " +
          "Please upload at least one interview recording or transcript.",
      );
    }

    // Build file content for OpenAI (audio/video files are transcribed via Whisper)
    const interviewContent = await buildFileContent(interviewFiles);
    const contextContent = await buildFileContent(contextFiles);

    // Verify that at least some real content was extracted (not just error placeholders)
    const hasRealContent = interviewContent.some(
      (c) => c.startsWith("---"),
    );
    if (!hasRealContent) {
      throw new Error(
        "Could not extract any usable transcript from the uploaded files. " +
          "Please upload files in a supported format (mp3, mp4, m4a, wav, webm, mov) " +
          "or provide pre-made transcripts (.txt, .vtt, .srt, .pdf, .doc).",
      );
    }

    // ========================================
    // Extract participant identifiers per file
    // ========================================
    // Only extract for files that don't already have an identifier
    const filesNeedingIdentifier = interviewFiles.filter((f) => !f.identifier);
    if (filesNeedingIdentifier.length > 0 && interviewContent.length > 0) {
      logger.info("Extracting participant identifiers from transcripts", {
        studyId,
        fileCount: filesNeedingIdentifier.length,
      });

      try {
        const fileNames = filesNeedingIdentifier.map(
          (f) => f.originalName || "unknown",
        );
        const identifierPrompt = `You are a research assistant. For each interview transcript below, extract the participant identifier — how the interviewee is referred to in the transcript (e.g., "P1", "Participant 3", "Sarah", "User A", "Interviewee 1").

Look for:
- How the interviewer addresses the participant
- Any self-identification by the participant
- Labels or codes used in the transcript headers

If the transcript contains no clear participant identifier, use the file name to create a short label (e.g., "Interview 1" for "interview_1.mp3").

Return one identifier per file. Keep identifiers short and consistent.

Files to identify: ${fileNames.join(", ")}`;

        const identifierResponse = await openAiBreaker.execute(() =>
          withRetry(
            async () => {
              const response = await openai.responses.create({
                model: config.models.qualitativeAnalysis,
                reasoning: { effort: config.qualitativeAnalysis.reasoningEffort },
                stream: false,
                input: [
                  { role: "system", content: identifierPrompt },
                  { role: "user", content: interviewContent.join("\n\n") },
                ],
                text: {
                  format: zodTextFormat(FileIdentifierSchema, "identifiers"),
                },
              });
              return response;
            },
            {
              maxAttempts: 2,
              operationName: `identifier-extraction-${studyId}`,
            },
          ),
        );

        const identText = identifierResponse.output_text?.trim();
        if (identText) {
          try {
            const identParsed = JSON.parse(identText) as z.infer<
              typeof FileIdentifierSchema
            >;

            // Save identifiers to the database
            for (const item of identParsed.identifiers) {
              const matchingFile = filesNeedingIdentifier.find(
                (f) =>
                  (f.originalName || "").toLowerCase() ===
                  item.fileName.toLowerCase(),
              );
              if (matchingFile && item.identifier) {
                updateFileIdentifier(matchingFile.id, item.identifier).catch(
                  (err) =>
                    logger.warn("Failed to save file identifier", {
                      fileId: matchingFile.id,
                      error: (err as Error).message,
                    }),
                );
                // Also update the local file object for downstream use
                matchingFile.identifier = item.identifier;
              }
            }

            logger.info("Participant identifiers extracted", {
              studyId,
              identifiers: identParsed.identifiers.map((i) => ({
                fileName: i.fileName,
                identifier: i.identifier,
              })),
            });
          } catch (parseErr) {
            logger.warn("Failed to parse identifier extraction response", {
              studyId,
              error: (parseErr as Error).message,
            });
          }
        }
      } catch (error) {
        logger.warn("Identifier extraction failed, continuing without", {
          studyId,
          error: (error as Error).message,
        });
      }
    }

    // ========================================
    // Phase 1: Inference (if needed)
    // ========================================
    let inferredGoal: string | undefined;
    let inferredQuestions: string[] | undefined;
    let inferredGuide: string | undefined;

    const needsInference =
      !payload.goal ||
      !payload.researchQuestions ||
      payload.researchQuestions.length === 0 ||
      !payload.discussionGuide;

    if (needsInference) {
      logger.info("Running inference phase", { studyId });

      const inferencePrompt = buildInferencePrompt({
        goal: payload.goal,
        researchQuestions: payload.researchQuestions,
        hypotheses: payload.hypotheses,
        discussionGuide: payload.discussionGuide,
        context: payload.context ?? undefined,
      });

      // Build user content from transcribed interview text
      const inferenceUserContent = interviewContent.join("\n\n");

      const contextText = contextContent.join("\n\n");

      const fullInferenceInput = contextText
        ? `${inferenceUserContent}\n\n--- Additional Context Documents ---\n${contextText}`
        : inferenceUserContent;

      const inferenceResponse = await openAiBreaker.execute(() =>
        withRetry(
          async () => {
            const response = await openai.responses.create({
              model: config.models.qualitativeAnalysis,
              reasoning: { effort: config.qualitativeAnalysis.reasoningEffort },
              stream: false,
              input: [
                { role: "system", content: inferencePrompt },
                { role: "user", content: fullInferenceInput },
              ],
              text: {
                format: zodTextFormat(InferenceResultSchema, "inference"),
              },
            });
            return response;
          },
          {
            maxAttempts: 3,
            operationName: `inference-${studyId}`,
          },
        ),
      );

      const inferenceText = inferenceResponse.output_text?.trim();
      if (inferenceText) {
        try {
          const parsed = JSON.parse(inferenceText) as z.infer<
            typeof InferenceResultSchema
          >;
          inferredGoal = parsed.inferredGoal ?? undefined;
          inferredQuestions = parsed.inferredQuestions ?? undefined;
          inferredGuide = parsed.inferredGuide ?? undefined;

          logger.info("Inference phase completed", {
            studyId,
            hasInferredGoal: !!inferredGoal,
            inferredQuestionCount: inferredQuestions?.length || 0,
            hasInferredGuide: !!inferredGuide,
          });
        } catch (parseError) {
          logger.warn("Failed to parse inference response", {
            studyId,
            error: (parseError as Error).message,
          });
        }
      }
    }

    // ========================================
    // Generate study name (if not provided)
    // ========================================
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

    // ========================================
    // Phase 0: Codebook Generation
    // ========================================
    logger.info("Running codebook generation phase", { studyId });

    const codebookPrompt = buildCodebookPrompt({
      goal: payload.goal,
      researchQuestions: payload.researchQuestions,
      context: payload.context ?? undefined,
      inferredGoal,
      inferredQuestions,
    });

    const codebookUserContent = interviewContent.join("\n\n");
    const codebookContextText = contextContent.join("\n\n");
    const fullCodebookInput = codebookContextText
      ? `${codebookUserContent}\n\n--- Additional Context Documents ---\n${codebookContextText}`
      : codebookUserContent;

    let codebook: z.infer<typeof CodebookSchema> | undefined;

    try {
      const codebookResponse = await openAiBreaker.execute(() =>
        withRetry(
          async () => {
            const response = await openai.responses.create({
              model: config.models.qualitativeAnalysis,
              reasoning: { effort: config.qualitativeAnalysis.reasoningEffort },
              stream: false,
              input: [
                { role: "system", content: codebookPrompt },
                { role: "user", content: fullCodebookInput },
              ],
              text: {
                format: zodTextFormat(CodebookSchema, "codebook"),
              },
            });
            return response;
          },
          {
            maxAttempts: 3,
            operationName: `codebook-${studyId}`,
          },
        ),
      );

      const codebookText = codebookResponse.output_text?.trim();
      if (codebookText) {
        try {
          codebook = JSON.parse(codebookText) as z.infer<typeof CodebookSchema>;
          logger.info("Codebook generated", {
            studyId,
            themeCount: codebook.themes.length,
            themes: codebook.themes.map((t) => t.name),
          });
        } catch (parseError) {
          logger.warn("Failed to parse codebook response, proceeding without", {
            studyId,
            error: (parseError as Error).message,
          });
        }
      }
    } catch (error) {
      logger.warn("Codebook generation failed, proceeding without", {
        studyId,
        error: (error as Error).message,
      });
    }

    // ========================================
    // Phase 2: Main Analysis (Ensemble)
    // ========================================
    const ensembleRuns = config.qualitativeAnalysis.ensembleRuns;
    logger.info("Running analysis phase", { studyId, ensembleRuns });

    const analysisPrompt = buildAnalysisPrompt({
      goal: payload.goal,
      researchQuestions: payload.researchQuestions,
      hypotheses: payload.hypotheses,
      discussionGuide: payload.discussionGuide,
      context: payload.context ?? undefined,
      inferredGoal,
      inferredQuestions,
      inferredGuide,
      participantCount: interviewFiles.length,
      codebook: codebook?.themes,
    });

    // Build user content from transcribed interview text
    const analysisUserContent = interviewContent.join("\n\n");

    const analysisContextText = contextContent.join("\n\n");

    const fullAnalysisInput = analysisContextText
      ? `${analysisUserContent}\n\n--- Additional Context Documents ---\n${analysisContextText}`
      : analysisUserContent;

    // Run N analysis calls in parallel for ensemble
    const analysisPromises = Array.from({ length: ensembleRuns }, (_, i) =>
      openAiBreaker.execute(() =>
        withRetry(
          async () => {
            const response = await openai.responses.create({
              model: config.models.qualitativeAnalysis,
              reasoning: { effort: config.qualitativeAnalysis.reasoningEffort },
              stream: false,
              input: [
                { role: "system", content: analysisPrompt },
                { role: "user", content: fullAnalysisInput },
              ],
              text: {
                format: zodTextFormat(AnalysisResultSchema, "analysis"),
              },
            });
            return response;
          },
          {
            maxAttempts: 3,
            operationName: `analysis-${studyId}-run-${i}`,
          },
        ),
      ),
    );

    const ensembleResponses = await Promise.all(analysisPromises);

    // Parse all ensemble responses
    const ensembleResults: z.infer<typeof AnalysisResultSchema>[] = [];
    for (let i = 0; i < ensembleResponses.length; i++) {
      const text = ensembleResponses[i].output_text?.trim();
      if (!text) {
        logger.warn(`Empty response from analysis run ${i}`, { studyId });
        continue;
      }
      try {
        ensembleResults.push(
          JSON.parse(text) as z.infer<typeof AnalysisResultSchema>,
        );
      } catch (parseError) {
        logger.warn(`Failed to parse analysis run ${i}`, {
          studyId,
          error: (parseError as Error).message,
        });
      }
    }

    if (ensembleResults.length === 0) {
      throw new Error("All analysis runs returned empty or unparseable results");
    }

    logger.info("Ensemble analysis runs completed", {
      studyId,
      totalRuns: ensembleRuns,
      successfulRuns: ensembleResults.length,
      insightCounts: ensembleResults.map((r) => r.insights.length),
    });

    // Consolidation: if multiple runs, merge by consensus
    let parsed: z.infer<typeof AnalysisResultSchema>;

    if (ensembleResults.length === 1) {
      // Single run (or all others failed) — use directly
      parsed = ensembleResults[0];
    } else {
      // Consolidate N runs into a single result
      logger.info("Running consolidation phase", {
        studyId,
        runCount: ensembleResults.length,
        consensusThreshold: config.qualitativeAnalysis.consensusThreshold,
      });

      const consolidationPrompt = buildConsolidationPrompt(
        ensembleResults.length,
        config.qualitativeAnalysis.consensusThreshold,
      );

      // Build user content: all ensemble results as numbered runs
      const consolidationInput = ensembleResults
        .map(
          (r, i) =>
            `--- Analysis Run ${i + 1} ---\n${JSON.stringify(r, null, 2)}\n--- End of Run ${i + 1} ---`,
        )
        .join("\n\n");

      const consolidationResponse = await openAiBreaker.execute(() =>
        withRetry(
          async () => {
            const response = await openai.responses.create({
              model: config.models.qualitativeAnalysis,
              reasoning: { effort: config.qualitativeAnalysis.reasoningEffort },
              stream: false,
              input: [
                { role: "system", content: consolidationPrompt },
                { role: "user", content: consolidationInput },
              ],
              text: {
                format: zodTextFormat(AnalysisResultSchema, "analysis"),
              },
            });
            return response;
          },
          {
            maxAttempts: 3,
            operationName: `consolidation-${studyId}`,
          },
        ),
      );

      const consolidationText = consolidationResponse.output_text?.trim();
      if (!consolidationText) {
        // Fallback: use the first run's result
        logger.warn(
          "Consolidation returned empty, falling back to first run",
          { studyId },
        );
        parsed = ensembleResults[0];
      } else {
        try {
          parsed = JSON.parse(consolidationText) as z.infer<
            typeof AnalysisResultSchema
          >;
          logger.info("Consolidation completed", {
            studyId,
            inputInsightCounts: ensembleResults.map((r) => r.insights.length),
            outputInsightCount: parsed.insights.length,
          });
        } catch (parseError) {
          logger.warn(
            "Failed to parse consolidation, falling back to first run",
            {
              studyId,
              error: (parseError as Error).message,
            },
          );
          parsed = ensembleResults[0];
        }
      }
    }

    // Build file ID lookup for tracing quotes to source files
    const fileIdByName: Record<string, string> = {};
    const fileIdByIdentifier: Record<string, string> = {};
    for (const f of interviewFiles) {
      fileIdByName[(f.originalName || "").toLowerCase()] = f.id;
      if (f.identifier) {
        fileIdByIdentifier[f.identifier.toLowerCase()] = f.id;
      }
    }

    /**
     * Try to match a quote's participant string to a source file ID.
     * Checks both file names and extracted identifiers.
     */
    function resolveSourceFileId(
      participant: string | null | undefined,
    ): string | undefined {
      if (!participant) return undefined;
      const lower = participant.toLowerCase();

      // Exact match on identifier
      if (fileIdByIdentifier[lower]) return fileIdByIdentifier[lower];

      // Partial match on identifier
      const identMatch = Object.entries(fileIdByIdentifier).find(
        ([ident]) => ident.includes(lower) || lower.includes(ident),
      );
      if (identMatch) return identMatch[1];

      // Partial match on file name
      const nameMatch = Object.entries(fileIdByName).find(([name]) =>
        name.includes(lower),
      );
      if (nameMatch) return nameMatch[1];

      return undefined;
    }

    // Map results to the format expected by the database
    const result: QualitativeAnalysisResult = {
      summary: parsed.summary,
      inferredGoal,
      inferredQuestions,
      inferredGuide,
      studyName: generatedStudyName,
      insights: parsed.insights.map((insight) => ({
        title: insight.title,
        observation: insight.observation,
        motivation: insight.motivation,
        implication: insight.implication,
        insightStatement: insight.insightStatement,
        theme: insight.theme ?? undefined,
        severity: insight.severity ?? undefined,
        participantCount: insight.participantCount ?? undefined,
        quotes: insight.quotes.map((q) => ({
          quote: q.quote.replace(/^["“”']+|["“”']+$/g, "").trim(),
          participant: q.participant ?? undefined,
          timestamp: q.timestamp ?? undefined,
          sourceFileId: resolveSourceFileId(q.participant),
        })),
        tags: insight.tags.map((t) =>
          t.replace(/^(?:category|type|tag|label):\s*/i, "").trim()
        ),
      })),
    };

    // ========================================
    // Generate cover image
    // ========================================
    try {
      const themes = parsed.insights
        .map((i) => i.theme)
        .filter(Boolean)
        .slice(0, 5);
      const effectiveGoal = payload.goal || inferredGoal || "";
      const coverPromptParts = [
        "Abstract, modern cover image for a qualitative research study. Clean, minimalist, professional.",
        effectiveGoal ? `Research theme: ${effectiveGoal}` : undefined,
        themes.length > 0 ? `Key topics: ${themes.join(", ")}` : undefined,
        result.studyName ? `Study title hint: ${result.studyName}` : undefined,
        "no text, no people, 16:9 composition, soft lighting, high resolution, muted colors, editorial style",
      ];
      const coverPrompt = coverPromptParts.filter(Boolean).join(". ");

      logger.info("Generating cover image for analysis", { studyId });
      const { buffer, contentType } = await generatePersonaImage(
        coverPrompt,
        "1024x1024",
      );
      const teamId = jobData.teamId || jobData.userId;
      const key = `studies/${teamId}/${studyId}/analysis/cover-${randomUUID()}.png`;
      const s3Key = await uploadBufferToS3({ buffer, key, contentType });
      result.coverImageKey = s3Key;
      logger.info("Cover image generated and uploaded", {
        studyId,
        key: s3Key,
      });
    } catch (e) {
      logger.warn("Failed to generate cover image, continuing without", {
        studyId,
        error: (e as Error).message,
      });
    }

    const processingDuration = Date.now() - startTime;

    logger.info("Analysis completed successfully", {
      studyId,
      insightCount: result.insights.length,
      totalQuotes: result.insights.reduce((sum, i) => sum + i.quotes.length, 0),
      processingDuration,
    });

    // Save results to database
    await addQualitativeAnalysis(jobData, result);
  } catch (error) {
    await handleProcessingError(jobData, error, "qualitative_analysis");
    throw error;
  }
}
