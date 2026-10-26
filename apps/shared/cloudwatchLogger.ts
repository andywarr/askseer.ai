// cloudwatchLogger.ts
import {
  CloudWatchLogsClient,
  CreateLogStreamCommand,
  PutLogEventsCommand,
  DescribeLogStreamsCommand,
  DescribeLogStreamsCommandOutput,
  InputLogEvent,
} from "@aws-sdk/client-cloudwatch-logs";
import pino from "pino";

const LOG_GROUP_NAME = process.env.LOG_GROUP_NAME;
const LOG_STREAM_NAME = process.env.LOG_STREAM_NAME;
const REGION = process.env.AWS_REGION;
const NODE_ENV = process.env.NODE_ENV;

const cloudwatch = new CloudWatchLogsClient({ region: REGION });
const internalLogger = pino({
  level: "info",
  base: { service: "cloudwatch-logger" },
  timestamp: pino.stdTimeFunctions.isoTime,
});

let sequenceToken: string | undefined;
let logStreamInitialized = false;
let cloudWatchDisabled = false; // Flag to disable CloudWatch after permission errors
let initializationAttempted = false; // Flag to prevent multiple concurrent initialization attempts

// Check if we're in production environment
const isProduction = NODE_ENV === "production";

// Batching queue configuration to prevent exceeding CloudWatch 5 TPS limit
const BATCH_SIZE = 50;
const MAX_QUEUE_SIZE = 1000; // Bound queue memory to prevent OOM if CloudWatch hangs
const FLUSH_INTERVAL_MS = 2000;

let logQueue: InputLogEvent[] = [];
let isFlushing = false;
let flushTimer: NodeJS.Timeout | null = null;

async function ensureLogStream(): Promise<boolean> {
  if (cloudWatchDisabled) return false;
  if (logStreamInitialized) return true;
  if (initializationAttempted) return false;

  initializationAttempted = true;

  try {
    const response: DescribeLogStreamsCommandOutput = await cloudwatch.send(
      new DescribeLogStreamsCommand({
        logGroupName: LOG_GROUP_NAME,
        logStreamNamePrefix: LOG_STREAM_NAME,
      })
    );

    const logStream = response.logStreams?.find(
      (s) => s.logStreamName === LOG_STREAM_NAME
    );

    if (!logStream) {
      await cloudwatch.send(
        new CreateLogStreamCommand({
          logGroupName: LOG_GROUP_NAME,
          logStreamName: LOG_STREAM_NAME,
        })
      );
      sequenceToken = undefined;
    } else {
      sequenceToken = logStream.uploadSequenceToken;
    }

    logStreamInitialized = true;
    initializationAttempted = false;
    internalLogger.info("CloudWatch log stream initialized successfully");
    return true;
  } catch (error: any) {
    const errorDetails =
      error instanceof Error
        ? { message: error.message, stack: error.stack }
        : error;
    internalLogger.error(
      {
        error: errorDetails,
      },
      "Failed to initialize CloudWatch log stream"
    );

    // If it's a permission error, disable CloudWatch logging permanently
    if (error.name === "AccessDeniedException" || error.$fault === "client") {
      cloudWatchDisabled = true;
      internalLogger.warn(
        "CloudWatch logging disabled due to insufficient permissions. Logs will only appear in console."
      );
    } else {
      // Allow re-trying initialization on future attempts for transient errors
      initializationAttempted = false;
    }

    return false;
  }
}

async function flushLogs(): Promise<void> {
  if (isFlushing || logQueue.length === 0) return;
  if (!isProduction || !LOG_GROUP_NAME || !LOG_STREAM_NAME || !REGION || cloudWatchDisabled) {
    logQueue = [];
    return;
  }

  isFlushing = true;

  try {
    const ready = await ensureLogStream();
    if (!ready || cloudWatchDisabled) {
      return;
    }

    // Take up to BATCH_SIZE items from the front of the queue
    const batch = logQueue.splice(0, BATCH_SIZE);
    if (batch.length === 0) return;

    // AWS CloudWatch requires chronological timestamp order
    batch.sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0));

    try {
      const result = await cloudwatch.send(
        new PutLogEventsCommand({
          logGroupName: LOG_GROUP_NAME,
          logStreamName: LOG_STREAM_NAME,
          logEvents: batch,
          sequenceToken,
        })
      );

      sequenceToken = result.nextSequenceToken;
    } catch (err: any) {
      const errorDetails =
        err instanceof Error ? { message: err.message, stack: err.stack } : err;
      internalLogger.error({ error: errorDetails }, "CloudWatch log error");

      // Handle expected sequence token mismatch without failing
      if (err.name === "InvalidSequenceTokenException" && err.expectedSequenceToken) {
        sequenceToken = err.expectedSequenceToken;
        // Re-insert un-sent batch at the head if queue has room
        if (logQueue.length + batch.length <= MAX_QUEUE_SIZE) {
          logQueue.unshift(...batch);
        }
      } else if (err.name === "AccessDeniedException" || err.$fault === "client") {
        cloudWatchDisabled = true;
        logQueue = [];
        internalLogger.warn(
          "CloudWatch logging disabled due to insufficient permissions."
        );
      } else {
        // Transient error - reset initialization to allow re-checking stream
        logStreamInitialized = false;
        initializationAttempted = false;
      }
    }
  } catch (unexpectedError) {
    internalLogger.error({ err: unexpectedError }, "Unexpected error in CloudWatch flush");
  } finally {
    isFlushing = false;
    // If there are still items queued up, trigger another flush
    if (logQueue.length > 0) {
      scheduleFlush(100);
    }
  }
}

function scheduleFlush(delayMs: number = FLUSH_INTERVAL_MS) {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flushLogs().catch(() => {});
  }, delayMs);
  if (flushTimer.unref) {
    flushTimer.unref();
  }
}

export async function sendToCloudWatch(message: string): Promise<void> {
  // Only log to CloudWatch in production environment
  if (!isProduction) {
    return;
  }

  // Skip CloudWatch logging if required environment variables are not set
  if (!LOG_GROUP_NAME || !LOG_STREAM_NAME || !REGION || cloudWatchDisabled) {
    return;
  }

  // Drop oldest entries if the queue exceeds the bound to protect memory
  if (logQueue.length >= MAX_QUEUE_SIZE) {
    logQueue.splice(0, BATCH_SIZE);
  }

  logQueue.push({
    message: message.trim(),
    timestamp: Date.now(),
  });

  if (logQueue.length >= BATCH_SIZE) {
    flushLogs().catch(() => {});
  } else {
    scheduleFlush();
  }
}
