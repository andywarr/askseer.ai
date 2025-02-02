import {
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageCommand,
} from "@aws-sdk/client-sqs";

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

// Poll SQS queue for messages
async function pollQueue() {
  while (true) {
    try {
      const command = new ReceiveMessageCommand({
        QueueUrl: QUEUE_URL,
        MaxNumberOfMessages: 1, // Adjust based on your needs
        WaitTimeSeconds: 20, // Long polling
        VisibilityTimeout: 1 * 60 * 60, // Time to process before message becomes visible again
      });

      const response = await sqsClient.send(command);

      if (response.Messages && response.Messages.length > 0) {
        for (const message of response.Messages) {
          console.log("Received message:", message.Body);

          try {
            // TODO: Process your job here (e.g., interact with DB)
            await processJob(JSON.parse(message.Body!));

            // Delete message after successful processing
            await sqsClient.send(
              new DeleteMessageCommand({
                QueueUrl: QUEUE_URL,
                ReceiptHandle: message.ReceiptHandle!,
              })
            );

            console.log("Message processed and deleted:", message.MessageId);
          } catch (error) {
            console.error("Error processing job:", error);
            // Decide if you want to requeue or log for manual retry
          }
        }
      }
    } catch (error) {
      console.error("Error polling SQS:", error);
    }
  }
}

async function processJob(jobData: any) {
  console.log("Processing job:", jobData);
  // Example: Save data to DB
  // await prisma.job.create({ data: jobData });
}

// Start polling
pollQueue().catch(console.error);
