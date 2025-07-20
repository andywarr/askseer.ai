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

const cloudwatch = new CloudWatchLogsClient({ region: REGION });

let sequenceToken: string | undefined;
let logStreamInitialized = false;

async function ensureLogStream(): Promise<void> {
  if (logStreamInitialized) return;

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
  } catch (error) {
    console.error("Failed to initialize CloudWatch log stream:", error);
    // Don't throw - allow the app to continue without CloudWatch logging
  }
}

export async function sendToCloudWatch(message: string): Promise<void> {
  // Skip CloudWatch logging if required environment variables are not set
  if (!LOG_GROUP_NAME || !LOG_STREAM_NAME || !REGION) {
    return;
  }

  // Ensure log stream is initialized
  await ensureLogStream();

  if (!logStreamInitialized) {
    return; // Skip if initialization failed
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
      })
    );

    sequenceToken = result.nextSequenceToken;
  } catch (err) {
    console.error("CloudWatch log error:", err);
    // Reset initialization flag so we can try again next time
    logStreamInitialized = false;
  }
}
