import { NextRequest, NextResponse } from "next/server";
import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  getLiveSessionDetailsDb,
  updateLiveSessionStatusDb,
  saveLiveSessionTranscriptDb,
  finalizeLiveSessionRecordingDb,
} from "@/apps/nextjs-app/lib/db/data";
import { logger } from "@/apps/shared/logger";
import OpenAI, { toFile } from "openai";
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";

/**
 * DEV-ONLY: Manually finalize a live session by finding its S3 recording,
 * transcribing it via Whisper, and marking it COMPLETED.
 *
 * Usage:
 *   POST /api/dev/finalize-session
 *   Body: { "sessionId": "<liveSessionId>", "fileKey": "<optional S3 key>" }
 *
 * If fileKey is provided, it's used directly. Otherwise, the route looks up
 * the session's teamId/studyId from the DB to build the exact S3 prefix.
 *
 * This exists because LiveKit webhooks can't reach localhost in development.
 */

// ─── Structured output schema for speaker diarization ───────────────────────

const SpeakerLabelsSchema = z.object({
  labels: z
    .array(z.enum(["Interviewer", "Participant"]))
    .describe(
      "One label per transcript segment, in order. Must match segment count.",
    ),
});

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Uses GPT to label each transcript segment with the speaker role
 * (Interviewer / Participant) based on conversational context.
 * Returns the formatted transcript with speaker attribution.
 */
