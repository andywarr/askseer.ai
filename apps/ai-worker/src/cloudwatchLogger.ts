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
const REGION = process.env.REGION;

const cloudwatch = new CloudWatchLogsClient({ region: REGION });

let sequenceToken: string | undefined;

async function ensureLogStream(): Promise<void> {
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
}

await ensureLogStream();

export async function sendToCloudWatch(message: string): Promise<void> {
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
  }
}
