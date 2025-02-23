import {
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageCommand,
} from "@aws-sdk/client-sqs";

import { processCognitiveWalkthrough } from "./cognitiveWalkthrough.ts";

import { processHeuristicEvaluation } from "./heuristicEvaluation.ts";

interface JobData {
  data: {
    name: string;
    goal: string;
    files: {
      name: string;
      key: string;
      size: number;
      type: string;
    }[];
    context: string | null;
    heuristic: string | null;
    type: string;
    userId: string;
  };
  studyId: string;
  task: string;
}

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

export async function getStudy(studyId: string, userId: string) {
  // Get a study for the user
  const response = await fetch(
    `${process.env.DB_WORKER_URL}/api/study?studyId=${studyId}&userId=${userId}`
  );
  const { data: study } = await response.json();

  // If data does not exist there is a problem
  if (!study) {
    // Throw an error
  }

  return study;
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
          }
        }
      }
    } catch (error) {
      console.error("Error polling SQS:", error);
    }
  }
}

async function processJob(jobData: JobData) {
  console.log("Processing job:", jobData);

  switch (jobData.data.type.toLowerCase()) {
    case "heuristic_evaluation":
      const heuristicEvaluation = await processHeuristicEvaluation(jobData);
      return heuristicEvaluation;
    case "cognitive_walkthrough":
      const cognitiveWalkthrough = await processCognitiveWalkthrough(jobData);
      return cognitiveWalkthrough;
    default:
      console.log("Unknown study type:", jobData.data.type.toLowerCase());
      return null;
  }
}

// Start polling
pollQueue().catch(console.error);
