/**
 * Interview AI Processing
 *
 * Dual-mode processing:
 * 1. Guide mode  — Parse uploaded discussion guide documents to extract
 *    research goal, structured questions/tasks, and generate an AI moderator
 *    system prompt. Triggered on study finalize.
 * 2. Analyze mode — Fetch all completed session transcripts and run
 *    qualitative analysis (thematic coding, insight extraction). Triggered
 *    manually when the user clicks "Analyze all sessions".
 */

import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import OpenAI from "openai";
import { randomUUID } from "crypto";

import { logger } from "@/apps/shared/logger.ts";
import type { JobEnvelopeV2_IV } from "@/apps/shared/jobSchema.ts";

import { config } from "../config.ts";
import { openAiBreaker } from "../lib/circuitBreaker.ts";
import { withRetry } from "../lib/withRetry.ts";
import { uploadBufferToS3 } from "../lib/s3Client.ts";
import {
  getFiles,
  addQualitativeAnalysis,
  saveInterviewGuide,
  getInterviewTranscripts,
} from "../lib/dbWorkerClient.ts";
import { handleProcessingError } from "../lib/errorHandler.ts";
import {
  buildFileContent,
  type QualitativeAnalysisResult,
} from "./qualitativeAnalysis.ts";
import { generatePersonaImage } from "./persona.ts";

// ── OpenAI client ──────────────────────────────────────────────────
const openai = new OpenAI();

// ── Schemas ────────────────────────────────────────────────────────

const InterviewGuideSchema = z.object({
  goal: z.string().describe("The primary research objective or goal"),
  questions: z.array(
    z.object({
      text: z.string().describe("The question or task text"),
      type: z.enum(["QUESTION", "TASK"]).describe("Whether this is a question to ask or a task to perform"),
    }),
  ).describe("Ordered list of questions and tasks from the discussion guide"),
  systemPrompt: z.string().describe(
    "A comprehensive system prompt for an AI moderator that will conduct the interview. " +
    "The prompt MUST include a CONSENT section as the mandatory first step: the moderator must ask for the participant's " +
    "consent to be recorded before asking any interview questions. If the participant declines consent, the moderator must " +
    "thank them for considering participating and end the session immediately without asking further questions. " +
    "Also include personality traits (warm, empathetic, curious), interview style (semi-structured), " +
    "the ordered list of questions to cover, probing guidelines, and rules for natural conversation flow.",
  ),
});

const StudyNameSchema = z
  .object({
    name: z.string().min(2).max(80),
  })
  .strict();

const InterviewAnalysisSchema = z.object({
  summary: z.string().describe("Comprehensive summary of key findings across all interview sessions"),
  insights: z.array(
    z.object({
      theme: z.string().describe("The thematic category of this insight"),
      insight: z.string().describe("The specific insight or finding"),
      motivation: z.string().describe("The underlying user need, desire, or pain point driving this behavior or opinion"),
      evidence: z.array(z.string()).describe("Direct quotes from participants supporting this insight. Do NOT wrap quotes in quotation marks — provide the raw text only."),
      severity: z.number().min(1).max(5).describe("Importance/severity rating from 1-5"),
      recommendation: z.string().describe("Actionable recommendation based on this insight"),
    }),
  ).describe("List of individual insights extracted from the transcripts"),
});

// ── Main entry point ───────────────────────────────────────────────

export async function processInterview(
  envelope: JobEnvelopeV2_IV,
): Promise<void> {
  const { studyId, userId, payload } = envelope;
  const mode = payload.mode;

  logger.info("Starting Interview processing", {
    studyId,
    userId,
    mode,
    isRetry: envelope.retry || false,
  });

  try {
    if (mode === "guide") {
      await processGuide(envelope);
    } else if (mode === "analyze") {
      await processAnalyze(envelope);
    } else {
      throw new Error(`Unknown interview mode: ${mode}`);
    }

    logger.info("Interview processing completed successfully", {
      studyId,
      mode,
    });
  } catch (error) {
    await handleProcessingError(envelope, error, "interview");
    throw error;
  }
}

// ── Guide mode ─────────────────────────────────────────────────────