async function addSpeakerLabels(
  segments: Array<{ start: number; text: string }>,
  openai: OpenAI,
): Promise<string> {
  // Build a numbered list for GPT
  const segmentList = segments
    .map((seg, i) => `[${i}] ${seg.text.trim()}`)
    .join("\n");

  try {
    const response = await openai.responses.create({
      model: "gpt-4o-mini",
      input: [
        {
          role: "system",
          content: `You are analyzing a user research interview transcript between an Interviewer and a Participant.

Your task: label each numbered segment with the correct speaker.
- The **Interviewer** asks questions, guides the conversation, probes for details, and transitions topics.
- The **Participant** answers questions, shares experiences, opinions, and stories.

Return exactly one label per segment. The array length must equal the number of segments.`,
        },
        {
          role: "user",
          content: `Label each segment:\n\n${segmentList}`,
        },
      ],
      temperature: 0,
      text: {
        format: zodTextFormat(SpeakerLabelsSchema, "speaker_labels"),
      },
    });

    const parsed = JSON.parse(response.output_text) as z.infer<
      typeof SpeakerLabelsSchema
    >;

    return segments
      .map((seg, i) => {
        const speaker = parsed.labels[i] || "Unknown";
        return `[${formatTimestamp(seg.start)}] ${speaker}: ${seg.text.trim()}`;
      })
      .join("\n");
  } catch (err) {
    logger.warn("Speaker diarization failed, falling back to unlabeled", {
      error: err instanceof Error ? err.message : String(err),
    });
    // Fallback: return without speaker labels
    return segments
      .map((seg) => `[${formatTimestamp(seg.start)}] ${seg.text.trim()}`)
      .join("\n");
  }
}

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Not available in production" },
      { status: 403 },
    );
  }

  const { sessionId, fileKey } = await req.json();
  if (!sessionId) {
    return NextResponse.json(
      { error: "sessionId is required" },
      { status: 400 },
    );
  }

  try {
    const s3Client = new S3Client({
      region: process.env.AWS_REGION!,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });

    let recordingKey: string | null = fileKey || null;

    if (!recordingKey) {
      // Look up session to get teamId + studyId for an exact S3 prefix
      const session = await getLiveSessionDetailsDb(sessionId);
      if (!session?.study?.teamId) {
        return NextResponse.json(
          {
            error: `Could not find session ${sessionId} or its study/team in DB`,
          },
          { status: 404 },
        );
      }

      const prefix = `studies/${session.study.teamId}/${session.studyId}/live-sessions/${sessionId}/`;
      logger.info("DEV: Searching S3 for recording", {
        prefix,
        bucket: process.env.AWS_BUCKET_NAME,
      });

      const listResult = await s3Client.send(
        new ListObjectsV2Command({
          Bucket: process.env.AWS_BUCKET_NAME!,
          Prefix: prefix,
          MaxKeys: 100,
        }),
      );

      const match = listResult.Contents?.find((obj) =>
        obj.Key?.endsWith(".mp4"),
      );
      recordingKey = match?.Key || null;

      if (!recordingKey) {
        return NextResponse.json(
          {
            error: `No MP4 recording found in S3 for session ${sessionId}`,
            searchedPrefix: prefix,
            bucket: process.env.AWS_BUCKET_NAME,
            objectsFound: listResult.Contents?.map((o) => o.Key) || [],
          },
          { status: 404 },
        );
      }
    }

    // Get file size from S3
    const headResult = await s3Client.send(
      new HeadObjectCommand({
        Bucket: process.env.AWS_BUCKET_NAME!,
        Key: recordingKey,
      }),
    );
    const fileSize = headResult.ContentLength ?? 0;

    // Create a File record in the database (matches production webhook flow)
    try {
      await finalizeLiveSessionRecordingDb(sessionId, recordingKey, fileSize);
      logger.info("DEV: Created File record for recording", {
        sessionId,
        recordingKey,
        fileSize,
      });
    } catch (fileRecordError) {
      // Don't fail the whole finalization if File record already exists
      logger.warn("DEV: Could not create File record (may already exist)", {
        sessionId,
        error:
          fileRecordError instanceof Error
            ? fileRecordError.message
            : String(fileRecordError),
      });
    }

    // Generate a long-lived presigned URL (7 days)
    const presignedUrl = await getSignedUrl(
      s3Client,
      new GetObjectCommand({
        Bucket: process.env.AWS_BUCKET_NAME!,
        Key: recordingKey,
      }),
      { expiresIn: 7 * 24 * 60 * 60 },
    );

    // Update session: set recordingUrl and mark COMPLETED
    await updateLiveSessionStatusDb(
      sessionId,
      "COMPLETED",
      undefined,
      undefined,
      presignedUrl,
    );

    logger.info("DEV: Manually finalized live session", {
      sessionId,
      recordingKey,
    });

    // ── Transcribe the recording via Whisper ──
    let transcriptText: string | null = null;
    try {
      logger.info("DEV: Downloading recording from S3 for transcription", {
        recordingKey,
      });

      const getResult = await s3Client.send(
        new GetObjectCommand({
          Bucket: process.env.AWS_BUCKET_NAME!,
          Key: recordingKey,
        }),
      );

      const bodyStream = getResult.Body;
      if (!bodyStream) throw new Error("Empty S3 response body");

      // Read the stream into a buffer
      const chunks: Uint8Array[] = [];
      // @ts-expect-error - S3 body is a readable stream
      for await (const chunk of bodyStream) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);

      logger.info("DEV: Sending recording to Whisper", {
        bytes: buffer.byteLength,
      });

      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const file = await toFile(buffer, "recording.mp4");

      const transcription = await openai.audio.transcriptions.create({
        file,
        model: "whisper-1",
        response_format: "verbose_json",
        timestamp_granularities: ["segment"],
      });

      // Format segments with timestamps: "[M:SS] text"
      const segments = (transcription as any).segments as
        | Array<{
            start: number;
            end: number;
            text: string;
            no_speech_prob?: number;
          }>
        | undefined;

      if (segments && segments.length > 0) {
        const filtered = segments.filter(
          (seg) => (seg.no_speech_prob ?? 0) < 0.8,
        );

        // Use GPT to add speaker attribution (Interviewer / Participant)
        logger.info("Running speaker diarization", {
          segmentCount: filtered.length,
        });
        transcriptText = await addSpeakerLabels(filtered, openai);
      } else {
        transcriptText = transcription.text || null;
      }

      if (transcriptText) {
        await saveLiveSessionTranscriptDb(
          sessionId,
          "dev-local",
          transcriptText,
        );
        logger.info("Transcript saved", {
          sessionId,
          length: transcriptText.length,
        });
      }
    } catch (transcriptError) {
      logger.error("Transcription failed (session still finalized)", {
        sessionId,
        error:
          transcriptError instanceof Error
            ? transcriptError.message
            : String(transcriptError),
      });
    }

    return NextResponse.json({
      success: true,
      sessionId,
      recordingKey,
      recordingUrl: presignedUrl,
      hasTranscript: !!transcriptText,
      transcriptLength: transcriptText?.length ?? 0,
    });
  } catch (error) {
    logger.error("Failed to finalize session", { sessionId, error });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
