/*
 * Migration Script: Create Company Teams and Team Memberships
 *
 * PURPOSE
 *   - Ensure each ACTIVE Company has at least one default Team.
 *   - Create TeamMemberships for all ACTIVE CompanyMemberships that don't yet have them.
 *   - Map CompanyRole to appropriate TeamRole for new memberships.
 *   - Optionally set the company's default team as the user's selectedTeamId.
 *
 * SAFETY / DEFAULTS
 *   - DRY_RUN defaults to true (no DB writes). You MUST set DRY_RUN=false to actually perform the migration.
 *   - STOP_ON_ERROR defaults to false (continues processing after errors).
 *   - SET_SELECTED_TEAM defaults to false. Enable to set user's selectedTeamId to company default team.
 *   - By default the script operates on ALL companies; you can target specific companies via ONLY_COMPANIES.
 *
 * PREREQUISITES
 *   1. Database accessible with env vars your Prisma client expects (e.g., DATABASE_URL).
 *   2. Prisma models exist: Company, CompanyMembership, Team, TeamMembership.
 *   3. Companies should have at least one ACTIVE CompanyMembership.
 *
 * ENVIRONMENT VARIABLES (all optional unless noted)
 *   DRY_RUN=true|false               If true (default) only logs planned actions; no writes
 *   STOP_ON_ERROR=true|false         If true aborts entire run on first failure (default false)
 *   BATCH_SIZE=number                Company batch size (default 50)
 *   SET_SELECTED_TEAM=true|false     If true, set user's selectedTeamId to company default team (default false)
 *   ONLY_COMPANIES="id1,id2,..."     Comma-separated company IDs to restrict migration
 *   DEFAULT_TEAM_NAME_TEMPLATE       Template for default team name. Supports {company}. Default: "{company} Team"
 *   DEFAULT_TEAM_JOIN_POLICY         Join policy for default team (default: AUTO_JOIN)
 *
 * ROLE MAPPING (CompanyRole -> TeamRole)
 *   OWNER  -> OWNER
 *   ADMIN  -> ADMIN
 *   BILLING -> MEMBER (billing doesn't map directly to team permissions)
 *   MEMBER -> MEMBER
 *   VIEWER -> VIEWER
 *
 * EXECUTION (from your db worker / server package)
 *   # Dry run (recommended first pass)
 *   cd apps/db-worker
 *   DRY_RUN=true npm run script:migrate-company-teams
 *
 *   # Actual migration
 *   DRY_RUN=false npm run script:migrate-company-teams
 *
 *   # Set selected team during migration
 *   DRY_RUN=false SET_SELECTED_TEAM=true npm run script:migrate-company-teams
 *
 *   # Target specific companies only
 *   DRY_RUN=false ONLY_COMPANIES="cku123,cku456" npm run script:migrate-company-teams
 *
 * MONITORING
 *   The script prints a final JSON summary with counts: totals, created, updated, skipped, failed.
 *
 * ROLLBACK STRATEGY
 *   This script writes DB rows/fields only. If you need to revert:
 *     - Remove the created Teams (where they were created by this script)
 *     - Remove corresponding TeamMemberships
 *     - Revert User.selectedTeamId if it was set by this script
 *
 * NOTE
 *   - Only processes companies with status=ACTIVE
 *   - Only creates memberships for ACTIVE company members
 *   - Uses simple cursor pagination over Companies
 *   - Preserves existing teams and memberships (non-destructive)
 */
import * as dotenv from "dotenv";
dotenv.config();

import prisma from "../src/services/db"; // Adjust this import to your Prisma client location

// ---------------- Configuration ----------------
const DRY_RUN = (process.env.DRY_RUN ?? "true").toLowerCase() !== "false";
const STOP_ON_ERROR =
  (process.env.STOP_ON_ERROR ?? "false").toLowerCase() === "true";
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || "50", 10);

const SET_SELECTED_TEAM =
  (process.env.SET_SELECTED_TEAM ?? "false").toLowerCase() === "true";

