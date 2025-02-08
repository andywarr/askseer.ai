import {
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageCommand,
} from "@aws-sdk/client-sqs";

import { processCognitiveWalkthrough } from "./cognitiveWalkthrough.ts";

import { processHeuristicEvaluation } from "./heuristicEvaluation.ts";

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

function getUserId(jobData: any) {
  return jobData.data.userId;
}

async function updateCredits(userId: string, credits: number) {
  const response = await fetch(
    `${process.env.DB_WORKER_URL}/api/postUpdateCredits`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userId, delta: credits }),
    }
  );
  const { data: updatedUser } = await response.json();

  if (!updatedUser) {
    // Throw an error
  }

  return updatedUser;
}

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
            // Process the job
            const study = await processJob(JSON.parse(message.Body!));

            console.log("Job processed:", study);

            if (study) {
              console.log("Job processed successfully:", study);
              // Remove a credit
              const userId = getUserId(JSON.parse(message.Body!));

              const updatedUser = await updateCredits(userId, -1);
              console.log("User credits updated:", updatedUser);
            }

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
  switch (jobData.task) {
    case "heuristic_evaluation":
      const heuristicEvaluation = await processHeuristicEvaluation(jobData);
      return heuristicEvaluation;
    case "cognitive_walkthrough":
      const cognitiveWalkthrough = await processCognitiveWalkthrough(jobData);
      return cognitiveWalkthrough;
    default:
      console.log("Unknown task:", jobData.task);
      return null;
  }
}

// Start polling
pollQueue().catch(console.error);
