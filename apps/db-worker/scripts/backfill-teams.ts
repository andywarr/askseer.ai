/*
 * Migration Script: Backfill Teams and Study Ownership
 *
 * PURPOSE
 *   - Ensure each user has a personal Team (Team.isPersonal = true).
 *   - Ensure a TeamMembership exists (role=OWNER) linking the user to that Team.
 *   - Move existing Studies to the user's personal Team:
 *       Study.teamId = <personalTeam.id>
 *       Study.createdByUserId = Study.userId
 *   - (Optional) Attach personal Team to a Company by email domain via CompanyDomain.
 *
 * SAFETY / DEFAULTS
 *   - DRY_RUN defaults to true (no DB writes). You MUST set DRY_RUN=false to actually perform the migration.
 *   - STOP_ON_ERROR defaults to false (continues processing after errors).
 *   - ATTACH_COMPANY_BY_EMAIL defaults to false. Enable to set Team.companyId when a domain match exists.
 *   - By default the script operates on ALL users; you can target specific users via ONLY_USERS.
 *
 * PREREQUISITES
 *   1. Database accessible with env vars your Prisma client expects (e.g., DATABASE_URL).
 *   2. Prisma models exist: Team, TeamMembership, (optional) CompanyDomain, and new Study fields (teamId, createdByUserId).
 *
 * ENVIRONMENT VARIABLES (all optional unless noted)
 *   DRY_RUN=true|false               If true (default) only logs planned actions; no writes
 *   STOP_ON_ERROR=true|false         If true aborts entire run on first failure (default false)
 *   BATCH_SIZE=number                User batch size (default 100)
 *   ATTACH_COMPANY_BY_EMAIL=true|false  If true, attempt to set team.companyId from CompanyDomain (default false)
 *   ONLY_USERS="id1,id2,..."         Comma-separated user IDs to restrict migration
 *   PERSONAL_TEAM_NAME_TEMPLATE      Template for personal team name. Supports {first}, {emailLocal}. Default: "{first}'s Team"
 *   CONSUMER_DOMAIN_DENYLIST         Comma-separated domains to ignore for company detection
 *
 * EXECUTION (from your db worker / server package)
 *   # Dry run (recommended first pass)
 *   DRY_RUN=true npx ts-node --project tsconfig.json scripts/backfill-teams.ts
 *
 *   # Actual migration
 *   DRY_RUN=false npx ts-node --project tsconfig.json scripts/backfill-teams.ts
 *
 *   # Attach companies by email domain during backfill
 *   DRY_RUN=false ATTACH_COMPANY_BY_EMAIL=true npx ts-node --project tsconfig.json scripts/backfill-teams.ts
 *
 *   # Target specific users only
 *   DRY_RUN=false ONLY_USERS="cku123,cku456" npx ts-node --project tsconfig.json scripts/backfill-teams.ts
 *
 * MONITORING
 *   The script prints a final JSON summary with counts: totals, created, updated, skipped, failed.
 *
 * ROLLBACK STRATEGY
 *   This script writes DB rows/fields only. If you need to revert:
 *     - Remove/mark personal Teams (isPersonal=true) as needed
 *     - Remove corresponding TeamMemberships
 *     - Set Study.teamId back to null (or previous) and Study.createdByUserId back to Study.userId if desired
 *
 * NOTE
 *   Uses updateMany where possible for efficiency. Uses simple cursor pagination over Users.
 */
import * as dotenv from "dotenv";
dotenv.config();

import prisma from "../src/services/db"; // Adjust this import to your Prisma client location

// ---------------- Configuration ----------------
const DRY_RUN = (process.env.DRY_RUN ?? "true").toLowerCase() !== "false";
const STOP_ON_ERROR =
  (process.env.STOP_ON_ERROR ?? "false").toLowerCase() === "true";
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || "100", 10);

const ATTACH_COMPANY_BY_EMAIL =
  (process.env.ATTACH_COMPANY_BY_EMAIL ?? "false").toLowerCase() === "true";

const ONLY_USERS = (process.env.ONLY_USERS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const PERSONAL_TEAM_NAME_TEMPLATE =
  process.env.PERSONAL_TEAM_NAME_TEMPLATE || "{first}'s Team";

const DEFAULT_CONSUMER_DENYLIST = [
  "gmail.com",
  "yahoo.com",
  "outlook.com",
  "icloud.com",
  "hotmail.com",
  "aol.com",
  "proton.me",
  "pm.me",
];
const CONSUMER_DOMAIN_DENYLIST = new Set(
  (process.env.CONSUMER_DOMAIN_DENYLIST || "")
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean)
    .concat(DEFAULT_CONSUMER_DENYLIST)
);

// ---------------- Types ----------------
interface Summary {
  usersTotal: number;
  usersExamined: number;
  usersFiltered: number;

  teamsCreated: number;
  teamsFoundExisting: number;

  membershipsCreated: number;
  membershipsFoundExisting: number;

  studiesUpdated: number;
  studiesSkipped: number;

