/*
 * Migration Script: Convert credit-based system to cent-based balance system
 *
 * PURPOSE
 *   This script converts existing credit balances and ledger entries from the
 *   old integer-credit system to the new cent-based balance system.
 *
 *   Old system: 1 credit = 1 study, credits stored as integer count
 *   New system: balanceCents stored as integer cents, study costs $4.99 (personal) or $19.99 (company)
 *
 *   Conversion: Each existing credit is converted to its dollar-equivalent in cents.
 *     - Personal team credits: credit × 499 cents ($4.99)
 *     - Company team credits:  credit × 1999 cents ($19.99)
 *
 *   The script also converts CreditLedger.delta values to BalanceLedger.amountCents values
 *   using the same per-credit rate.
 *
 * PREREQUISITES
 *   Run the Prisma migration FIRST to rename columns/tables:
 *     - Team.credits → Team.balanceCents
 *     - CreditLedger → BalanceLedger
 *     - CreditLedger.delta → BalanceLedger.amountCents
 *
 *   After the schema migration, the column values still contain old credit integers.
 *   This script converts those integers to cent values.
 *
 * SAFETY
 *   - DRY_RUN defaults to true. No writes unless DRY_RUN=false.
 *   - Processes teams in batches.
 *   - Logs every conversion for auditability.
 *
 * PARAMETERS (env)
 *   DRY_RUN=true|false            Default true; when false, applies changes.
 *   BATCH_SIZE=number             Default 100
 *   PERSONAL_RATE=number          Cents per credit for personal teams (default 499)
 *   COMPANY_RATE=number           Cents per credit for company teams (default 1999)
 *
 * EXECUTION
 *   # Dry run
 *   DRY_RUN=true npx tsx scripts/migrate-credits-to-balance.ts
 *   # Apply
 *   DRY_RUN=false npx tsx scripts/migrate-credits-to-balance.ts
 */
import * as dotenv from "dotenv";
dotenv.config();

import prisma from "../src/services/db";

const DRY_RUN = (process.env.DRY_RUN ?? "true").toLowerCase() !== "false";
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || "100", 10);
const PERSONAL_RATE = parseInt(process.env.PERSONAL_RATE || "499", 10);
const COMPANY_RATE = parseInt(process.env.COMPANY_RATE || "1999", 10);

async function migrateTeamBalances() {
  const totalTeams = await prisma.team.count();
  console.log(
    `[MIGRATE BALANCE] Start. Teams=${totalTeams}. DRY_RUN=${DRY_RUN} PERSONAL_RATE=${PERSONAL_RATE} COMPANY_RATE=${COMPANY_RATE}`
  );

  let cursor: string | undefined = undefined;
  let examined = 0;
  let converted = 0;
  let skipped = 0;

  while (true) {
    const batch = await prisma.team.findMany({
      take: BATCH_SIZE,
      skip: cursor ? 1 : 0,
      ...(cursor && { cursor: { id: cursor } }),
      orderBy: { id: "asc" },
      select: {
        id: true,
        isPersonal: true,
        companyId: true,
        balanceCents: true, // This still contains old credit count after schema migration
      },
    });

    if (!batch.length) break;

    for (const team of batch) {
      examined++;
      cursor = team.id;

      const oldCredits = team.balanceCents; // Column renamed but value is still credit count
      if (oldCredits === 0) {
        skipped++;
        continue;
      }

      // Determine rate based on whether team belongs to a company
      const rate = team.companyId ? COMPANY_RATE : PERSONAL_RATE;
      const newBalanceCents = oldCredits * rate;

      if (DRY_RUN) {
        console.log(
          `[DRY_RUN] Team ${team.id} (${team.isPersonal ? "personal" : "company"}): ${oldCredits} credits × ${rate}¢ = ${newBalanceCents}¢ ($${(newBalanceCents / 100).toFixed(2)})`
        );
        converted++;
        continue;
      }

      await prisma.team.update({
        where: { id: team.id },
        data: { balanceCents: newBalanceCents },
      });

      converted++;
      console.log(
        `[OK] Team ${team.id}: ${oldCredits} credits → ${newBalanceCents}¢ ($${(newBalanceCents / 100).toFixed(2)})`
      );
    }
  }

  console.log(
    `[MIGRATE BALANCE] Teams complete. examined=${examined} converted=${converted} skipped=${skipped}`
  );
}

