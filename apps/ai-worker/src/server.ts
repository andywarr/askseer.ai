// AWS imports
import {
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageCommand,
} from "@aws-sdk/client-sqs";

// Import functions
import { logger } from "./logger.ts";
import { processCognitiveWalkthrough } from "@/apps/ai-worker/src/cognitiveWalkthrough.ts";
import { processHeuristicEvaluation } from "@/apps/ai-worker/src/heuristicEvaluation.ts";
import { processPersona } from "@/apps/ai-worker/src/persona.ts";
import {
  parseJobEnvelope,
  type JobEnvelopeV2,
} from "@/apps/shared/jobSchema.ts";

// Load environment variables
import dotenv from "dotenv";
dotenv.config();

// Initialize SQS client
const sqsClient = new SQSClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

// SQS queue URL
const QUEUE_URL = process.env.AWS_SQS_QUEUE_URL!;

// Health metrics
let healthMetrics = {
  startTime: new Date(),
  totalMessages: 0,
  successfulMessages: 0,
  failedMessages: 0,
  lastProcessedMessage: null as Date | null,
  lastError: null as { timestamp: Date; error: string } | null,
};

// Log health metrics every 5 minutes
setInterval(
  () => {
    const uptime = Date.now() - healthMetrics.startTime.getTime();
    const successRate =
      healthMetrics.totalMessages > 0
        ? (
            (healthMetrics.successfulMessages / healthMetrics.totalMessages) *
            100
          ).toFixed(2)
        : 0;

    logger.info("Health metrics", {
      uptime: `${Math.floor(uptime / 1000 / 60)} minutes`,
      totalMessages: healthMetrics.totalMessages,
      successfulMessages: healthMetrics.successfulMessages,
      failedMessages: healthMetrics.failedMessages,
      successRate: `${successRate}%`,
      lastProcessedMessage: healthMetrics.lastProcessedMessage,
      lastError: healthMetrics.lastError,
    });
  },
  60 * 60 * 1000
);

export async function getStudy(studyId: string, userId: string) {
  logger.debug("Fetching study data", { studyId, userId });

  // Get a study for the user
  const response = await fetch(
    `${process.env.DB_WORKER_URL}/api/study?studyId=${studyId}&userId=${userId}`
  );

  if (!response.ok) {
    logger.error("Failed to fetch study data", {
      studyId,
      userId,
      status: response.status,
      statusText: response.statusText,
    });
    throw new Error(
      `Failed to fetch study: ${response.status} ${response.statusText}`
    );
  }

  const { data: study } = await response.json();

  // If data does not exist there is a problem
  if (!study) {
    logger.error("Study not found", { studyId, userId });
    throw new Error("Study not found");
  }

  logger.debug("Study data retrieved successfully", {
    studyId,
    userId,
    studyName: study.name,
  });
  return study;
}

