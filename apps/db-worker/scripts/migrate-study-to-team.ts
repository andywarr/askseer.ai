/*
 * Migration Script: Move a study from one team to another
 * Updates study.teamId and migrates all associated S3 files
 *
 * PURPOSE
 *   Transfers a study (and all its S3 files) from one team to another.
 *   - Updates the study's teamId in the database
 *   - Copies all study files from studies/{oldTeamId}/{studyId}/... to studies/{newTeamId}/{studyId}/...
 *   - Updates the file.key column in the database for all associated files
 *   - Optionally deletes old S3 objects after successful migration
 *
 * SAFETY / DEFAULTS
 *   - DRY_RUN defaults to true (no S3 copy, no DB writes). Set DRY_RUN=false to perform migration.
 *   - DELETE_OLD defaults to false (source objects are retained). Enable after verifying migration.
 *   - STOP_ON_ERROR defaults to false. Set to true to abort on first failure.
 *
 * PREREQUISITES
 *   1. Database accessible with env vars your Prisma client expects (DATABASE_URL).
 *   2. AWS credentials (AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY) with permissions:
 *      s3:GetObject, s3:HeadObject, s3:CopyObject, s3:DeleteObject (if deleting).
 *   3. Environment variables: AWS_REGION and AWS_BUCKET_NAME or AWS_BUCKET.
 *
 * REQUIRED ENVIRONMENT VARIABLES
 *   STUDY_ID=<study_id>          (required) The study to migrate
 *   NEW_TEAM_ID=<team_id>        (required) The target team ID
 *   AWS_REGION                   (required) e.g. us-east-1
 *   AWS_BUCKET | AWS_BUCKET_NAME (required) S3 bucket name
 *
 * OPTIONAL ENVIRONMENT VARIABLES
 *   DRY_RUN=true|false           If true (default) only logs planned actions
 *   DELETE_OLD=true|false        If true deletes old S3 objects after successful copy (default false)
 *   STOP_ON_ERROR=true|false     If true aborts on first failure (default false)
 *
 * EXECUTION (from apps/db-worker/ directory)
 *   # Dry run (recommended first)
 *   STUDY_ID=<id> NEW_TEAM_ID=<team_id> DRY_RUN=true npx ts-node --project tsconfig.json scripts/migrate-study-to-team.ts
 *
 *   # Actual migration without deleting old objects
 *   STUDY_ID=<id> NEW_TEAM_ID=<team_id> DRY_RUN=false npx ts-node --project tsconfig.json scripts/migrate-study-to-team.ts
 *
 *   # Actual migration AND delete old objects after successful copy
 *   STUDY_ID=<id> NEW_TEAM_ID=<team_id> DRY_RUN=false DELETE_OLD=true npx ts-node --project tsconfig.json scripts/migrate-study-to-team.ts
 */
import * as dotenv from "dotenv";
dotenv.config();

import {
  S3Client,
  CopyObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import prisma from "../src/services/db";

// ---------------- Configuration ----------------
const STUDY_ID = process.env.STUDY_ID;
const NEW_TEAM_ID = process.env.NEW_TEAM_ID;
const DRY_RUN = (process.env.DRY_RUN ?? "true").toLowerCase() !== "false";
const DELETE_OLD = (process.env.DELETE_OLD ?? "false").toLowerCase() === "true";
const STOP_ON_ERROR =
  (process.env.STOP_ON_ERROR ?? "false").toLowerCase() === "true";
const AWS_REGION = process.env.AWS_REGION!;
const BUCKET = process.env.AWS_BUCKET || process.env.AWS_BUCKET_NAME!;

// Validation
if (!STUDY_ID) throw new Error("STUDY_ID environment variable is required");
if (!NEW_TEAM_ID)
  throw new Error("NEW_TEAM_ID environment variable is required");
if (!AWS_REGION) throw new Error("AWS_REGION not set");
if (!BUCKET) throw new Error("AWS_BUCKET or AWS_BUCKET_NAME not set");

const s3 = new S3Client({ region: AWS_REGION });

interface MigrationResult {
  studyId: string;
  oldTeamId: string;
  newTeamId: string;
  totalFiles: number;
  migratedFiles: number;
  failedFiles: number;
  deletedFiles: number;
  skippedFiles: number;
  studyUpdated: boolean;
}

// Match keys like: studies/{teamId}/{studyId}/...
const STUDIES_KEY_REGEX = /^studies\/([^/]+)\/([^/]+)\/(.+)$/;

function parseStudiesKey(
  key: string
): { teamId: string; studyId: string; rest: string } | null {
  const m = key.match(STUDIES_KEY_REGEX);
  if (!m) return null;
  return { teamId: m[1], studyId: m[2], rest: m[3] };
}

async function objectExists(key: string): Promise<boolean> {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    return true;
  } catch {
    return false;
  }
}

