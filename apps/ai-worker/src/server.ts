/**
 * AI Worker Server - SQS Queue Processor
 */

// AWS imports
import {
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageCommand,
} from "@aws-sdk/client-sqs";

// Import from local modules
import { config } from "./config.ts";
import { logger } from "@/apps/shared/logger.ts";
import { processCognitiveWalkthrough } from "./jobs/cognitiveWalkthrough.ts";
import { processHeuristicEvaluation } from "./jobs/heuristicEvaluation.ts";
import { processPersona } from "./jobs/persona.ts";
import { processQualitativeAnalysis } from "./jobs/qualitativeAnalysis.ts";
import {
  parseJobEnvelope,
  type JobEnvelopeV2,
} from "@/apps/shared/jobSchema.ts";
import { getCircuitBreakerStates } from "./lib/circuitBreaker.ts";

// Initialize SQS client
const sqsClient = new SQSClient({
  region: config.aws.region,
  credentials: {
    accessKeyId: config.aws.accessKeyId,
    secretAccessKey: config.aws.secretAccessKey,
  },
});

// SQS queue URL
const QUEUE_URL = config.aws.sqsQueueUrl;

// Health metrics
let healthMetrics = {
  startTime: new Date(),
  totalMessages: 0,
  successfulMessages: 0,
  failedMessages: 0,
  lastProcessedMessage: null as Date | null,
  lastError: null as { timestamp: Date; error: string } | null,
};

// Log health metrics every hour
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
      circuitBreakers: getCircuitBreakerStates(),
    });
  },
  60 * 60 * 1000,
);

// ============================================================================
// Queue Polling
// ============================================================================

/**
 * Poll SQS queue for messages
 */
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
        MaxNumberOfMessages: config.sqs.maxNumberOfMessages,
        WaitTimeSeconds: config.sqs.waitTimeSeconds,
        VisibilityTimeout: config.sqs.visibilityTimeout,
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
              }),
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
              error: error instanceof Error ? error.message : String(error),
              stack: error instanceof Error ? error.stack : undefined,
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

// ============================================================================
// Job Processing
// ============================================================================

/**
 * Process a job based on its type
 */
async function processJob(jobData: JobEnvelopeV2): Promise<boolean | null> {
  const processingStartTime = Date.now();
  logger.info("Processing job", {
    studyId: jobData.studyId,
    type: jobData.type,
    userId: jobData.userId,
    isRetry: jobData.retry || false,
  });

  switch (jobData.type.toLowerCase()) {
    case "heuristic_evaluation":
      await processHeuristicEvaluation(
        jobData as Parameters<typeof processHeuristicEvaluation>[0],
      );
      const heuristicDuration = Date.now() - processingStartTime;
      logger.info("Heuristic evaluation completed successfully", {
        studyId: jobData.studyId,
        processingDuration: heuristicDuration,
      });
      return true;
    case "cognitive_walkthrough":
      await processCognitiveWalkthrough(
        jobData as Parameters<typeof processCognitiveWalkthrough>[0],
      );
      const cognitiveWalkthroughDuration = Date.now() - processingStartTime;
      logger.info("Cognitive walkthrough completed successfully", {
        studyId: jobData.studyId,
        processingDuration: cognitiveWalkthroughDuration,
      });
      return true;
    case "persona":
      await processPersona(jobData as Parameters<typeof processPersona>[0]);
      const personaDuration = Date.now() - processingStartTime;
      logger.info("Persona completed successfully", {
        studyId: jobData.studyId,
        processingDuration: personaDuration,
      });
      return true;
    case "qual_analysis":
      await processQualitativeAnalysis(
        jobData as Parameters<typeof processQualitativeAnalysis>[0],
      );
      const analyzeDuration = Date.now() - processingStartTime;
      logger.info("Qualitative analysis completed successfully", {
        studyId: jobData.studyId,
        processingDuration: analyzeDuration,
      });
      return true;
    default:
      logger.warn("Unknown study type received", {
        type: jobData.type,
        studyId: jobData.studyId,
        supportedTypes: [
          "heuristic_evaluation",
          "cognitive_walkthrough",
          "persona",
          "qual_analysis",
        ],
      });
      return null;
  }
}

// ============================================================================
// Graceful Shutdown
// ============================================================================

process.on("SIGTERM", () => {
  logger.info("Received SIGTERM, shutting down gracefully");
  process.exit(0);
});

process.on("SIGINT", () => {
  logger.info("Received SIGINT, shutting down gracefully");
  process.exit(0);
});

// ============================================================================
// Startup
// ============================================================================

// Environment is already validated by config.ts import
logger.info("Environment configuration validated successfully", {
  awsRegion: config.aws.region,
  dbWorkerUrl: config.dbWorker.url,
  queueUrl: QUEUE_URL.substring(0, 50) + "...",
  models: {
    heuristicEvaluation: config.models.heuristicEvaluation,
    cognitiveWalkthrough: config.models.cognitiveWalkthrough,
    persona: config.models.persona,
    deduplication: config.models.deduplication,
    qualitativeAnalysis: config.models.qualitativeAnalysis,
  },
  processing: {
    heEvalConcurrency: config.processing.heEvalConcurrency,
    heMaxAttempts: config.processing.heMaxAttempts,
    cwMaxAttempts: config.processing.cwMaxAttempts,
  },
});

logger.info("Starting SQS queue polling");
pollQueue().catch((error) => {
  logger.error("Fatal error in queue polling", { error });
  process.exit(1);
});
