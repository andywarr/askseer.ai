/**
 * Centralized configuration and environment variable validation
 * All env vars are validated at module load time
 */

import "dotenv/config";

// ============================================================================
// Required Environment Variables
// ============================================================================

const requiredEnvVars = ["NEXTJS_APP_URL", "CRON_SECRET"] as const;

const missingEnvVars = requiredEnvVars.filter((envVar) => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  throw new Error(
    `Missing required environment variables: ${missingEnvVars.join(", ")}`,
  );
}

// ============================================================================
// Configuration Object
// ============================================================================

export const config = {
  nextjsAppUrl: process.env.NEXTJS_APP_URL!,
  cronSecret: process.env.CRON_SECRET!,
  // Cron schedule — default: 8am daily (server local time)
  schedule: process.env.CRON_SCHEDULE ?? "0 8 * * *",
};