async function processGuide(envelope: JobEnvelopeV2_IV): Promise<void> {
  const { studyId, payload } = envelope;
  const startTime = Date.now();

  logger.info("Interview — guide mode, processing discussion guide", {
    studyId,
  });

  // 1. Fetch and parse uploaded files
  const dbFiles = await getFiles(studyId);

  if (!dbFiles || dbFiles.length === 0) {
    throw new Error("No files found for interview study");
  }

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

  // 2. Extract goal, questions, and generate system prompt
  const guideResponse = await openAiBreaker.execute(() =>
    withRetry(
      async () => {
        const response = await openai.responses.create({
          model: config.models.qualitativeAnalysis,
          reasoning: { effort: "high" },
          stream: false,
          input: [
            {
              role: "system",
              content: [
                "You are an expert UX research methodologist and AI interview designer.",
                "",
                "You will receive a discussion guide document for a qualitative research interview.",
                "Your job is to:",
                "1. Extract the primary research goal/objective",
                "2. Extract all questions and tasks in order, classifying each as QUESTION or TASK",
                "3. Generate a comprehensive system prompt for an AI moderator that will conduct this interview",
                "",
                "The system prompt should instruct the AI moderator to:",
                "- Be warm, empathetic, and genuinely curious",
                "- Follow a semi-structured interview format",
                "- Ask the questions in order but allow natural tangents",
                "- Use probing follow-ups (\"Can you tell me more about that?\", \"What made you feel that way?\")",
                "- Avoid leading questions",
                "- Acknowledge participant responses before moving on",
                "- Keep track of which questions have been covered",
                "- Gracefully transition between topics",
                "- Summarize key points at the end",
                "- Handle silences naturally",
                "- The interview has a 30-minute time limit",
              ].join("\n"),
            },
            {
              role: "user",
              content: combinedText,
            },
          ],
          text: {
            format: zodTextFormat(InterviewGuideSchema, "interview_guide"),
          },
        });
        return response;
      },
      {
        maxAttempts: 3,
        operationName: `interview-guide-${studyId}`,
      },
    ),
  );

  const guideText = guideResponse.output_text?.trim();
  let goal: string | undefined;
  let questions: Array<{ text: string; type: "QUESTION" | "TASK"; order: number }> = [];
  let systemPrompt: string | undefined;

  if (guideText) {
    try {
      const parsed = InterviewGuideSchema.parse(JSON.parse(guideText));
      goal = parsed.goal;
      questions = parsed.questions.map((q, i) => ({
        text: q.text,
        type: q.type,
        order: i,
      }));
      systemPrompt = parsed.systemPrompt;

      logger.info("Guide parsing completed", {
        studyId,
        hasGoal: !!goal,
        questionCount: questions.length,
        hasSystemPrompt: !!systemPrompt,
      });
    } catch (parseError) {
      logger.warn("Failed to parse guide response", {
        studyId,
        error: (parseError as Error).message,
      });
    }
  }

  // 3. Generate study name
  let generatedStudyName: string | undefined;
  const providedName = payload.name?.trim();

  if (!providedName && (payload.goal || goal)) {
    const effectiveGoal = payload.goal || goal;
    try {
      logger.info("Generating study name from research goal", { studyId });
      const nameCompletion = await openAiBreaker.execute(() =>
        openai.responses.create({
          model: config.models.persona,
          input: [
            {
              role: "system" as const,
              content:
                "You create concise, descriptive study names for UX research interviews. Return only JSON matching the schema. The name should be short (2-6 words), descriptive, and capture the essence of the research goal. Do not use generic names like 'User Interview' or 'Research Project'.",
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
        logger.info("Generated study name", { studyId, generatedStudyName });
      }
    } catch (e) {
      logger.warn("Failed to generate study name, continuing without", {
        studyId,
        error: (e as Error).message,
      });
    }
  }

  // 4. Generate cover image
  let coverImageKey: string | undefined;
  try {
    const effectiveGoal = payload.goal || goal || "";
    const coverPromptParts = [
      "Abstract, modern cover image for a qualitative research interview study. Clean, minimalist, professional.",
      effectiveGoal ? `Research theme: ${effectiveGoal}` : undefined,
      questions.length > 0
        ? `Key topics: ${questions.slice(0, 3).map((q) => q.text).join(", ")}`
        : undefined,
      generatedStudyName ? `Study title hint: ${generatedStudyName}` : undefined,
      "no text, no people, 16:9 composition, soft lighting, high resolution, muted colors, editorial style",
    ];
    const coverPrompt = coverPromptParts.filter(Boolean).join(". ");

    logger.info("Generating cover image for interview study", { studyId });
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

  // 5. Save guide data to db-worker
  await saveInterviewGuide(studyId, {
    goal,
    rawDiscussionGuide: combinedText,
    systemPrompt,
    questions,
    studyName: generatedStudyName,
  });

  // 6. Save QualitativeAnalysis record for the study (for cover image + name)
  const result: QualitativeAnalysisResult = {
    summary: "Discussion guide processed. Study is ready for interview sessions.",
    inferredGoal: goal,
    inferredQuestions: questions.map((q) => q.text),
    inferredGuide: combinedText.slice(0, 2000), // Truncate for storage
    studyName: generatedStudyName,
    coverImageKey,
    insights: [],
  };

  await addQualitativeAnalysis(envelope, result);

  const duration = Date.now() - startTime;
  logger.info("Guide processing completed", {
    studyId,
    duration,
    hasGoal: !!goal,
    questionCount: questions.length,
    hasSystemPrompt: !!systemPrompt,
    hasCover: !!coverImageKey,
    hasStudyName: !!generatedStudyName,
  });
}

// ── Analyze mode ───────────────────────────────────────────────────

async function processAnalyze(envelope: JobEnvelopeV2_IV): Promise<void> {
  const { studyId } = envelope;
  const startTime = Date.now();

  logger.info("Interview — analyze mode, processing session transcripts", {
    studyId,
  });

  // Fetch interview data with all session transcripts
  const interviewData = await getInterviewTranscripts(studyId) as {
    sessions?: Array<{
      id: string;
      messages?: Array<{
        speaker: string;
        text: string;
      }>;
    }>;
    goal?: string;
    questions?: Array<{ text: string }>;
  };

  const sessions = interviewData?.sessions || [];
  const completedSessions = sessions.filter(
    (s) => s.messages && s.messages.length > 0,
  );

  if (completedSessions.length === 0) {
    throw new Error("No completed interview sessions with transcripts found");
  }

  // Build combined transcript text for analysis
  const transcriptParts = completedSessions.map((session, idx) => {
    const messages = session.messages || [];
    const transcript = messages
      .map((m) => `${m.speaker === "AI" ? "Moderator" : "Participant"}: ${m.text}`)
      .join("\n");
    return `--- Session ${idx + 1} ---\n${transcript}`;
  });

  const combinedTranscript = transcriptParts.join("\n\n");

  logger.info("Combined transcripts for analysis", {
    studyId,
    sessionCount: completedSessions.length,
    totalLength: combinedTranscript.length,
  });

  // Run analysis via OpenAI
  const analysisResponse = await openAiBreaker.execute(() =>
    withRetry(
      async () => {
        const response = await openai.responses.create({
          model: config.models.qualitativeAnalysis,
          reasoning: { effort: "high" },
          stream: false,
          input: [
            {
              role: "system",
              content: [
                "You are an expert qualitative researcher analyzing interview transcripts.",
                "",
                "Analyze the following interview session transcripts and produce:",
                "1. A comprehensive summary of the key findings",
                "2. Major themes and patterns across sessions",
                "3. Specific insights with supporting quotes and participant motivations",
                "4. For each insight, identify the underlying user motivation — the need, desire, or pain point driving the behavior",
                "5. Recommendations based on the research findings",
                "",
                "IMPORTANT: When providing evidence quotes, give the raw participant text only. Do NOT wrap quotes in quotation marks.",
                interviewData?.goal ? `Research goal: ${interviewData.goal}` : "",
                interviewData?.questions?.length
                  ? `Research questions: ${interviewData.questions.map((q) => q.text).join("; ")}`
                  : "",
              ]
                .filter(Boolean)
                .join("\n"),
            },
            {
              role: "user",
              content: combinedTranscript,
            },
          ],
          text: {
            format: zodTextFormat(InterviewAnalysisSchema, "interview_analysis"),
          },
        });
        return response;
      },
      {
        maxAttempts: 3,
        operationName: `interview-analyze-${studyId}`,
      },
    ),
  );

  const analysisText = analysisResponse.output_text?.trim();
  let analysisResult: QualitativeAnalysisResult = {
    summary: "Analysis completed.",
    insights: [],
  };

  if (analysisText) {
    try {
      const parsed = InterviewAnalysisSchema.parse(JSON.parse(analysisText));
      analysisResult = {
        summary: parsed.summary,
        inferredGoal: interviewData?.goal,
        inferredQuestions: interviewData?.questions?.map((q) => q.text),
        insights: parsed.insights.map((insight) => ({
          title: insight.theme,
          observation: insight.insight,
          motivation: insight.motivation,
          implication: insight.recommendation,
          insightStatement: insight.insight,
          theme: insight.theme,
          severity: insight.severity,
          quotes: insight.evidence.map((quote) => ({
            quote: quote.replace(/^"+|"+$/g, ""),
          })),
          tags: [],
        })),
      };
    } catch (parseError) {
      logger.warn("Failed to parse analysis response", {
        studyId,
        error: (parseError as Error).message,
      });
    }
  }

  // Save analysis results
  await addQualitativeAnalysis(envelope, analysisResult);

  const duration = Date.now() - startTime;
  logger.info("Interview analysis completed", {
    studyId,
    duration,
    insightCount: analysisResult.insights.length,
    sessionCount: completedSessions.length,
  });
}