const ONLY_COMPANIES = (process.env.ONLY_COMPANIES || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const DEFAULT_TEAM_NAME_TEMPLATE =
  process.env.DEFAULT_TEAM_NAME_TEMPLATE || "{company} Team";

const DEFAULT_TEAM_JOIN_POLICY =
  (process.env.DEFAULT_TEAM_JOIN_POLICY as any) || "AUTO_JOIN";

// ---------------- Types ----------------
interface Summary {
  companiesTotal: number;
  companiesExamined: number;
  companiesSkipped: number;

  teamsCreated: number;
  teamsFoundExisting: number;

  membershipsCreated: number;
  membershipsSkipped: number;
  membershipsAlreadyExist: number;

  selectedTeamSet: number;
  selectedTeamSkipped: number;

  failed: number;
  errors: string[];
}

type CompanyRole = "OWNER" | "ADMIN" | "BILLING" | "MEMBER" | "VIEWER";
type TeamRole = "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";

// ---------------- Helpers ----------------
function mapCompanyRoleToTeamRole(companyRole: CompanyRole): TeamRole {
  switch (companyRole) {
    case "OWNER":
      return "OWNER";
    case "ADMIN":
      return "ADMIN";
    case "BILLING":
      return "MEMBER"; // Billing users get regular member access to teams
    case "MEMBER":
      return "MEMBER";
    case "VIEWER":
      return "VIEWER";
    default:
      return "MEMBER"; // fallback
  }
}

function makeDefaultTeamName(companyName: string) {
  return DEFAULT_TEAM_NAME_TEMPLATE.replace("{company}", companyName);
}

async function fetchCompanyBatch(cursor?: string, take: number = BATCH_SIZE) {
  return prisma.company.findMany({
    take,
    skip: cursor ? 1 : 0,
    ...(cursor && { cursor: { id: cursor } }),
    orderBy: { id: "asc" },
    where: {
      status: "ACTIVE",
      ...(ONLY_COMPANIES.length && { id: { in: ONLY_COMPANIES } }),
    },
    select: {
      id: true,
      name: true,
      createdByUserId: true,
      memberships: {
        where: { status: "ACTIVE" },
        select: {
          id: true,
          userId: true,
          role: true,
        },
      },
    },
  });
}

async function ensureDefaultTeamForCompany(company: {
  id: string;
  name: string;
  createdByUserId: string;
}) {
  // Check if the company already has a default team
  let team = await prisma.team.findFirst({
    where: {
      companyId: company.id,
      isDefaultForCompany: true,
    },
    select: { id: true, name: true },
  });

  let created = false;

  if (!team) {
    const teamName = makeDefaultTeamName(company.name);

    if (DRY_RUN) {
      console.log(
        `[DRY_RUN] Would create default team for company=${company.id} name="${teamName}"`
      );
      // Fake a team id for subsequent steps in dry-run
      team = { id: `dry_${company.id}`, name: teamName };
      created = true;
    } else {
      team = await prisma.team.create({
        data: {
          name: teamName,
          isPersonal: false,
          companyId: company.id,
          createdByUserId: company.createdByUserId,
          isDefaultForCompany: true,
          joinPolicy: DEFAULT_TEAM_JOIN_POLICY,
          credits: 0,
        },
        select: { id: true, name: true },
      });
      created = true;
      console.log(
        `[OK] Created default team id=${team.id} name="${team.name}" for company=${company.id}`
      );
    }
  } else {
    console.log(
      `[SKIP] Default team already exists for company=${company.id} teamId=${team.id}`
    );
  }

  return { team, created };
}

async function ensureTeamMembership(
  teamId: string,
  userId: string,
  companyRole: CompanyRole
) {
  // Check if membership already exists
  const existing = await prisma.teamMembership.findFirst({
    where: { teamId, userId },
    select: { id: true, role: true },
  });

  if (existing) {
    console.log(
      `[SKIP] Team membership already exists teamId=${teamId} userId=${userId} role=${existing.role}`
    );
    return { created: false, alreadyExists: true };
  }

  const teamRole = mapCompanyRoleToTeamRole(companyRole);

  if (DRY_RUN) {
    console.log(
      `[DRY_RUN] Would create team membership teamId=${teamId} userId=${userId} role=${teamRole} (from companyRole=${companyRole})`
    );
    return { created: true, alreadyExists: false };
  }

  await prisma.teamMembership.create({
    data: {
      teamId,
      userId,
      role: teamRole,
      status: "ACTIVE",
    },
  });
  console.log(
    `[OK] Created team membership teamId=${teamId} userId=${userId} role=${teamRole}`
  );
  return { created: true, alreadyExists: false };
}

async function maybeSetSelectedTeam(userId: string, teamId: string) {
  if (!SET_SELECTED_TEAM) {
    return { set: false, skipped: true };
  }

  // Only set selectedTeamId if it's currently null
  if (DRY_RUN) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { selectedTeamId: true },
    });
    if (!user) {
      console.log(`[SELECTED] User not found user=${userId}`);
      return { set: false, skipped: true };
    }
    if (user.selectedTeamId == null) {
      console.log(
        `[DRY_RUN] Would set selectedTeamId=${teamId} for user=${userId}`
      );
      return { set: true, skipped: false };
    }
    console.log(
      `[SELECTED] Skipping set for user=${userId}; selectedTeamId already present`
    );
    return { set: false, skipped: true };
  }

  const result = await prisma.user.updateMany({
    where: { id: userId, selectedTeamId: null },
    data: { selectedTeamId: teamId },
  });

  if (result.count > 0) {
    console.log(`[OK] Set selectedTeamId=${teamId} for user=${userId}`);
    return { set: true, skipped: false };
  }

  console.log(
    `[SELECTED] Skipping set for user=${userId}; selectedTeamId already present`
  );
  return { set: false, skipped: true };
}

