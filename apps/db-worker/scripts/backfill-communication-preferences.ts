/*
 * Backfill Script: Create default CommunicationPreferences rows for existing users
 * that predate the createUser event hook.
 *
 * STRATEGY
 *   - Find all users without a related CommunicationPreferences row
 *   - Insert one row per user relying on Prisma schema defaults (all true)
 *
 * SAFETY
 *   - Dry run supported via DRY_RUN env (default true) -> logs what would happen
 *   - Idempotent: uses createMany + skipDuplicates
 *
 * USAGE (from apps/db-worker/ directory)
 *   DRY_RUN=true  npx ts-node --project tsconfig.json scripts/backfill-communication-preferences.ts   # dry run
 *   DRY_RUN=false npx ts-node --project tsconfig.json scripts/backfill-communication-preferences.ts   # execute
 */
import * as dotenv from "dotenv";
dotenv.config();

import prisma from "../src/services/db";

async function run() {
  const DRY_RUN = (process.env.DRY_RUN ?? "true").toLowerCase() !== "false"; // default true

  const users = await prisma.user.findMany({
    where: { communicationPreferences: null },
    select: { id: true },
  });

  if (!users.length) {
    console.log("[BACKFILL] No users require communication preferences backfill.");
    return;
  }

  console.log(`{BACKFILL} Users needing rows: ${users.length}`);

  if (DRY_RUN) {
    console.log("[BACKFILL][DRY_RUN] Would create CommunicationPreferences rows for userIds:");
    console.log(users.map(u => u.id));
    return;
  }

  const batchSize = 500; // createMany limit safeguard
  let created = 0;

  for (let i = 0; i < users.length; i += batchSize) {
    const slice = users.slice(i, i + batchSize);
    const result = await prisma.communicationPreferences.createMany({
      data: slice.map(u => ({ userId: u.id })), // rely on defaults
      skipDuplicates: true,
    });
    created += result.count;
    console.log(`[BACKFILL] Inserted batch ${i / batchSize + 1} (+${result.count})`);
  }

  console.log(`[BACKFILL] Done. Rows created: ${created}`);
}

run()
  .catch((e) => {
    console.error("[BACKFILL][ERROR]", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
