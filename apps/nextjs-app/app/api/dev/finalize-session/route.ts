import { NextRequest, NextResponse } from "next/server";
import {
  S3Client,
  ListObjectsV2Command,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import {
  getLiveSessionDetailsDb,
  updateLiveSessionStatusDb,
} from "@/apps/nextjs-app/lib/db/data";
import { queueLiveSessionAIProcessing } from "@/apps/nextjs-app/lib/actions/study-lifecycle-actions";
import { logger } from "@/apps/shared/logger";

/**
 * DEV-ONLY: Manually finalize a live session by finding its S3 recording
 * and queuing it for AI processing (transcription via the AI worker).
 *
 * Usage:
 *   POST /api/dev/finalize-session
 *   Body: { "sessionId": "<liveSessionId>", "fileKey": "<optional S3 key>" }
 *
 * If fileKey is provided, it's used directly. Otherwise, the route looks up
 * the session's teamId/studyId from the DB to build the exact S3 prefix.
 *
 * This exists because LiveKit webhooks can't reach localhost in development.
 * It mirrors the production webhook flow: find recording → finalize → queue
 * a `live_session` job for the AI worker to transcribe.
 */

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

    // Store the S3 key on the session (presigned URLs are generated at render time)
    await updateLiveSessionStatusDb(
      sessionId,
      "PROCESSING",
      undefined,
      undefined,
      recordingKey,
    );

    // Queue the live_session job — same path as the production webhook.
    // This calls finalizeLiveSessionRecordingDb (creates File record) and
    // queues the job for the AI worker to transcribe via Whisper.
    await queueLiveSessionAIProcessing(sessionId, recordingKey, fileSize);

    logger.info("DEV: Finalized and queued live session for transcription", {
      sessionId,
      recordingKey,
      fileSize,
    });

    return NextResponse.json({
      success: true,
      sessionId,
      recordingKey,
      fileSize,
      message:
        "Session finalized and queued for AI transcription. " +
        "The AI worker will process it asynchronously.",
    });
  } catch (error) {
    logger.error("Failed to finalize session", { sessionId, error });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
