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

// Import from shared modules
import { logger } from "@/apps/shared/logger.ts";
import type { JobEnvelopeV2_AN } from "@/apps/shared/jobSchema.ts";

// Import from local modules
import { config } from "../config.ts";
import { getPresignedUrl } from "../lib/s3Client.ts";
import {
  getFiles,
  addQualitativeAnalysis,
  updateFileTranscript,
  updateFileIdentifier,
} from "../lib/dbWorkerClient.ts";
import { handleProcessingError } from "../lib/errorHandler.ts";
import { withRetry } from "../lib/withRetry.ts";
import { openAiBreaker } from "../lib/circuitBreaker.ts";
import { buildInferencePrompt, buildAnalysisPrompt } from "../prompts/index.ts";
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
const WHISPER_SUPPORTED_EXTENSIONS = /\.(mp3|mp4|mpeg|mpga|m4a|wav|webm)$/i;
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

  for (const file of files) {
    // Use cached transcript if available
    if (file.transcript) {
      logger.info("Using cached transcript", {
        fileName: file.originalName,
        transcriptLength: file.transcript.length,
      });
      const label = isMediaFile(file) ? "Transcription" : "Transcript/Document";
      content.push(
        `--- ${label}: ${file.originalName} ---\n${file.transcript}\n--- End of ${file.originalName} ---`,
      );
      continue;
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
        content.push(
          `[Media file: ${file.originalName} — format not supported for automatic transcription. ` +
            `Supported formats: mp3, mp4, mpeg, mpga, m4a, wav, webm]`,
        );
        continue;
      }

      try {
        // Fetch the file from S3
        const response = await fetch(presignedUrl);
        const buffer = Buffer.from(await response.arrayBuffer());

        if (buffer.byteLength > WHISPER_MAX_BYTES) {
          logger.warn(
            "File exceeds Whisper 25 MB limit, falling back to URL reference",
            {
              fileName: file.originalName,
              sizeBytes: buffer.byteLength,
            },
          );
          content.push(
            `[Media file: ${file.originalName} — file too large for automatic transcription ` +
              `(${(buffer.byteLength / (1024 * 1024)).toFixed(1)} MB, limit 25 MB). ` +
              `Please provide a pre-made transcript for best results.]`,
          );
          continue;
        }

        logger.info("Transcribing media file via Whisper", {
          fileName: file.originalName,
          sizeBytes: buffer.byteLength,
        });

        const transcript = await transcribeFile(
          buffer,
          file.originalName || "audio.mp3",
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
      } catch (error) {
        logger.error("Failed to transcribe media file", {
          fileName: file.originalName,
          error: (error as Error).message,
        });
        content.push(
          `[Media file: ${file.originalName} — transcription failed: ${(error as Error).message}]`,
        );
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
          content.push(
            `[Document: ${file.originalName} — no readable text could be extracted]`,
          );
          continue;
        }

        content.push(
          `--- Transcript/Document: ${file.originalName} ---\n${text}\n--- End of ${file.originalName} ---`,
        );

        // Cache extracted text for future runs (PDFs and other documents)
        updateFileTranscript(file.id, text).catch((err) =>
          logger.warn("Failed to cache extracted text", {
            fileId: file.id,
            error: (err as Error).message,
          }),
        );
      } catch (error) {
        logger.warn("Failed to fetch/parse file", {
          fileName: file.originalName,
          error: (error as Error).message,
        });
        content.push(
          `[Document: ${file.originalName} — could not be loaded: ${(error as Error).message}]`,
        );
      }
    }
  }

  return content;
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
          inferredGoal = parsed.inferredGoal;
          inferredQuestions = parsed.inferredQuestions;
          inferredGuide = parsed.inferredGuide;

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
    // Phase 2: Main Analysis
    // ========================================
    logger.info("Running analysis phase", { studyId });

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
    });

    // Build user content from transcribed interview text
    const analysisUserContent = interviewContent.join("\n\n");

    const analysisContextText = contextContent.join("\n\n");

    const fullAnalysisInput = analysisContextText
      ? `${analysisUserContent}\n\n--- Additional Context Documents ---\n${analysisContextText}`
      : analysisUserContent;

    const analysisResponse = await openAiBreaker.execute(() =>
      withRetry(
        async () => {
          const response = await openai.responses.create({
            model: config.models.qualitativeAnalysis,
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
          operationName: `analysis-${studyId}`,
        },
      ),
    );

    const analysisText = analysisResponse.output_text?.trim();
    if (!analysisText) {
      throw new Error("Empty response from analysis LLM");
    }

    let parsed: z.infer<typeof AnalysisResultSchema>;
    try {
      parsed = JSON.parse(analysisText) as z.infer<typeof AnalysisResultSchema>;
    } catch (parseError) {
      throw new Error(
        `Failed to parse analysis results: ${(parseError as Error).message}`,
      );
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
      insights: parsed.insights.map((insight) => ({
        title: insight.title,
        observation: insight.observation,
        motivation: insight.motivation,
        implication: insight.implication,
        insightStatement: insight.insightStatement,
        theme: insight.theme,
        severity: insight.severity,
        participantCount: insight.participantCount,
        quotes: insight.quotes.map((q) => ({
          quote: q.quote,
          participant: q.participant,
          timestamp: q.timestamp,
          sourceFileId: resolveSourceFileId(q.participant),
        })),
        tags: insight.tags,
      })),
    };

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
