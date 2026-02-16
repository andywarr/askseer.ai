import prisma from "../db.ts";
import type { Prisma, TeamRole } from "@prisma/client";
import {
  CompanyMembershipStatus,
  CompanyRole,
  TeamJoinPolicy,
  TeamMembershipStatus,
  UserStatus,
} from "@prisma/client";
import { logger } from "@/apps/shared/logger.ts";
import {
  BadRequestError,
  NotFoundError,
  ForbiddenError,
} from "../shared/errors.ts";

// Constants
const TEAM_NAME_MIN_LENGTH = 2;
const TEAM_NAME_MAX_LENGTH = 50;
const RESERVED_TEAM_NAMES = new Set(["personal", "default", "system", "admin"]);

// ============================================================================
// Helper: Add users to auto-join teams
// ============================================================================

export async function addUsersToAutoJoinTeams(
  db: typeof prisma | Prisma.TransactionClient,
  companyId: string,
  userIds?: string[]
) {
  const targetUserIds = userIds?.length
    ? Array.from(new Set(userIds))
    : (
        await db.companyMembership.findMany({
          where: {
            companyId,
            status: CompanyMembershipStatus.ACTIVE,
            deactivatedAt: null,
            user: { status: UserStatus.ACTIVE },
          },
          select: { userId: true },
        })
      ).map((m) => m.userId);

  if (!targetUserIds.length) return;

  const activeMembers = await db.companyMembership.findMany({
    where: {
      companyId,
      userId: { in: targetUserIds },
      status: CompanyMembershipStatus.ACTIVE,
      deactivatedAt: null,
      user: { status: UserStatus.ACTIVE },
    },
    select: { userId: true },
  });

  const activeUserIds = Array.from(new Set(activeMembers.map((m) => m.userId)));
  if (!activeUserIds.length) return;

  const autoJoinTeams = await db.team.findMany({
    where: {
      companyId,
      joinPolicy: TeamJoinPolicy.AUTO_JOIN,
      isPersonal: false,
    },
    select: { id: true, isDefaultForCompany: true },
  });

  if (!autoJoinTeams.length) return;

  await db.teamMembership.updateMany({
    where: {
      teamId: { in: autoJoinTeams.map((team) => team.id) },
      userId: { in: activeUserIds },
      status: TeamMembershipStatus.PENDING,
    },
    data: { status: TeamMembershipStatus.ACTIVE },
  });

  const memberships = autoJoinTeams.flatMap((team) =>
    activeUserIds.map((userId) => ({
      teamId: team.id,
      userId,
      role: "MEMBER" as TeamRole,
      status: TeamMembershipStatus.ACTIVE,
    }))
  );

  await db.teamMembership.createMany({
    data: memberships,
    skipDuplicates: true,
  });

  const defaultTeamId = autoJoinTeams.find(
    (team) => team.isDefaultForCompany
  )?.id;
  if (defaultTeamId) {
    await db.user.updateMany({
      where: {
        id: { in: activeUserIds },
      },
      data: { selectedTeamId: defaultTeamId },
    });
  }
  logger.info("Auto-joined company members to teams", {
    companyId,
    teamCount: autoJoinTeams.length,
    userCount: activeUserIds.length,
  });
}

// ============================================================================
// Team CRUD
// ============================================================================

export async function dbGetTeam(teamId: string) {
  try {
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: {
        memberships: {
          where: { status: "ACTIVE" },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
                status: true,
              },
            },
          },
        },
      },
    });
    logger.info("Successfully fetched team", { teamId, found: !!team });
    return team;
  } catch (error) {
    logger.error("Failed to fetch team", { teamId, error });
    throw error;
  }
}

export async function dbListUserTeams(userId: string) {
  try {
    const memberships = await prisma.teamMembership.findMany({
      where: { userId, status: "ACTIVE" },
      include: {
        team: {
          select: {
            id: true,
            name: true,
            isPersonal: true,
            companyId: true,
            balanceCents: true,
            joinPolicy: true,
            isDefaultForCompany: true,
            company: {
              select: { id: true, name: true, disablePersonalTeams: true },
            },
          },
        },
      },
      orderBy: { joinedAt: "asc" },
    });

    const teams = memberships.map((membership) => ({
      id: membership.team.id,
      name: membership.team.name,
      isPersonal: membership.team.isPersonal,
      companyId: membership.team.companyId,
      companyName: membership.team.company?.name ?? null,
      companyPersonalTeamsDisabled:
        membership.team.company?.disablePersonalTeams ?? false,
      balanceCents: membership.team.balanceCents,
      joinPolicy: membership.team.joinPolicy,
      isDefaultForCompany: membership.team.isDefaultForCompany,
      role: membership.role,
    }));

    logger.info("Listed user teams", { userId, count: teams.length });
    return teams;
  } catch (error) {
    logger.error("Failed to list user teams", { userId, error });
    throw error;
  }
}