// Poll SQS queue for messages
async function pollQueue() {
  logger.info("SQS queue polling started", { queueUrl: QUEUE_URL });

  let pollCount = 0;
  let processedMessageCount = 0;

  while (true) {
    try {
      pollCount++;
      const pollStartTime = Date.now();

      logger.debug("Polling SQS queue for messages", { pollCount });

      const command = new ReceiveMessageCommand({
        QueueUrl: QUEUE_URL,
        MaxNumberOfMessages: 1, // Adjust based on your needs
        WaitTimeSeconds: 20, // Long polling
        VisibilityTimeout: 1 * 60 * 60, // Time to process before message becomes visible again
      });

      const response = await sqsClient.send(command);
      const pollDuration = Date.now() - pollStartTime;

      logger.debug("SQS poll completed", {
        pollCount,
        pollDuration,
        messagesReceived: response.Messages?.length || 0,
      });

      if (response.Messages && response.Messages.length > 0) {
        for (const message of response.Messages) {
          const messageStartTime = Date.now();
          healthMetrics.totalMessages++;

          logger.info("Received message from SQS queue", {
            // Avoid logging entire body; it's potentially large
            messageBodyPreview: (message.Body || "").slice(0, 256) + "...",
            messageId: message.MessageId,
            receiptHandle: message.ReceiptHandle?.substring(0, 20) + "...",
            totalProcessedToDate: healthMetrics.totalMessages,
          });

          try {
            // Process the job
            const raw = JSON.parse(message.Body!);
            const envelope = parseJobEnvelope(raw);
            await processJob(envelope);

            // Delete message after successful processing
            await sqsClient.send(
              new DeleteMessageCommand({
                QueueUrl: QUEUE_URL,
                ReceiptHandle: message.ReceiptHandle!,
              })
            );

            processedMessageCount++;
            healthMetrics.successfulMessages++;
            healthMetrics.lastProcessedMessage = new Date();
            const messageDuration = Date.now() - messageStartTime;

            logger.info("Message processed and deleted successfully", {
              messageId: message.MessageId,
              processingDuration: messageDuration,
              totalProcessedCount: processedMessageCount,
              successCount: healthMetrics.successfulMessages,
            });
          } catch (error) {
            healthMetrics.failedMessages++;
            healthMetrics.lastError = {
              timestamp: new Date(),
              error: String(error),
            };
            const messageDuration = Date.now() - messageStartTime;

            logger.error("Error processing job", {
              error,
              messageId: message.MessageId,
              processingDuration: messageDuration,
              totalFailures: healthMetrics.failedMessages,
            });
          }
        }
      }
    } catch (error) {
      logger.error("Error polling SQS queue", { error });
    }
  }
}

async function processJob(jobData: JobEnvelopeV2) {
  const processingStartTime = Date.now();
  logger.info("Processing job", {
    studyId: jobData.studyId,
    type: jobData.type,
    userId: jobData.userId,
    isRetry: jobData.retry || false,
  });

  switch (jobData.type.toLowerCase()) {
    case "heuristic_evaluation":
      await processHeuristicEvaluation(jobData as any);
      const heuristicDuration = Date.now() - processingStartTime;
      logger.info("Heuristic evaluation completed successfully", {
        studyId: jobData.studyId,
        processingDuration: heuristicDuration,
      });
      return true;
    case "cognitive_walkthrough":
      await processCognitiveWalkthrough(jobData as any);
      const cognitiveWalkthroughDuration = Date.now() - processingStartTime;
      logger.info("Cognitive walkthrough completed successfully", {
        studyId: jobData.studyId,
        processingDuration: cognitiveWalkthroughDuration,
      });
      return true;
    case "persona":
      await processPersona(jobData as any);
      const personaDuration = Date.now() - processingStartTime;
      logger.info("Persona completed successfully", {
        studyId: jobData.studyId,
        processingDuration: personaDuration,
      });
      return true;
    default:
      logger.warn("Unknown study type received", {
        type: jobData.type,
        studyId: jobData.studyId,
        supportedTypes: ["heuristic_evaluation", "cognitive_walkthrough"],
      });
      return null;
  }
}

// Graceful shutdown handling
process.on("SIGTERM", () => {
  logger.info("Received SIGTERM, shutting down gracefully");
  process.exit(0);
});

process.on("SIGINT", () => {
  logger.info("Received SIGINT, shutting down gracefully");
  process.exit(0);
});

// Start polling
logger.info("Validating environment configuration");

const requiredEnvVars = [
  "AWS_REGION",
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "AWS_SQS_QUEUE_URL",
  "AWS_BUCKET_NAME",
  "DB_WORKER_URL",
];

const missingEnvVars = requiredEnvVars.filter((envVar) => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  logger.error("Missing required environment variables", { missingEnvVars });
  process.exit(1);
}

logger.info("Environment configuration validated successfully", {
  configuredVars: requiredEnvVars.length,
  awsRegion: process.env.AWS_REGION,
  dbWorkerUrl: process.env.DB_WORKER_URL,
  queueUrl: QUEUE_URL.substring(0, 50) + "...",
});

logger.info("Starting SQS queue polling");
pollQueue().catch((error) => {
  logger.error("Fatal error in queue polling", { error });
  process.exit(1);
});
