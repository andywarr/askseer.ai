/*
 * Migration Script: Move User.credits to Team.credits
 *
 * PURPOSE
 *   - Transfer legacy per-user credit balances (User.credits) into the user's personal Team.credits.
 *   - Create a CreditLedger entry for each transfer for auditability.
 *   - Optionally ensure each user has a personal team and OWNER membership (fallback path).
 *
 * SAFETY
 *   - DRY_RUN defaults to true. No writes unless DRY_RUN=false.
 *   - Processes users in batches. Supports filtering to specific users.
 *
 * PARAMETERS (env)
 *   DRY_RUN=true|false            Default true; when false, applies changes.
 *   BATCH_SIZE=number             Default 100
 *   ONLY_USERS="id1,id2,..."      Restrict to these user ids
 *   MODE=ADD_ALL|ADD_EXCESS_OVER_3|REPLACE  How to compute transfer amount (default ADD_ALL)
 *     - ADD_ALL:            transferAmount = user.credits
 *     - ADD_EXCESS_OVER_3:  transferAmount = max(user.credits - 3, 0)
 *     - REPLACE:            transferAmount = user.credits, and leave team.credits = previous + transfer (still additive)
 *   LEDGER_REASON=string     Reason stored in CreditLedger (default "migration_user_credits_transfer")
 *
 * EXECUTION
 *   # Dry run
 *   DRY_RUN=true npx tsx scripts/migrate-user-credits-to-team.ts
 *   # Apply
 *   DRY_RUN=false npx tsx scripts/migrate-user-credits-to-team.ts
 *   # Only specific users
 *   DRY_RUN=false ONLY_USERS="cku123,cku456" npx tsx scripts/migrate-user-credits-to-team.ts
 */
import * as dotenv from "dotenv";
dotenv.config();

import prisma from "../src/services/db";

const DRY_RUN = (process.env.DRY_RUN ?? "true").toLowerCase() !== "false";
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || "100", 10);
const ONLY_USERS = (process.env.ONLY_USERS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const MODE = (process.env.MODE || "ADD_ALL").toUpperCase();
const LEDGER_REASON =
  process.env.LEDGER_REASON || "migration_user_credits_transfer";

type Mode = "ADD_ALL" | "ADD_EXCESS_OVER_3" | "REPLACE";
function computeTransferAmount(mode: Mode, userCredits: number): number {
  const c = Math.max(0, userCredits | 0);
  switch (mode) {
    case "ADD_EXCESS_OVER_3":
      return Math.max(0, c - 3);
    case "REPLACE":
    case "ADD_ALL":
    default:
      return c;
  }
}

async function findOrCreatePersonalTeam(userId: string) {
  // Prefer membership lookup
  let team = await prisma.team.findFirst({
    where: { isPersonal: true, memberships: { some: { userId } } },
    select: { id: true, credits: true },
  });
  if (team) return { id: team.id };

  // Fallback to creator lookup
  team = await prisma.team.findFirst({
    where: { isPersonal: true, createdByUserId: userId },
    select: { id: true, credits: true },
  });
  if (team) return { id: team.id };

  // Create minimal personal team if missing
  if (DRY_RUN) {
    console.log(`[DRY_RUN] Would create personal team for user=${userId}`);
    return { id: `dry_${userId}` };
  }
  const created = await prisma.team.create({
    data: {
      name: "Personal Team",
      isPersonal: true,
      createdByUserId: userId,
      credits: 0,
      memberships: { create: { userId, role: "OWNER" } },
    },
    select: { id: true },
  });
  console.log(`[OK] Created personal team id=${created.id} for user=${userId}`);
  return { id: created.id };
}

async function fetchUserBatch(cursor?: string, take: number = BATCH_SIZE) {
  return prisma.user.findMany({
    take,
    skip: cursor ? 1 : 0,
    ...(cursor && { cursor: { id: cursor } }),
    orderBy: { id: "asc" },
    where: ONLY_USERS.length ? { id: { in: ONLY_USERS } } : undefined,
    select: { id: true, credits: true },
  });
}

async function run() {
  const total = await prisma.user.count({
    where: ONLY_USERS.length ? { id: { in: ONLY_USERS } } : undefined,
  });
  console.log(
    `[MIGRATE CREDITS] Start. Users=${total}. DRY_RUN=${DRY_RUN} MODE=${MODE}`
  );

  let cursor: string | undefined = undefined;
  let examined = 0;
  let movedUsers = 0;
  let totalMoved = 0;
  let skippedZero = 0;

  while (true) {
    const batch = await fetchUserBatch(cursor, BATCH_SIZE);
    if (!batch.length) break;
    for (const user of batch) {
      examined++;
      cursor = user.id;
      const transfer = computeTransferAmount(MODE as Mode, user.credits || 0);
      if (!transfer || transfer <= 0) {
        skippedZero++;
        continue;
      }

      const { id: teamId } = await findOrCreatePersonalTeam(user.id);

      if (DRY_RUN) {
        console.log(
          `[DRY_RUN] Would move ${transfer} credits user=${user.id} -> team=${teamId} (reason=${LEDGER_REASON})`
        );
        movedUsers++;
        totalMoved += transfer;
        continue;
      }

      await prisma.$transaction(async (tx) => {
        await tx.team.update({
          where: { id: teamId },
          data: { credits: { increment: transfer } },
        });
        await tx.creditLedger.create({
          data: {
            teamId,
            byUserId: user.id,
            delta: transfer,
            reason: LEDGER_REASON,
          },
        });
        await tx.user.update({
          where: { id: user.id },
          data: { credits: 0 },
        });
      });

      movedUsers++;
      totalMoved += transfer;
      console.log(
        `[OK] Moved ${transfer} credits user=${user.id} -> team=${teamId}`
      );
    }
  }

  console.log(
    `[MIGRATE CREDITS] Complete. examined=${examined} movedUsers=${movedUsers} totalMoved=${totalMoved} skippedZero=${skippedZero}`
  );
}

run()
  .catch((e) => {
    console.error("[FATAL] Migration aborted", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