export async function dbCreateTeam(params: {
  companyId: string;
  userId: string;
  name: string;
  members?: { userId: string; role: TeamRole }[];
}) {
  const { companyId, userId, name, members = [] } = params;
  try {
    const trimmedName = name.trim();
    if (
      trimmedName.length < TEAM_NAME_MIN_LENGTH ||
      trimmedName.length > TEAM_NAME_MAX_LENGTH
    ) {
      throw BadRequestError(
        `Team name must be between ${TEAM_NAME_MIN_LENGTH} and ${TEAM_NAME_MAX_LENGTH} characters`
      );
    }
    if (RESERVED_TEAM_NAMES.has(trimmedName.toLowerCase())) {
      throw BadRequestError("This team name is reserved");
    }

    // Ensure user is company OWNER or ADMIN
    const membership = await prisma.companyMembership.findUnique({
      where: { companyId_userId: { companyId, userId } },
      select: {
        role: true,
        status: true,
        deactivatedAt: true,
        user: { select: { status: true } },
      },
    });
    const allowedRoles: CompanyRole[] = [CompanyRole.OWNER, CompanyRole.ADMIN];
    if (
      !membership ||
      membership.status !== CompanyMembershipStatus.ACTIVE ||
      membership.deactivatedAt !== null ||
      membership.user?.status !== UserStatus.ACTIVE ||
      !allowedRoles.includes(membership.role)
    ) {
      throw ForbiddenError("Not authorized to create teams");
    }

    // Ensure name uniqueness within company
    const existing = await prisma.team.findFirst({
      where: { companyId, name: { equals: trimmedName, mode: "insensitive" } },
      select: { id: true },
    });
    if (existing) {
      throw BadRequestError("A team with this name already exists");
    }

    const created = await prisma.team.create({
      data: {
        companyId,
        name: trimmedName,
        createdByUserId: userId,
      },
    });

    // Validate and add optional members (including creator if provided)
    if (members.length) {
      const uniqueMembers = members.filter(
        (m, idx, arr) => arr.findIndex((x) => x.userId === m.userId) === idx
      );
      const memberIds = uniqueMembers.map((m) => m.userId);
      if (memberIds.length) {
        const validMemberships = await prisma.companyMembership.findMany({
          where: {
            companyId,
            userId: { in: memberIds },
            status: CompanyMembershipStatus.ACTIVE,
            deactivatedAt: null,
            user: { status: UserStatus.ACTIVE },
          },
          select: { userId: true },
        });
        const validSet = new Set(validMemberships.map((m) => m.userId));
        for (const m of uniqueMembers) {
          if (!validSet.has(m.userId)) {
            throw BadRequestError(
              `User ${m.userId} is not a member of this company`
            );
          }
          try {
            await prisma.teamMembership.create({
              data: {
                teamId: created.id,
                userId: m.userId,
                role: m.role,
              },
            });
          } catch (innerErr) {
            logger.warn("Failed to add team member", {
              teamId: created.id,
              userId: m.userId,
              error: innerErr,
            });
          }
        }
      }
    }

    logger.info("Created team", {
      teamId: created.id,
      companyId,
      createdBy: userId,
    });
    return created;
  } catch (error) {
    logger.error("Failed to create team", { companyId, userId, error });
    throw error;
  }
}