async function run() {
  console.log(
    `[MIGRATION] Starting study team migration. STUDY_ID=${STUDY_ID} NEW_TEAM_ID=${NEW_TEAM_ID} DRY_RUN=${DRY_RUN} DELETE_OLD=${DELETE_OLD}`
  );

  // Fetch the study
  const study = await prisma.study.findUnique({
    where: { id: STUDY_ID },
    include: { files: true },
  });

  if (!study) {
    throw new Error(`Study not found: ${STUDY_ID}`);
  }

  const oldTeamId = study.teamId;

  if (!oldTeamId) {
    throw new Error(`Study ${STUDY_ID} has no teamId set`);
  }

  if (oldTeamId === NEW_TEAM_ID) {
    console.log(
      `[INFO] Study ${STUDY_ID} is already assigned to team ${NEW_TEAM_ID}. Nothing to do.`
    );
    process.exit(0);
  }

  // Verify new team exists
  const newTeam = await prisma.team.findUnique({
    where: { id: NEW_TEAM_ID },
  });

  if (!newTeam) {
    throw new Error(`Target team not found: ${NEW_TEAM_ID}`);
  }

  const result: MigrationResult = {
    studyId: STUDY_ID!,
    oldTeamId,
    newTeamId: NEW_TEAM_ID!,
    totalFiles: study.files.length,
    migratedFiles: 0,
    failedFiles: 0,
    deletedFiles: 0,
    skippedFiles: 0,
    studyUpdated: false,
  };

  console.log(
    `[INFO] Study "${study.name || study.id}" found with ${study.files.length} files.`
  );
  console.log(`[INFO] Old team: ${oldTeamId}`);
  console.log(`[INFO] New team: ${NEW_TEAM_ID} (${newTeam.name})`);

  // Process each file
  for (const file of study.files) {
    const currentKey = file.key;
    const parsed = parseStudiesKey(currentKey);

    if (!parsed) {
      console.warn(
        `[WARN] File ${file.id} has key that doesn't match expected pattern: ${currentKey}`
      );
      result.skippedFiles++;
      continue;
    }

    const { teamId, studyId, rest } = parsed;

    // Verify the file key matches the old team ID
    if (teamId !== oldTeamId) {
      console.warn(
        `[WARN] File ${file.id} has teamId "${teamId}" in key, but study has teamId "${oldTeamId}". Skipping.`
      );
      result.skippedFiles++;
      continue;
    }

    // Verify the file key matches the study ID
    if (studyId !== STUDY_ID) {
      console.warn(
        `[WARN] File ${file.id} has studyId "${studyId}" in key, but expected "${STUDY_ID}". Skipping.`
      );
      result.skippedFiles++;
      continue;
    }

    // Build new key
    const newKey = `studies/${NEW_TEAM_ID}/${studyId}/${rest}`;

    if (DRY_RUN) {
      console.log(
        `[DRY_RUN] Would migrate file ${file.id}: ${currentKey} -> ${newKey}`
      );
      result.migratedFiles++;
      continue;
    }

    try {
      // Check if source exists
      const exists = await objectExists(currentKey);
      if (!exists) {
        console.error(
          `[ERROR] Source S3 object missing for file ${file.id}: ${currentKey}`
        );
        result.failedFiles++;
        if (STOP_ON_ERROR)
          throw new Error(
            `Stopping due to missing source object: ${currentKey}`
          );
        continue;
      }

      // Copy to new location
      const encodedSourceKey = encodeURIComponent(currentKey).replace(
        /%2F/g,
        "/"
      );
      await s3.send(
        new CopyObjectCommand({
          Bucket: BUCKET,
          Key: newKey,
          CopySource: `${BUCKET}/${encodedSourceKey}`,
          MetadataDirective: "COPY",
        })
      );

      // Delete old object if requested
      if (DELETE_OLD) {
        await s3.send(
          new DeleteObjectCommand({ Bucket: BUCKET, Key: currentKey })
        );
        result.deletedFiles++;
      }

      // Update file record
      await prisma.file.update({
        where: { id: file.id },
        data: { key: newKey },
      });

      console.log(`[OK] Migrated file ${file.id}: ${currentKey} -> ${newKey}`);
      result.migratedFiles++;
    } catch (e: any) {
      console.error(
        `[ERROR] Failed to migrate file ${file.id} (${currentKey}): ${e?.message || e}`
      );
      result.failedFiles++;
      if (STOP_ON_ERROR) throw e;
    }
  }

  // Update study teamId
  if (!DRY_RUN) {
    try {
      await prisma.study.update({
        where: { id: STUDY_ID },
        data: { teamId: NEW_TEAM_ID },
      });
      result.studyUpdated = true;
      console.log(
        `[OK] Updated study ${STUDY_ID} teamId: ${oldTeamId} -> ${NEW_TEAM_ID}`
      );
    } catch (e: any) {
      console.error(
        `[ERROR] Failed to update study teamId: ${e?.message || e}`
      );
      if (STOP_ON_ERROR) throw e;
    }
  } else {
    console.log(
      `[DRY_RUN] Would update study ${STUDY_ID} teamId: ${oldTeamId} -> ${NEW_TEAM_ID}`
    );
  }

  console.log("\n[MIGRATION] Complete:");
  console.log(JSON.stringify(result, null, 2));

  if (result.failedFiles > 0) {
    console.error(
      `\n[WARNING] ${result.failedFiles} file(s) failed to migrate. Review logs above.`
    );
    process.exit(1);
  }

  if (DRY_RUN) {
    console.log(
      "\n[INFO] This was a dry run. No changes were made. Run with DRY_RUN=false to perform the migration."
    );
  }
}

run()
  .catch((e) => {
    console.error("[FATAL] Migration aborted:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
