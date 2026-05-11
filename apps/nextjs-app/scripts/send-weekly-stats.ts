/**
 * Script: Send Weekly Usage Stats Email
 *
 * This script sends an email summarizing key usage stats over the last 7 days.
 *
 * SAFETY
 *   - Dry run supported via DRY_RUN env (default true) -> logs what would happen
 *
 * USAGE (from apps/nextjs-app/ directory)
 *   npm run email:weekly-stats        # dry run (default)
 *   DRY_RUN=false npm run email:weekly-stats   # execute
 *
 * REQUIRED ENV VARS
 *   - DATABASE_URL: Prisma database connection string
 *   - AUTH_RESEND_KEY: Resend API key for sending emails
 *   - AUTH_RESEND_FROM: From email address (e.g., "Seer <noreply@askseer.ai>")
 *
 * OPTIONAL ENV VARS
 *   - WEEKLY_STATS_EMAIL: Destination email for the weekly report (defaults to warr@askseer.ai)
 */

import * as dotenv from "dotenv";
import * as path from "path";

// Load .env.local file (Next.js convention)
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });
// Also try .env as fallback
dotenv.config({ path: path.resolve(__dirname, "../.env") });

import { Resend } from "resend";
import { PrismaClient } from "@prisma/client";
import { format } from "date-fns";
import {
  createStyledEmailHtml,
  generateWeeklyStatsHtml,
  generateWeeklyStatsText,
} from "../lib/integrations/email-templates";

const prisma = new PrismaClient();

// Email configuration
const RESEND_API_KEY = process.env.AUTH_RESEND_KEY;
const FROM_EMAIL =
  process.env.AUTH_RESEND_FROM || "Seer <notifications@mail.askseer.ai>";
const TO_EMAIL = process.env.WEEKLY_STATS_EMAIL || "warr@askseer.ai";

async function run() {
  const DRY_RUN = (process.env.DRY_RUN ?? "true").toLowerCase() !== "false";

  console.log("\n=== Weekly Stats Email Script ===\n");
  console.log(
    `Mode: ${DRY_RUN ? "DRY RUN (no emails will be sent)" : "LIVE (emails will be sent)"}`,
  );
  console.log(`From: ${FROM_EMAIL}`);
  console.log(`To: ${TO_EMAIL}\n`);

  if (!RESEND_API_KEY && !DRY_RUN) {
    console.error(
      "ERROR: AUTH_RESEND_KEY environment variable is required for sending emails",
    );
    process.exit(1);
  }

  const resend = new Resend(RESEND_API_KEY);

  // Calculate the date range
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - 7);

  console.log(
    `Fetching stats from ${startDate.toISOString()} to ${endDate.toISOString()}...\n`,
  );

  // Query DB for stats
  const [newStudies, newUsers, newTeams, newCompanies] = await Promise.all([
    prisma.study.count({
      where: {
        createdAt: {
          gte: startDate,
          lt: endDate,
        },
      },
    }),
    prisma.user.count({
      where: {
        createdAt: {
          gte: startDate,
          lt: endDate,
        },
      },
    }),
    prisma.team.count({
      where: {
        createdAt: {
          gte: startDate,
          lt: endDate,
        },
      },
    }),
    prisma.company.count({
      where: {
        createdAt: {
          gte: startDate,
          lt: endDate,
        },
      },
    }),
  ]);

  const stats = {
    startDate: format(startDate, "MMM d, yyyy"),
    endDate: format(endDate, "MMM d, yyyy"),
    newStudies,
    newUsers,
    newTeams,
    newCompanies,
  };

  console.log("Stats calculated:");
  console.log(stats);
  console.log();

  const subject = `Seer Weekly Usage Stats (${stats.startDate} - ${stats.endDate})`;

  const contentHtml = generateWeeklyStatsHtml(stats);
  const html = createStyledEmailHtml({
    title: "Weekly Usage Stats",
    subtitle: "Your weekly summary of Seer's platform usage",
    content: contentHtml,
    showFooter: true,
  });

  const text = generateWeeklyStatsText(stats);

  if (DRY_RUN) {
    console.log("[DRY RUN] Would send the following email:");
    console.log(`To: ${TO_EMAIL}`);
    console.log(`Subject: ${subject}`);
    console.log(`\nText Content:\n${text}`);
    console.log("\n[DRY RUN] To send emails for real, run with DRY_RUN=false");
    return;
  }

  console.log("Sending email...");

  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [TO_EMAIL],
      subject,
      html,
      text,
    });

    if (error) {
      console.error(`❌ Failed to send email: ${error.message}`);
      process.exit(1);
    } else {
      console.log(`✓ Successfully sent weekly stats email to ${TO_EMAIL}`);
    }
  } catch (err: any) {
    console.error(`❌ Error sending email: ${err.message}`);
    process.exit(1);
  }

  console.log("\n=== Done ===\n");
}

run()
  .catch((e) => {
    console.error("[ERROR]", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