async function migrateLedgerEntries() {
  // We need to convert each ledger entry's amountCents (which still contains old delta integer)
  // to the cent-based value. We need the team's companyId to determine the rate.
  const totalEntries = await prisma.balanceLedger.count();
  console.log(
    `[MIGRATE LEDGER] Start. Entries=${totalEntries}. DRY_RUN=${DRY_RUN}`
  );

  let cursor: string | undefined = undefined;
  let examined = 0;
  let converted = 0;
  let skipped = 0;

  while (true) {
    const batch = await prisma.balanceLedger.findMany({
      take: BATCH_SIZE,
      skip: cursor ? 1 : 0,
      ...(cursor && { cursor: { id: cursor } }),
      orderBy: { id: "asc" },
      select: {
        id: true,
        teamId: true,
        amountCents: true, // Still contains old delta value
        team: {
          select: {
            companyId: true,
            isPersonal: true,
          },
        },
      },
    });

    if (!batch.length) break;

    for (const entry of batch) {
      examined++;
      cursor = entry.id;

      const oldDelta = entry.amountCents; // Column renamed but value is still credit delta
      if (oldDelta === 0) {
        skipped++;
        continue;
      }

      const rate = entry.team.companyId ? COMPANY_RATE : PERSONAL_RATE;
      const newAmountCents = oldDelta * rate;

      if (DRY_RUN) {
        console.log(
          `[DRY_RUN] Ledger ${entry.id} (team ${entry.teamId}): ${oldDelta} × ${rate}¢ = ${newAmountCents}¢`
        );
        converted++;
        continue;
      }

      await prisma.balanceLedger.update({
        where: { id: entry.id },
        data: { amountCents: newAmountCents },
      });

      converted++;
      if (examined % 500 === 0) {
        console.log(
          `[PROGRESS] Ledger entries processed: ${examined}/${totalEntries}`
        );
      }
    }
  }

  console.log(
    `[MIGRATE LEDGER] Complete. examined=${examined} converted=${converted} skipped=${skipped}`
  );
}

async function migrateAutoRefillSettings() {
  // Convert auto-refill threshold and amount from credit counts to cent values
  const totalSettings = await prisma.teamAutoRefillSettings.count();
  console.log(
    `[MIGRATE AUTO-REFILL] Start. Settings=${totalSettings}. DRY_RUN=${DRY_RUN}`
  );

  let cursor: string | undefined = undefined;
  let examined = 0;
  let converted = 0;

  while (true) {
    const batch = await prisma.teamAutoRefillSettings.findMany({
      take: BATCH_SIZE,
      skip: cursor ? 1 : 0,
      ...(cursor && { cursor: { id: cursor } }),
      orderBy: { id: "asc" },
      select: {
        id: true,
        teamId: true,
        autoRefillThreshold: true,
        autoRefillAmount: true,
        team: {
          select: { companyId: true },
        },
      },
    });

    if (!batch.length) break;

    for (const setting of batch) {
      examined++;
      cursor = setting.id;

      const rate = setting.team.companyId ? COMPANY_RATE : PERSONAL_RATE;
      const newThreshold = setting.autoRefillThreshold * rate;
      const newAmount = setting.autoRefillAmount * rate;

      if (DRY_RUN) {
        console.log(
          `[DRY_RUN] AutoRefill ${setting.id} (team ${setting.teamId}): threshold ${setting.autoRefillThreshold}→${newThreshold}¢, amount ${setting.autoRefillAmount}→${newAmount}¢`
        );
        converted++;
        continue;
      }

      await prisma.teamAutoRefillSettings.update({
        where: { id: setting.id },
        data: {
          autoRefillThreshold: newThreshold,
          autoRefillAmount: newAmount,
        },
      });

      converted++;
      console.log(
        `[OK] AutoRefill ${setting.id}: threshold→${newThreshold}¢, amount→${newAmount}¢`
      );
    }
  }

  console.log(
    `[MIGRATE AUTO-REFILL] Complete. examined=${examined} converted=${converted}`
  );
}

async function run() {
  try {
    console.log("=".repeat(60));
    console.log("Credits → Balance Migration");
    console.log(`DRY_RUN=${DRY_RUN}`);
    console.log("=".repeat(60));

    await migrateTeamBalances();
    await migrateLedgerEntries();
    await migrateAutoRefillSettings();

    console.log("=".repeat(60));
    console.log("[DONE] Migration complete.");
    if (DRY_RUN) {
      console.log("[INFO] This was a DRY RUN. No data was modified.");
      console.log("[INFO] Run with DRY_RUN=false to apply changes.");
    }
    console.log("=".repeat(60));
  } catch (err) {
    console.error("[FATAL]", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

run();
