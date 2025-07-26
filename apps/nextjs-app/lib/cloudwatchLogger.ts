// cloudwatchLogger.ts
import {
  CloudWatchLogsClient,
  CreateLogStreamCommand,
  PutLogEventsCommand,
  DescribeLogStreamsCommand,
  DescribeLogStreamsCommandOutput,
  InputLogEvent,
} from "@aws-sdk/client-cloudwatch-logs";

const LOG_GROUP_NAME = process.env.LOG_GROUP_NAME;
const LOG_STREAM_NAME = process.env.LOG_STREAM_NAME;
const REGION = process.env.AWS_REGION;
const NODE_ENV = process.env.NODE_ENV;

const cloudwatch = new CloudWatchLogsClient({ region: REGION });

let sequenceToken: string | undefined;
let logStreamInitialized = false;
let cloudWatchDisabled = false; // Flag to disable CloudWatch after permission errors
let initializationAttempted = false; // Flag to prevent multiple initialization attempts

// Check if we're in production environment
const isProduction = NODE_ENV === "production";

async function ensureLogStream(): Promise<void> {
  if (logStreamInitialized || cloudWatchDisabled || initializationAttempted)
    return;

  initializationAttempted = true;

  try {
    const response: DescribeLogStreamsCommandOutput = await cloudwatch.send(
      new DescribeLogStreamsCommand({
        logGroupName: LOG_GROUP_NAME,
        logStreamNamePrefix: LOG_STREAM_NAME,
      }),
    );

    const logStream = response.logStreams?.find(
      (s) => s.logStreamName === LOG_STREAM_NAME,
    );

    if (!logStream) {
      await cloudwatch.send(
        new CreateLogStreamCommand({
          logGroupName: LOG_GROUP_NAME,
          logStreamName: LOG_STREAM_NAME,
        }),
      );
      sequenceToken = undefined;
    } else {
      sequenceToken = logStream.uploadSequenceToken;
    }

    logStreamInitialized = true;
    console.log("CloudWatch log stream initialized successfully");
  } catch (error: any) {
    console.error(
      "Failed to initialize CloudWatch log stream:",
      error.message || error,
    );

    // If it's a permission error, disable CloudWatch logging permanently
    if (error.name === "AccessDeniedException" || error.$fault === "client") {
      cloudWatchDisabled = true;
      console.warn(
        "CloudWatch logging disabled due to insufficient permissions. Logs will only appear in console.",
      );
    }

    // Don't throw - allow the app to continue without CloudWatch logging
  }
}

export async function sendToCloudWatch(message: string): Promise<void> {
  // Only log to CloudWatch in production environment
  if (!isProduction) {
    return;
  }

  // Skip CloudWatch logging if required environment variables are not set
  if (!LOG_GROUP_NAME || !LOG_STREAM_NAME || !REGION) {
    return;
  }

  // Skip if CloudWatch has been disabled due to permission errors
  if (cloudWatchDisabled) {
    return;
  }

  // Ensure log stream is initialized
  await ensureLogStream();

  if (!logStreamInitialized || cloudWatchDisabled) {
    return; // Skip if initialization failed or disabled
  }

  const logEvents: InputLogEvent[] = [
    {
      message: message.trim(),
      timestamp: Date.now(),
    },
  ];

  try {
    const result = await cloudwatch.send(
      new PutLogEventsCommand({
        logGroupName: LOG_GROUP_NAME,
        logStreamName: LOG_STREAM_NAME,
        logEvents,
        sequenceToken,
      }),
    );

    sequenceToken = result.nextSequenceToken;
  } catch (err: any) {
    console.error("CloudWatch log error:", err.message || err);

    // If it's a permission error, disable CloudWatch logging
    if (err.name === "AccessDeniedException" || err.$fault === "client") {
      cloudWatchDisabled = true;
      console.warn(
        "CloudWatch logging disabled due to insufficient permissions.",
      );
    } else {
      // Reset initialization flag so we can try again next time for other errors
      logStreamInitialized = false;
    }
  }
}