// ---------------- Main ----------------
async function run() {
  const summary: Summary = {
    companiesTotal: 0,
    companiesExamined: 0,
    companiesSkipped: 0,

    teamsCreated: 0,
    teamsFoundExisting: 0,

    membershipsCreated: 0,
    membershipsSkipped: 0,
    membershipsAlreadyExist: 0,

    selectedTeamSet: 0,
    selectedTeamSkipped: 0,

    failed: 0,
    errors: [],
  };

  const total = await prisma.company.count({
    where: {
      status: "ACTIVE",
      ...(ONLY_COMPANIES.length && { id: { in: ONLY_COMPANIES } }),
    },
  });
  summary.companiesTotal = total;

  console.log(
    `[MIGRATE] Start. Companies: ${total}. DRY_RUN=${DRY_RUN} STOP_ON_ERROR=${STOP_ON_ERROR} SET_SELECTED_TEAM=${SET_SELECTED_TEAM}`
  );

  let cursor: string | undefined = undefined;

  while (true) {
    const batch = await fetchCompanyBatch(cursor, BATCH_SIZE);
    if (batch.length === 0) break;

    for (const company of batch) {
      summary.companiesExamined++;
      cursor = company.id; // advance cursor

      try {
        // Skip companies with no active members
        if (company.memberships.length === 0) {
          console.log(
            `[SKIP] Company=${company.id} has no active members; skipping`
          );
          summary.companiesSkipped++;
          continue;
        }

        // 1) Ensure default team for company
        const { team, created } = await ensureDefaultTeamForCompany(company);
        if (created) summary.teamsCreated++;
        else summary.teamsFoundExisting++;

        // 2) Create team memberships for all company members
        for (const membership of company.memberships) {
          const result = await ensureTeamMembership(
            team.id,
            membership.userId,
            membership.role as CompanyRole
          );

          if (result.created) {
            summary.membershipsCreated++;

            // 3) Optionally set selected team for this user
            if (created) {
              // Only set for newly created teams
              const selected = await maybeSetSelectedTeam(
                membership.userId,
                team.id
              );
              if (selected.set) summary.selectedTeamSet++;
              if (selected.skipped) summary.selectedTeamSkipped++;
            }
          } else if (result.alreadyExists) {
            summary.membershipsAlreadyExist++;
          } else {
            summary.membershipsSkipped++;
          }
        }
      } catch (e: any) {
        summary.failed++;
        const msg = `[ERROR] Company=${company.id} ${e?.message || e}`;
        summary.errors.push(msg);
        console.error(msg);
        if (STOP_ON_ERROR) throw e;
      }
    }
  }

  console.log("[MIGRATE] Complete:\n" + JSON.stringify(summary, null, 2));
}

run()
  .catch((e) => {
    console.error("[FATAL] Migration aborted", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