export async function dbUpdateTeamName(params: {
  teamId: string;
  userId: string;
  name: string;
}) {
  const { teamId, userId, name } = params;
  try {
    const trimmedName = name.trim();
    if (
      trimmedName.length < TEAM_NAME_MIN_LENGTH ||
      trimmedName.length > TEAM_NAME_MAX_LENGTH
    ) {
      throw BadRequestError(
        `Team name must be between ${TEAM_NAME_MIN_LENGTH} and ${TEAM_NAME_MAX_LENGTH} characters`
      );
    }

    if (RESERVED_TEAM_NAMES.has(trimmedName.toLowerCase())) {
      throw BadRequestError("This team name is reserved");
    }

    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: {
        id: true,
        name: true,
        companyId: true,
        isPersonal: true,
        createdByUserId: true,
      },
    });

    if (!team) {
      throw NotFoundError("Team not found");
    }

    const membership = await prisma.teamMembership.findUnique({
      where: { teamId_userId: { teamId, userId } },
      select: { role: true },
    });

    let isAuthorized = false;
    if (membership) {
      const allowedTeamRoles: TeamRole[] = ["OWNER", "ADMIN"];
      if (allowedTeamRoles.includes(membership.role as TeamRole)) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized && team.createdByUserId === userId) {
      isAuthorized = true;
    }

    if (!isAuthorized && team.companyId) {
      const companyMembership = await prisma.companyMembership.findUnique({
        where: {
          companyId_userId: { companyId: team.companyId, userId },
        },
        select: {
          role: true,
          status: true,
          deactivatedAt: true,
          user: { select: { status: true } },
        },
      });
      const allowedCompanyRoles: CompanyRole[] = [
        CompanyRole.OWNER,
        CompanyRole.ADMIN,
      ];
      if (
        companyMembership &&
        companyMembership.status === CompanyMembershipStatus.ACTIVE &&
        companyMembership.deactivatedAt === null &&
        companyMembership.user?.status === UserStatus.ACTIVE &&
        allowedCompanyRoles.includes(companyMembership.role as CompanyRole)
      ) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      throw ForbiddenError("Not authorized to rename this team");
    }

    if (team.companyId) {
      const existing = await prisma.team.findFirst({
        where: {
          companyId: team.companyId,
          id: { not: teamId },
          name: { equals: trimmedName, mode: "insensitive" },
        },
        select: { id: true },
      });
      if (existing) {
        throw BadRequestError("A team with this name already exists");
      }
    }

    if (team.name === trimmedName) {
      logger.info("Team name unchanged", { teamId, userId });
      return team;
    }

    const updated = await prisma.team.update({
      where: { id: teamId },
      data: { name: trimmedName },
      select: { id: true, name: true, companyId: true, isPersonal: true },
    });

    logger.info("Updated team name", { teamId, userId, name: trimmedName });
    return updated;
  } catch (error) {
    if ((error as any)?.status) {
      logger.warn("Failed to update team name", { teamId, userId, error });
    } else {
      logger.error("Failed to update team name", { teamId, userId, error });
    }
    throw error;
  }
}

export async function dbUpdateTeamDescription(params: {
  teamId: string;
  userId: string;
  description: string | null;
}) {
  const { teamId, userId, description } = params;
  try {
    const trimmedDescription = description?.trim() || null;

    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: {
        id: true,
        description: true,
        companyId: true,
        isPersonal: true,
        createdByUserId: true,
      },
    });

    if (!team) {
      throw NotFoundError("Team not found");
    }

    const membership = await prisma.teamMembership.findUnique({
      where: { teamId_userId: { teamId, userId } },
      select: { role: true },
    });

    let isAuthorized = false;
    if (membership) {
      const allowedTeamRoles: TeamRole[] = ["OWNER", "ADMIN"];
      if (allowedTeamRoles.includes(membership.role as TeamRole)) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized && team.createdByUserId === userId) {
      isAuthorized = true;
    }

    if (!isAuthorized && team.companyId) {
      const companyMembership = await prisma.companyMembership.findUnique({
        where: {
          companyId_userId: { companyId: team.companyId, userId },
        },
        select: {
          role: true,
          status: true,
          deactivatedAt: true,
          user: { select: { status: true } },
        },
      });
      const allowedCompanyRoles: CompanyRole[] = [
        CompanyRole.OWNER,
        CompanyRole.ADMIN,
      ];
      if (
        companyMembership &&
        companyMembership.status === CompanyMembershipStatus.ACTIVE &&
        companyMembership.deactivatedAt === null &&
        companyMembership.user?.status === UserStatus.ACTIVE &&
        allowedCompanyRoles.includes(companyMembership.role as CompanyRole)
      ) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      throw ForbiddenError("Not authorized to update this team description");
    }

    if (team.description === trimmedDescription) {
      logger.info("Team description unchanged", { teamId, userId });
      return team;
    }

    const updated = await prisma.team.update({
      where: { id: teamId },
      data: { description: trimmedDescription },
      select: {
        id: true,
        description: true,
        companyId: true,
        isPersonal: true,
      },
    });

    logger.info("Updated team description", { teamId, userId });
    return updated;
  } catch (error) {
    if ((error as any)?.status) {
      logger.warn("Failed to update team description", {
        teamId,
        userId,
        error,
      });
    } else {
      logger.error("Failed to update team description", {
        teamId,
        userId,
        error,
      });
    }
    throw error;
  }
}

