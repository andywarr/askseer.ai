/*
 * Script: Retry a Failed Study
 *
 * What it does:
 *  - Fetches a study by ID from the database
 *  - Validates the study has valid jobData
 *  - Sends it back to the SQS queue with retry flag
 *  - Updates study status to PENDING
 *
 * Usage (from apps/nextjs-app/):
 *   STUDY_ID=<study-id> tsx scripts/retry-study.ts
 *
 *   Example:
 *   STUDY_ID=cm6abc123xyz tsx scripts/retry-study.ts
 *
 * Requirements:
 *  - Environment variables must be configured (same as running the app)
 *  - Database connection must be available
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { parseJobEnvelope } from "@/apps/shared/jobSchema";
import { PrismaClient } from "@prisma/client";

// Get study ID from environment
const STUDY_ID = process.env.STUDY_ID;

if (!STUDY_ID) {
  console.error("❌ ERROR: STUDY_ID environment variable is required");
  console.error("\nUsage: STUDY_ID=<study-id> tsx scripts/retry-study.ts");
  console.error("\nExample:");
  console.error("  STUDY_ID=cm6abc123xyz tsx scripts/retry-study.ts");
  process.exit(1);
}

const prisma = new PrismaClient();

async function main() {
  console.log(`\n🔄 Retrying study: ${STUDY_ID}\n`);

  try {
    // 1. First, fetch the study to verify it exists and show info
    console.log("📖 Fetching study from database...");
    const study = await prisma.study.findUnique({
      where: { id: STUDY_ID },
      include: {
        files: true,
        team: {
          select: {
            id: true,
            companyId: true,
          },
        },
      },
    });

    if (!study) {
      console.error(`❌ ERROR: Study not found with ID: ${STUDY_ID}`);
      process.exit(1);
    }

    console.log(`✅ Found study: ${study.name || "(unnamed)"}`);
    console.log(`   Type: ${study.type}`);
    console.log(`   Status: ${study.status}`);
    console.log(`   Attempts: ${study.attempts}`);
    console.log(`   Created by: ${study.createdByUserId}`);
    console.log(`   Team: ${study.teamId}`);

    // 2. Check if jobData exists
    if (!study.jobData) {
      console.error(`❌ ERROR: Study has no jobData to retry`);
      console.error(
        `   This study may have been created before jobData was stored.`,
      );
      process.exit(1);
    }

    console.log("\n🔍 Study has valid jobData");

    // 3. Reconstruct and validate the jobData
    console.log("\n📤 Preparing retry...");

    const stored = study.jobData as any;
    parseJobEnvelope(stored);

    // Reconstruct the jobData with retry flag
    const task = (study.type || "").toLowerCase();
    const base = stored?.payload || { files: study.files || [] };
    const companyId = stored?.companyId || study.team?.companyId || null;

    const jobData = {
      version: 2,
      studyId: study.id,
      userId: study.createdByUserId,
      teamId: study.teamId,
      companyId,
      type: task,
      payload:
        task === "heuristic_evaluation" && base?.heuristic
          ? { ...base, heuristic: base.heuristic.toUpperCase() }
          : base,
      retry: true, // This flag prevents credit refund on failure
    };

    // Validate the reconstructed jobData
    parseJobEnvelope(jobData);
    console.log("✅ jobData validated");

    // Send to SQS queue
    const sqsClient = new SQSClient({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });

    const params = {
      QueueUrl: process.env.AWS_SQS_QUEUE_URL!,
      MessageBody: JSON.stringify(jobData),
    };

    const command = new SendMessageCommand(params);
    const response = await sqsClient.send(command);

    console.log(`✅ Job sent to queue successfully`);
    console.log(`   Message ID: ${response.MessageId}`);

    // Update study status and increment attempts
    console.log("\n💾 Updating study in database...");
    await prisma.study.update({
      where: { id: STUDY_ID },
      data: {
        status: "PENDING",
        attempts: study.attempts + 1,
        updatedAt: new Date(),
      },
    });

    console.log(
      `✅ Study updated: status set to PENDING, attempts: ${study.attempts} → ${study.attempts + 1}`,
    );

    // Success!
    console.log("\n✨ Study retry complete!");
    console.log(
      "   The study is now being processed. Check the status in a few moments.",
    );
    console.log(`   Study ID: ${STUDY_ID}\n`);
  } catch (error) {
    console.error(
      "\n❌ ERROR:",
      error instanceof Error ? error.message : String(error),
    );
    if (error instanceof Error && error.stack) {
      console.error("\nStack trace:");
      console.error(error.stack);
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
