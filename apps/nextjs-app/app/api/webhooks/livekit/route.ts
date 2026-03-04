import { WebhookReceiver } from "livekit-server-sdk";
import { headers } from "next/headers";
import { logger } from "@/apps/shared/logger";
import { queueLiveSessionAIProcessing } from "@/apps/nextjs-app/lib/actions/study-lifecycle-actions";

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

    return new Response("Webhook processed", { status: 200 });
  } catch (error) {
    logger.error("Failed to process LiveKit webhook", { error });
    return new Response("Internal server error", { status: 500 });
  }
}
