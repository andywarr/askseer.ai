/**
 * Centralized configuration and environment variable validation
 * All env vars are validated at module load time
 */

import "dotenv/config";

// ============================================================================
// Required Environment Variables
// ============================================================================

const requiredEnvVars = [
  "AWS_REGION",
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "AWS_SQS_QUEUE_URL",
  "AWS_BUCKET_NAME",
  "DB_WORKER_URL",
] as const;

// Validate required env vars
const missingEnvVars = requiredEnvVars.filter((envVar) => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  throw new Error(
    `Missing required environment variables: ${missingEnvVars.join(", ")}`,
  );
}

// ============================================================================
// Configuration Object
// ============================================================================

/**
 * Typed configuration object with all environment variables
 */
export const config = {
  // AWS Configuration
  aws: {
    region: process.env.AWS_REGION!,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    sqsQueueUrl: process.env.AWS_SQS_QUEUE_URL!,
    bucketName: process.env.AWS_BUCKET_NAME!,
  },

  // Database Worker Configuration
  dbWorker: {
    url: process.env.DB_WORKER_URL!,
  },

  // OpenAI Model Configuration (with defaults)
  models: {
    heuristicEvaluation: process.env.HE_EVAL_MODEL || "gpt-5-mini-2025-08-07",
    cognitiveWalkthrough: process.env.CW_MODEL || "gpt-5-mini-2025-08-07",
    persona: process.env.PERSONA_MODEL || "gpt-5.2-2025-12-11",
    deduplication: process.env.DEDUPE_MODEL || "gpt-5.2-2025-12-11",
    qualitativeAnalysis:
      process.env.QUALITATIVE_ANALYSIS_MODEL || "gpt-5.2-2025-12-11",
  },

  // Processing Configuration (with defaults)
  processing: {
    heEvalConcurrency: Number(process.env.HE_EVAL_CONCURRENCY || 3),
    heMaxAttempts: Number(process.env.HE_MAX_ATTEMPTS || 3),
    cwMaxAttempts: Number(process.env.CW_MAX_ATTEMPTS || 3),
    presignedUrlExpiry: 3600, // 1 hour in seconds
  },

  // SQS Configuration
  sqs: {
    maxNumberOfMessages: 1,
    waitTimeSeconds: 20, // Long polling
    visibilityTimeout: 1 * 60 * 60, // 1 hour
  },
} as const;

// Export type for the config object
export type Config = typeof config;
