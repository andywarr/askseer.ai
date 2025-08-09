/*
 * Migration Script: Restructure S3 file keys and update database
 * From: {userId}/{uuid}.{ext}
 * To:   studies/{userId}/{studyId}/uploads/{uuid}.{ext}
 *
 * PURPOSE
 *   Copies (and optionally deletes) S3 objects whose keys follow the old flat pattern
 *   into the new hierarchical studies/ path, then updates the corresponding `file.key`
 *   column in the database.
 *
 * SAFETY / DEFAULTS
 *   - DRY_RUN defaults to true (no S3 copy, no DB writes). You MUST set DRY_RUN=false
 *     to actually perform the migration.
 *   - DELETE_OLD defaults to false (source objects are retained). Only enable after
 *     verifying the new objects are copied correctly.
 *   - By default userId mismatches between the existing key prefix and the owning study
 *     will SKIP the row. Set OVERRIDE_USER_MISMATCH=true to force migration anyway.
 *
 * PREREQUISITES
 *   1. Database accessible with environment variables your prisma client expects
 *      (e.g. DATABASE_URL, etc.).
 *   2. AWS credentials (AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY or role) with
 *      permission for: s3:GetObject, s3:HeadObject, s3:CopyObject, s3:DeleteObject (if deleting).
 *   3. Environment variables: AWS_REGION and either AWS_BUCKET or AWS_BUCKET_NAME.
 *
 * ENVIRONMENT VARIABLES (all optional unless noted)
 *   AWS_REGION                (required) e.g. us-east-1
 *   AWS_BUCKET | AWS_BUCKET_NAME (required) target bucket name
 *   DRY_RUN=true|false        If true (default) only logs planned actions
 *   DELETE_OLD=true|false     If true deletes old object after successful copy (default false)
 *   STOP_ON_ERROR=true|false  If true aborts entire run on first failure (default false)
 *   OVERRIDE_USER_MISMATCH=true|false Allow migration when derived key userId != study.userId
 *   BATCH_SIZE=number         DB batch size (default 100)
 *
 * EXECUTION (from apps/db-worker/ directory)
 *   # Dry run (recommended first pass)
 *   DRY_RUN=true npx ts-node --project tsconfig.json scripts/migrate-file-keys.ts
 *
 *   # Actual migration without deleting old objects
 *   DRY_RUN=false npx ts-node --project tsconfig.json scripts/migrate-file-keys.ts
 *
 *   # Actual migration AND delete old objects after successful copy
 *   DRY_RUN=false DELETE_OLD=true npx ts-node --project tsconfig.json scripts/migrate-file-keys.ts
 *
 *   # Continue even if userId prefix does not match study.userId
 *   DRY_RUN=false OVERRIDE_USER_MISMATCH=true npx ts-node --project tsconfig.json scripts/migrate-file-keys.ts
 *
 *   # Stop immediately on first error
 *   DRY_RUN=false STOP_ON_ERROR=true npx ts-node --project tsconfig.json scripts/migrate-file-keys.ts
 *
 * MONITORING
 *   The script prints a final JSON summary with counts: total, examined, migrated, skipped,
 *   failed, deleted, mismatches.
 *
 * ROLLBACK STRATEGY
 *   Because this copies (not moves) unless DELETE_OLD=true, you can re-run after adjusting
 *   logic. If you enabled DELETE_OLD and need to rollback you would have to reconstruct
 *   the old key naming (userId/filename) and copy objects back manually.
 *
 * NOTE
 *   The script intentionally does individual copy operations (not multi-copy) to remain
 *   simple and observable. Consider increasing BATCH_SIZE for faster DB iteration if needed.
 */
import * as dotenv from "dotenv";
dotenv.config();

import {
  S3Client,
  CopyObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import prisma from "../src/services/db";

// ---------------- Configuration ----------------
const DRY_RUN = (process.env.DRY_RUN ?? "true").toLowerCase() !== "false";
const DELETE_OLD = (process.env.DELETE_OLD ?? "false").toLowerCase() === "true";
const STOP_ON_ERROR =
  (process.env.STOP_ON_ERROR ?? "false").toLowerCase() === "true";
const OVERRIDE_USER_MISMATCH =
  (process.env.OVERRIDE_USER_MISMATCH ?? "false").toLowerCase() === "true";
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || "100", 10);
const AWS_REGION = process.env.AWS_REGION!;
const BUCKET = process.env.AWS_BUCKET || process.env.AWS_BUCKET_NAME!;

