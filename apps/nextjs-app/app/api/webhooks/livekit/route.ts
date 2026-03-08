import { WebhookReceiver } from "livekit-server-sdk";
import { headers } from "next/headers";
import { logger } from "@/apps/shared/logger";
import { queueLiveSessionAIProcessing } from "@/apps/nextjs-app/lib/actions/study-lifecycle-actions";
import {
  getLiveSessionDetailsDb,
  updateLiveSessionStatusDb,
} from "@/apps/nextjs-app/lib/db/data";

const apiKey = process.env.LIVEKIT_API_KEY!;
const apiSecret = process.env.LIVEKIT_API_SECRET!;

const receiver = new WebhookReceiver(apiKey, apiSecret);

export async function POST(req: Request) {
  try {
    const body = await req.text();
    const headersList = await headers();
    const authorization = headersList.get("Authorization");

    if (!authorization) {
      return new Response("Missing authorization header", { status: 401 });
    }

    const event = await receiver.receive(body, authorization);
    logger.info("LiveKit webhook received", { event: event.event });

    if (event.event === "egress_ended") {
      const egressInfo = event.egressInfo;
      if (!egressInfo) {
        return new Response("Missing egressInfo", { status: 400 });
      }

      const sessionId = egressInfo.roomName;
      // Depending on how egress was started, the file info is in:
      const fileResult = egressInfo.fileResults?.[0];

      if (sessionId && fileResult) {
        // Extract S3 object key or URL from fileResult
        const fileKey = fileResult.filename || fileResult.location;
        const fileSize = fileResult.size;

        if (fileKey && fileSize) {
          logger.info("Egress recording finished, queuing for AI processing", { sessionId, fileKey, fileSize });
          
          // Asynchronously trigger the AI processing pipeline
          queueLiveSessionAIProcessing(sessionId, fileKey, Number(fileSize)).catch(err => {
            logger.error("Failed to queue Live Session AI processing from webhook", {
              sessionId,
              error: err instanceof Error ? err.message : String(err)
            });
          });
        }
      }
    }

    // When all participants leave the room, clean up any session still stuck as LIVE.
    // This handles the case where the interviewer's browser crashes or tab is force-closed
    // before handleExit could run on the client.
    if (event.event === "room_finished") {
      const roomName = event.room?.name;
      if (roomName) {
        try {
          const session = await getLiveSessionDetailsDb(roomName);
          if (session && session.status === "LIVE") {
            // If a recording exists, the session was started — move to ENDED
            // Otherwise, revert to SCHEDULED (interviewer joined but never started)
            const newStatus = session.recordingKey || session.recordingStartedAt
              ? "ENDED"
              : "SCHEDULED";
            await updateLiveSessionStatusDb(roomName, newStatus);
            logger.info("room_finished: cleaned up LIVE session", {
              sessionId: roomName,
              newStatus,
            });
          }
        } catch (err) {
          logger.error("room_finished: failed to clean up session", {
            sessionId: roomName,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }

    return new Response("Webhook processed", { status: 200 });
  } catch (error) {
    logger.error("Failed to process LiveKit webhook", { error });
    return new Response("Internal server error", { status: 500 });
  }
}
