import { NextRequest, NextResponse } from "next/server";
import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  getLiveSessionDetailsDb,
  updateLiveSessionStatusDb,
  saveLiveSessionTranscriptDb,
} from "@/apps/nextjs-app/lib/db/data";
import { logger } from "@/apps/shared/logger";
import OpenAI, { toFile } from "openai";

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

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
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
        transcriptText = segments
          .filter((seg) => (seg.no_speech_prob ?? 0) < 0.8)
          .map((seg) => `[${formatTimestamp(seg.start)}] ${seg.text.trim()}`)
          .join("\n");
      } else {
        transcriptText = transcription.text || null;
      }

      if (transcriptText) {
        await saveLiveSessionTranscriptDb(
          sessionId,
          "dev-local",
          transcriptText,
        );
        logger.info("DEV: Transcript saved", {
          sessionId,
          length: transcriptText.length,
        });
      }
    } catch (transcriptError) {
      logger.error("DEV: Transcription failed (session still finalized)", {
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
    logger.error("DEV: Failed to finalize session", { sessionId, error });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