if (!AWS_REGION) throw new Error("AWS_REGION not set");
if (!BUCKET) throw new Error("AWS_BUCKET or AWS_BUCKET_NAME not set");

const s3 = new S3Client({ region: AWS_REGION });

interface MigrationResult {
  total: number;
  examined: number;
  migrated: number; // actually migrated (or would migrate in dry-run)
  skipped: number; // already migrated or not matching pattern
  failed: number; // errors
  deleted: number; // old objects deleted
  mismatches: number; // userId mismatches encountered
}

// Old pattern: {userId}/{uuid}.{ext}
const OLD_KEY_REGEX = /^[^\/]+\/[A-Za-z0-9-]+\.[A-Za-z0-9]+$/;

function isOldStyleKey(key: string): boolean {
  if (key.startsWith("studies/")) return false; // already migrated
  return OLD_KEY_REGEX.test(key);
}

async function objectExists(key: string): Promise<boolean> {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    return true;
  } catch (e: any) {
    if (e?.$metadata?.httpStatusCode === 404) return false;
    return false; // treat other errors as not existing for safety
  }
}

async function fetchBatch(cursor?: string, take: number = BATCH_SIZE) {
  return prisma.file.findMany({
    take,
    skip: cursor ? 1 : 0,
    ...(cursor && { cursor: { id: cursor } }),
    orderBy: { id: "asc" },
    include: { study: { select: { userId: true } } },
  });
}

async function run() {
  const total = await prisma.file.count();
  const result: MigrationResult = {
    total,
    examined: 0,
    migrated: 0,
    skipped: 0,
    failed: 0,
    deleted: 0,
    mismatches: 0,
  };

  console.log(
    `[MIGRATION] Start. File rows: ${total}. DRY_RUN=${DRY_RUN} DELETE_OLD=${DELETE_OLD}`
  );

  let cursor: string | undefined = undefined;

  while (true) {
    const batch = await fetchBatch(cursor, BATCH_SIZE);
    if (batch.length === 0) break;
    for (const f of batch) {
      result.examined++;
      cursor = f.id; // advance cursor

      const currentKey = f.key;
      if (!isOldStyleKey(currentKey)) {
        result.skipped++;
        continue;
      }

      const [derivedUserId, fileName] = currentKey.split("/");
      const studyUserId = f.study.userId;

      if (derivedUserId !== studyUserId) {
        result.mismatches++;
        const msg = `[WARN] UserId mismatch for fileId=${f.id} keyUser=${derivedUserId} studyUser=${studyUserId}`;
        if (!OVERRIDE_USER_MISMATCH) {
          console.warn(
            `${msg} -> skipping (set OVERRIDE_USER_MISMATCH=true to force).`
          );
          result.skipped++;
          continue;
        } else {
          console.warn(
            `${msg} -> proceeding due to OVERRIDE_USER_MISMATCH=true.`
          );
        }
      }

      const newKey = `studies/${studyUserId}/${f.studyId}/uploads/${fileName}`;

      if (DRY_RUN) {
        console.log(`[DRY_RUN] Would migrate ${currentKey} -> ${newKey}`);
        result.migrated++;
        continue;
      }

      try {
        const exists = await objectExists(currentKey);
        if (!exists) {
          console.error(`[ERROR] Source object missing: ${currentKey}`);
          result.failed++;
          if (STOP_ON_ERROR)
            throw new Error("Stopping due to missing source object");
          continue;
        }

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

        if (DELETE_OLD) {
          await s3.send(
            new DeleteObjectCommand({ Bucket: BUCKET, Key: currentKey })
          );
          result.deleted++;
        }

        await prisma.file.update({
          where: { id: f.id },
          data: { key: newKey },
        });
        console.log(`[OK] Migrated ${currentKey} -> ${newKey}`);
        result.migrated++;
      } catch (e: any) {
        console.error(`[ERROR] Failed migrating ${currentKey}: ${e.message}`);
        result.failed++;
        if (STOP_ON_ERROR) throw e;
      }
    }
  }

  console.log("[MIGRATION] Complete:\n" + JSON.stringify(result, null, 2));
}

run()
  .catch((e) => {
    console.error("[FATAL] Migration aborted", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