export async function dbUpdateTeamJoinPolicy(params: {
  teamId: string;
  userId: string;
  joinPolicy: TeamJoinPolicy;
}) {
  const { teamId, userId, joinPolicy } = params;
  try {
    if (!Object.values(TeamJoinPolicy).includes(joinPolicy)) {
      throw BadRequestError("Invalid team join policy");
    }

    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: {
        id: true,
        companyId: true,
        isPersonal: true,
        createdByUserId: true,
        joinPolicy: true,
        isDefaultForCompany: true,
      },
    });

    if (!team) {
      throw NotFoundError("Team not found");
    }

    if (team.isPersonal) {
      throw BadRequestError("Cannot change join settings for personal teams");
    }

    const membership = await prisma.teamMembership.findUnique({
      where: { teamId_userId: { teamId, userId } },
      select: { role: true },
    });

    let isAuthorized = false;
    if (membership) {
      const allowedTeamRoles: TeamRole[] = ["OWNER", "ADMIN"];
      if (allowedTeamRoles.includes(membership.role as TeamRole)) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized && team.createdByUserId === userId) {
      isAuthorized = true;
    }

    if (!isAuthorized && team.companyId) {
      const companyMembership = await prisma.companyMembership.findUnique({
        where: {
          companyId_userId: { companyId: team.companyId, userId },
        },
        select: {
          role: true,
          status: true,
          deactivatedAt: true,
          user: { select: { status: true } },
        },
      });
      const allowedCompanyRoles: CompanyRole[] = [
        CompanyRole.OWNER,
        CompanyRole.ADMIN,
      ];
      if (
        companyMembership &&
        companyMembership.status === CompanyMembershipStatus.ACTIVE &&
        companyMembership.deactivatedAt === null &&
        companyMembership.user?.status === UserStatus.ACTIVE &&
        allowedCompanyRoles.includes(companyMembership.role as CompanyRole)
      ) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      throw ForbiddenError("Not authorized to update team join settings");
    }

    if (joinPolicy === TeamJoinPolicy.AUTO_JOIN && !team.companyId) {
      throw BadRequestError(
        "Auto-join policy requires the team to belong to a company"
      );
    }

    if (team.isDefaultForCompany && team.joinPolicy !== joinPolicy) {
      throw BadRequestError(
        "Cannot change join policy for a company's default team"
      );
    }

    if (team.joinPolicy === joinPolicy) {
      logger.info("Team join policy unchanged", { teamId, userId });
      return team;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const updatedTeam = await tx.team.update({
        where: { id: teamId },
        data: { joinPolicy },
        select: { id: true, joinPolicy: true, companyId: true },
      });

      if (joinPolicy === TeamJoinPolicy.AUTO_JOIN) {
        // Delete all pending team join requests when changing to AUTO_JOIN
        const deletedRequests = await tx.teamMembership.deleteMany({
          where: {
            teamId,
            status: "PENDING",
          },
        });

        if (deletedRequests.count > 0) {
          logger.info("Deleted pending team join requests for AUTO_JOIN team", {
            teamId,
            count: deletedRequests.count,
          });
        }

        if (updatedTeam.companyId) {
          await addUsersToAutoJoinTeams(tx, updatedTeam.companyId);
        }
      }

      return updatedTeam;
    });

    logger.info("Updated team join policy", { teamId, userId, joinPolicy });
    return updated;
  } catch (error) {
    if ((error as any)?.status) {
      logger.warn("Failed to update team join policy", {
        teamId,
        userId,
        error,
      });
    } else {
      logger.error("Failed to update team join policy", {
        teamId,
        userId,
        error,
      });
    }
    throw error;
  }
}

export async function dbListCompanyTeams(companyId: string) {
  try {
    // First, get the company's disablePersonalTeams setting
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { disablePersonalTeams: true },
    });

    const teams = await prisma.team.findMany({
      where: {
        companyId,
        // Filter out personal teams if disabled for the company
        ...(company?.disablePersonalTeams ? { isPersonal: false } : {}),
      },
      include: {
        _count: {
          select: {
            memberships: {
              where: { status: "ACTIVE" },
            },
          },
        },
        memberships: {
          include: {
            user: {
              include: {
                sessions: {
                  select: { updatedAt: true },
                  orderBy: { updatedAt: "desc" },
                  take: 1,
                },
              },
            },
          },
          orderBy: { joinedAt: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    logger.info("Listed company teams", {
      companyId,
      count: teams.length,
      disablePersonalTeams: company?.disablePersonalTeams,
    });
    return teams.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      isPersonal: t.isPersonal,
      isDefaultForCompany: t.isDefaultForCompany,
      joinPolicy: t.joinPolicy,
      balanceCents: t.balanceCents,
      createdAt: t.createdAt,
      memberCount: t._count.memberships,
      members: t.memberships.map((membership) => {
        const { sessions, ...user } = membership.user as any;
        return {
          id: membership.id,
          teamId: membership.teamId,
          userId: membership.userId,
          role: membership.role,
          status: membership.status,
          joinedAt: membership.joinedAt,
          user: {
            ...user,
            lastAccessedAt: sessions?.[0]?.updatedAt ?? null,
          },
        };
      }),
    }));
  } catch (error) {
    logger.error("Failed to list company teams", { companyId, error });
    throw error;
  }
}
