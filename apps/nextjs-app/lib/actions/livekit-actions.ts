"use server";

import {
  EgressClient,
  EncodedFileOutput,
  EncodedFileType,
  S3Upload,
} from "livekit-server-sdk";
import { logger } from "@/apps/shared/logger";
import { requireAuth } from "./shared";

const apiKey = process.env.LIVEKIT_API_KEY!;
const apiSecret = process.env.LIVEKIT_API_SECRET!;
const wsUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL!;

const egressClient = new EgressClient(wsUrl, apiKey, apiSecret);

export async function startLiveSessionRecording(
  sessionId: string,
  teamId: string,
  studyId: string,
) {
  const user = await requireAuth();

  if (!apiKey || !apiSecret || !wsUrl) {
    throw new Error("LiveKit credentials are not configured.");
  }

  try {
    const s3Output = new S3Upload({
      accessKey: process.env.AWS_ACCESS_KEY_ID!,
      secret: process.env.AWS_SECRET_ACCESS_KEY!,
      region: process.env.AWS_REGION!,
      bucket: process.env.AWS_BUCKET_NAME!,
    });

    const fileOutput = new EncodedFileOutput({
      fileType: EncodedFileType.MP4,
      filepath: `studies/${teamId}/${studyId}/live-sessions/${sessionId}/recording-{time}.mp4`,
      output: { case: "s3", value: s3Output },
    });

    const info = await egressClient.startRoomCompositeEgress(
      sessionId,
      {
        file: fileOutput,
      },
      {
        layout: "grid",
      },
    );

    logger.info("Started LiveKit Egress recording", {
      sessionId,
      egressId: info.egressId,
    });
    return { egressId: info.egressId };
  } catch (error) {
    logger.error("Failed to start LiveKit recording", { sessionId, error });
    throw error;
  }
}

export async function stopLiveSessionRecording(egressId: string) {
  await requireAuth();

  try {
    const info = await egressClient.stopEgress(egressId);
    logger.info("Stopped LiveKit Egress recording", { egressId });
    return info;
  } catch (error) {
    logger.error("Failed to stop LiveKit recording", { egressId, error });
    throw error;
  }
}
