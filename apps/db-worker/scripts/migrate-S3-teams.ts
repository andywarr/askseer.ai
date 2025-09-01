/*
 * Migration Script: Move S3 study keys from user-based to team-based prefix
 * From: studies/{userId}/{studyId}/...
 * To:   studies/{teamId}/{studyId}/...
 *
 * PURPOSE
 *   Copies (and optionally deletes) S3 objects whose keys start with the legacy
 *   user-based studies prefix into the new team-based prefix, then updates the
 *   corresponding `file.key` column in the database.
 *
 * SAFETY / DEFAULTS
 *   - DRY_RUN defaults to true (no S3 copy, no DB writes). Set DRY_RUN=false
 *     to actually perform the migration.
 *   - DELETE_OLD defaults to false (source objects are retained). Only enable after
 *     verifying the new objects are copied correctly.
 *   - By default, if the legacy segment (2nd path part) doesn't match study.createdByUserId
 *     we will log a mismatch and SKIP the row. Set OVERRIDE_MISMATCH=true to force migration.
 *
 * PREREQUISITES
 *   1. Database accessible with env vars your Prisma client expects (e.g. DATABASE_URL).
 *   2. AWS credentials (AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY or role) with permission for:
 *      s3:GetObject, s3:HeadObject, s3:CopyObject, s3:DeleteObject (if deleting).
 *   3. Environment variables: AWS_REGION and either AWS_BUCKET or AWS_BUCKET_NAME.
 *
 * ENVIRONMENT VARIABLES (all optional unless noted)
 *   AWS_REGION                   (required) e.g. us-east-1
 *   AWS_BUCKET | AWS_BUCKET_NAME (required) target bucket name
 *   DRY_RUN=true|false           If true (default) only logs planned actions
 *   DELETE_OLD=true|false        If true deletes old object after successful copy (default false)
 *   STOP_ON_ERROR=true|false     If true aborts entire run on first failure (default false)
 *   OVERRIDE_MISMATCH=true|false Allow migration when legacy userId != study.createdByUserId
 *   BATCH_SIZE=number            DB batch size (default 200)
 *   ONLY_STUDY_ID=<id>           If set, restricts migration to a single study id
 *
 * EXECUTION (from apps/db-worker/ directory)
 *   # Dry run (recommended first)
 *   DRY_RUN=true npx ts-node --project tsconfig.json scripts/migrate-studies-user-to-team.ts
 *
 *   # Actual migration without deleting old objects
 *   DRY_RUN=false npx ts-node --project tsconfig.json scripts/migrate-studies-user-to-team.ts
 *
 *   # Actual migration AND delete old objects after successful copy
 *   DRY_RUN=false DELETE_OLD=true npx ts-node --project tsconfig.json scripts/migrate-studies-user-to-team.ts
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
const DRY_RUN = (process.env.DRY_RUN ?? "true").toLowerCase() !== "false";
const DELETE_OLD = (process.env.DELETE_OLD ?? "false").toLowerCase() === "true";
const STOP_ON_ERROR = (process.env.STOP_ON_ERROR ?? "false").toLowerCase() === "true";
const OVERRIDE_MISMATCH = (process.env.OVERRIDE_MISMATCH ?? "false").toLowerCase() === "true";
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || "200", 10);
const ONLY_STUDY_ID = process.env.ONLY_STUDY_ID;
const AWS_REGION = process.env.AWS_REGION!;
const BUCKET = process.env.AWS_BUCKET || process.env.AWS_BUCKET_NAME!;

if (!AWS_REGION) throw new Error("AWS_REGION not set");
if (!BUCKET) throw new Error("AWS_BUCKET or AWS_BUCKET_NAME not set");

const s3 = new S3Client({ region: AWS_REGION });

interface MigrationResult {
  total: number; // total File rows considered (filtered by ONLY_STUDY_ID if set)
  examined: number; // rows inspected in this run
  migrated: number; // rows migrated (or would migrate in DRY_RUN)
  skipped: number; // non-legacy keys or already team-based
  failed: number; // errors copying/deleting/updating
  deleted: number; // old S3 objects deleted
  mismatches: number; // legacy segment didn't match study.createdByUserId
}

// Match keys like: studies/{segment}/{studyId}/...
const STUDIES_KEY_REGEX = /^studies\/([^/]+)\/([^/]+)\/(.+)$/;

function parseStudiesKey(key: string): { legacySegment: string; studyId: string; rest: string } | null {
  const m = key.match(STUDIES_KEY_REGEX);
  if (!m) return null;
  return { legacySegment: m[1], studyId: m[2], rest: m[3] };
}

async function objectExists(key: string): Promise<boolean> {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    return true;
  } catch {
    return false;
  }
}

async function fetchBatch(cursor?: string, take: number = BATCH_SIZE) {
  return prisma.file.findMany({
    take,
    skip: cursor ? 1 : 0,
    ...(cursor && { cursor: { id: cursor } }),
    orderBy: { id: "asc" },
    where: {
      ...(ONLY_STUDY_ID ? { studyId: ONLY_STUDY_ID } : {}),
      key: { startsWith: "studies/" },
    },
    include: {
      study: { select: { id: true, teamId: true, createdByUserId: true } },
    },
  });
}

async function run() {
  const total = await prisma.file.count({
    where: { ...(ONLY_STUDY_ID ? { studyId: ONLY_STUDY_ID } : {}), key: { startsWith: "studies/" } },
  });

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
    `[MIGRATION] Start (studies user->team). Files: ${total}. DRY_RUN=${DRY_RUN} DELETE_OLD=${DELETE_OLD} ONLY_STUDY_ID=${ONLY_STUDY_ID ?? "<all>"}`,
  );

  let cursor: string | undefined = undefined;
  while (true) {
    const batch = await fetchBatch(cursor, BATCH_SIZE);
    if (batch.length === 0) break;
    for (const f of batch) {
      result.examined++;
      cursor = f.id; // advance cursor

      const currentKey = f.key;
      const parsed = parseStudiesKey(currentKey);
      if (!parsed) {
        // Not a studies key or not in expected shape
        result.skipped++;
        continue;
      }

      const { legacySegment, studyId, rest } = parsed;
      const expectedTeam = f.study.teamId;

      if (legacySegment === expectedTeam) {
        // Already migrated to team-based prefix
        result.skipped++;
        continue;
      }

      // Optional safety: ensure the legacy segment matches study.createdByUserId
      if (legacySegment !== f.study.createdByUserId) {
        result.mismatches++;
        const msg = `[WARN] Legacy segment != study.createdByUserId for fileId=${f.id} studyId=${f.study.id} key=${currentKey}`;
        if (!OVERRIDE_MISMATCH) {
          console.warn(`${msg} -> skipping (set OVERRIDE_MISMATCH=true to force).`);
          result.skipped++;
          continue;
        } else {
          console.warn(`${msg} -> proceeding due to OVERRIDE_MISMATCH=true.`);
        }
      }

      // Build new key by replacing the segment right after "studies/"
      const newKey = `studies/${expectedTeam}/${studyId}/${rest}`;

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
          if (STOP_ON_ERROR) throw new Error("Stopping due to missing source object");
          continue;
        }

        const encodedSourceKey = encodeURIComponent(currentKey).replace(/%2F/g, "/");
        await s3.send(
          new CopyObjectCommand({
            Bucket: BUCKET,
            Key: newKey,
            CopySource: `${BUCKET}/${encodedSourceKey}`,
            MetadataDirective: "COPY",
          }),
        );

        if (DELETE_OLD) {
          await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: currentKey }));
          result.deleted++;
        }

        await prisma.file.update({ where: { id: f.id }, data: { key: newKey } });
        console.log(`[OK] Migrated ${currentKey} -> ${newKey}`);
        result.migrated++;
      } catch (e: any) {
        console.error(`[ERROR] Failed migrating ${currentKey}: ${e?.message || e}`);
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