  teamsCompanyAttached: number;
  teamsCompanySkipped: number;

  // new: count of users whose selectedTeamId was set to their personal team
  selectedTeamSet: number;

  failed: number;
  errors: string[];
}

// ---------------- Helpers ----------------
function firstNameFromFull(name?: string | null, email?: string): string {
  if (name && name.trim()) return name.trim().split(/\s+/)[0]!;
  if (email) return email.split("@")[0]!;
  return "Personal";
}

function makePersonalTeamName(user: { name?: string | null; email: string }) {
  const first = firstNameFromFull(user.name, user.email);
  const emailLocal = user.email.split("@")[0]!;
  return PERSONAL_TEAM_NAME_TEMPLATE.replace("{first}", first).replace(
    "{emailLocal}",
    emailLocal
  );
}

function emailDomain(email: string): string | null {
  const parts = email.split("@");
  if (parts.length !== 2) return null;
  return parts[1]!.toLowerCase();
}

async function fetchUserBatch(cursor?: string, take: number = BATCH_SIZE) {
  return prisma.user.findMany({
    take,
    skip: cursor ? 1 : 0,
    ...(cursor && { cursor: { id: cursor } }),
    orderBy: { id: "asc" },
    where: ONLY_USERS.length ? { id: { in: ONLY_USERS } } : undefined,
    select: {
      id: true,
      name: true,
      email: true,
    },
  });
}

async function findExistingPersonalTeam(userId: string) {
  // Prefer membership lookup (canonical); fall back to createdByUserId
  const byMembership = await prisma.team.findFirst({
    where: {
      isPersonal: true,
      memberships: { some: { userId } },
    },
    select: { id: true, companyId: true },
  });
  if (byMembership) return byMembership;

  const byCreator = await prisma.team.findFirst({
    where: {
      isPersonal: true,
      createdByUserId: userId,
    },
    select: { id: true, companyId: true },
  });
  return byCreator;
}

async function ensurePersonalTeamForUser(user: {
  id: string;
  name?: string | null;
  email: string;
}) {
  let team = await findExistingPersonalTeam(user.id);
  let created = false;

  if (!team) {
    const name = makePersonalTeamName(user);
    if (DRY_RUN) {
      console.log(
        `[DRY_RUN] Would create personal team for user=${user.id} name="${name}"`
      );
      // Fake a team id for subsequent steps in dry-run
      team = { id: `dry_${user.id}`, companyId: null as string | null };
      created = true;
    } else {
      team = await prisma.team.create({
        data: {
          name,
          isPersonal: true,
          createdByUser: { connect: { id: user.id } },
        },
        select: { id: true, companyId: true },
      });
      created = true;
      console.log(
        `[OK] Created personal team id=${team.id} for user=${user.id}`
      );
    }
  } else {
    console.log(
      `[SKIP] Personal team already exists for user=${user.id} teamId=${team.id}`
    );
  }

  return { team, created };
}

async function ensureOwnerMembership(teamId: string, userId: string) {
  const existing = await prisma.teamMembership.findFirst({
    where: { teamId, userId },
    select: { id: true },
  });

  if (existing) {
    console.log(
      `[SKIP] Owner membership already exists teamId=${teamId} userId=${userId}`
    );
    return { created: false };
  }

  if (DRY_RUN) {
    console.log(
      `[DRY_RUN] Would create OWNER membership teamId=${teamId} userId=${userId}`
    );
    return { created: true };
  }

  await prisma.teamMembership.create({
    data: {
      teamId,
      userId,
      role: "OWNER",
    },
  });
  console.log(
    `[OK] Created OWNER membership teamId=${teamId} userId=${userId}`
  );
  return { created: true };
}

async function maybeAttachCompanyByEmail(teamId: string, email: string) {
  if (!ATTACH_COMPANY_BY_EMAIL) {
    return { attached: false, skipped: true };
  }
  const domain = emailDomain(email);
  if (!domain || CONSUMER_DOMAIN_DENYLIST.has(domain)) {
    console.log(
      `[COMPANY] Skipping attach for email=${email} domain=${domain ?? "n/a"}`
    );
    return { attached: false, skipped: true };
  }

  // See if already attached
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { companyId: true },
  });
  if (team?.companyId) {
    console.log(
      `[COMPANY] Team already has companyId; skipping. teamId=${teamId}`
    );
    return { attached: false, skipped: true };
  }

  // Find CompanyDomain (assumes model exists)
  const cd = await prisma.companyDomain.findUnique({
    where: { domain },
    select: { companyId: true },
  });

  if (!cd) {
    console.log(`[COMPANY] No CompanyDomain match for ${domain}; skipping`);
    return { attached: false, skipped: true };
  }

  if (DRY_RUN) {
    console.log(
      `[DRY_RUN] Would attach teamId=${teamId} to companyId=${cd.companyId} via domain=${domain}`
    );
    return { attached: true, skipped: false };
  }

  await prisma.team.update({
    where: { id: teamId },
    data: { companyId: cd.companyId },
  });
  console.log(
    `[OK] Attached teamId=${teamId} to companyId=${cd.companyId} (domain=${domain})`
  );
  return { attached: true, skipped: false };
}

