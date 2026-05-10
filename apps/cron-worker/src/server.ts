/**
 * Cron Worker
 *
 * Runs scheduled jobs internally — no external cron scheduler required.
 * Uses node-cron to trigger the interview reminder/expiry job daily.
 */

import cron from "node-cron";
import { config } from "./config.ts";
import { logger } from "@/apps/shared/logger.ts";

const JOB_NAME = "interview-reminders";

async function runInterviewReminders(): Promise<void> {
  const url = `${config.nextjsAppUrl}/api/cron/interview-reminders`;

  logger.info(`Running job: ${JOB_NAME}`);

  let response: Response;
  try {
    response = await fetch(url, {
      method: "GET",
      headers: {
        "x-cron-secret": config.cronSecret,
      },
    });
  } catch (err) {
    logger.error(err, `Job ${JOB_NAME} failed: network error`);
    return;
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "(unreadable)");
    logger.error(
      { status: response.status, body },
      `Job ${JOB_NAME} failed: HTTP ${response.status}`,
    );
    return;
  }

  const result = await response.json().catch(() => null);
  logger.info({ result }, `Job ${JOB_NAME} completed`);
}

// Schedule the job
const task = cron.schedule(config.schedule, () => {
  runInterviewReminders().catch((err) => {
    logger.error(err, `Unhandled error in job ${JOB_NAME}`);
  });
});

logger.info(
  { schedule: config.schedule },
  `Cron worker started. Job "${JOB_NAME}" scheduled.`,
);

// Graceful shutdown
function shutdown(signal: string) {
  logger.info(`Received ${signal}, stopping cron worker`);
  task.stop();
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