async function ensureSelectedTeamForUser(userId: string, teamId: string) {
  // Only set selectedTeamId if it's currently null to avoid overwriting a user's choice.
  if (DRY_RUN) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { selectedTeamId: true },
    });
    if (!user) {
      console.log(`[SELECTED] User not found user=${userId}`);
      return { set: false };
    }
    if (user.selectedTeamId == null) {
      console.log(
        `[DRY_RUN] Would set selectedTeamId=${teamId} for user=${userId}`
      );
      return { set: true };
    }
    console.log(
      `[SELECTED] Skipping set for user=${userId}; selectedTeamId already present`
    );
    return { set: false };
  }

  const result = await prisma.user.updateMany({
    where: { id: userId, selectedTeamId: null },
    data: { selectedTeamId: teamId },
  });

  if (result.count > 0) {
    console.log(`[OK] Set selectedTeamId=${teamId} for user=${userId}`);
    return { set: true };
  }

  console.log(
    `[SELECTED] Skipping set for user=${userId}; selectedTeamId already present`
  );
  return { set: false };
}

async function backfillStudiesToTeam(userId: string, teamId: string) {
  // Move all studies owned by the user (legacy Study.userId) that don't yet have a team
  // and set createdByUserId where missing.
  // NOTE: This assumes you added Study.createdByUserId (nullable) in an earlier migration.
  if (DRY_RUN) {
    // Inspect counts for logging
    const count = await prisma.study.count({
      where: { userId, OR: [{ teamId: null }, { createdByUserId: null }] },
    });
    if (count > 0) {
      console.log(
        `[DRY_RUN] Would update ${count} studies to teamId=${teamId} and set createdByUserId=${userId}`
      );
    }
    return { updated: count, skipped: 0 };
  }

  const result = await prisma.study.updateMany({
    where: { userId, OR: [{ teamId: null }, { createdByUserId: null }] },
    data: { teamId, createdByUserId: userId },
  });

  if (result.count > 0) {
    console.log(
      `[OK] Updated ${result.count} studies to teamId=${teamId} (createdByUserId=${userId})`
    );
  }
  return { updated: result.count, skipped: 0 };
}

// ---------------- Main ----------------
async function run() {
  const summary: Summary = {
    usersTotal: 0,
    usersExamined: 0,
    usersFiltered: 0,

    teamsCreated: 0,
    teamsFoundExisting: 0,

    membershipsCreated: 0,
    membershipsFoundExisting: 0,

    studiesUpdated: 0,
    studiesSkipped: 0,

    teamsCompanyAttached: 0,
    teamsCompanySkipped: 0,

    selectedTeamSet: 0,

    failed: 0,
    errors: [],
  };

  const total = await prisma.user.count({
    where: ONLY_USERS.length ? { id: { in: ONLY_USERS } } : undefined,
  });
  summary.usersTotal = total;

  console.log(
    `[BACKFILL] Start. Users: ${total}. DRY_RUN=${DRY_RUN} STOP_ON_ERROR=${STOP_ON_ERROR} ATTACH_COMPANY_BY_EMAIL=${ATTACH_COMPANY_BY_EMAIL}`
  );

  let cursor: string | undefined = undefined;

  while (true) {
    const batch = await fetchUserBatch(cursor, BATCH_SIZE);
    if (batch.length === 0) break;

    for (const user of batch) {
      summary.usersExamined++;
      cursor = user.id; // advance cursor

      try {
        // 1) Ensure personal team
        const { team, created } = await ensurePersonalTeamForUser(user);
        if (created) summary.teamsCreated++;
        else summary.teamsFoundExisting++;

        // 2) Ensure OWNER membership
        const m = await ensureOwnerMembership(team!.id, user.id);
        if (m.created) summary.membershipsCreated++;
        else summary.membershipsFoundExisting++;

        // 2.5) If we just created the personal team, set it as the user's selectedTeam
        if (created) {
          const s = await ensureSelectedTeamForUser(user.id, team!.id);
          if (s.set) summary.selectedTeamSet++;
        }

        // 3) Optional attach company by email
        const attach = await maybeAttachCompanyByEmail(team!.id, user.email);
        if (attach.attached) summary.teamsCompanyAttached++;
        if (attach.skipped) summary.teamsCompanySkipped++;

        // 4) Backfill studies to the team
        const upd = await backfillStudiesToTeam(user.id, team!.id);
        summary.studiesUpdated += upd.updated;
        summary.studiesSkipped += upd.skipped;
      } catch (e: any) {
        summary.failed++;
        const msg = `[ERROR] User=${user.id} ${e?.message || e}`;
        summary.errors.push(msg);
        console.error(msg);
        if (STOP_ON_ERROR) throw e;
      }
    }
  }

  console.log("[BACKFILL] Complete:\n" + JSON.stringify(summary, null, 2));
}

run()
  .catch((e) => {
    console.error("[FATAL] Backfill aborted", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
