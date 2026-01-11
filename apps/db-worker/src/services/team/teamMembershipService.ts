import prisma from "../db.ts";
import type { TeamRole } from "@prisma/client";
import {
  CompanyMembershipStatus,
  CompanyRole,
  UserStatus,
} from "@prisma/client";
import { logger } from "@/apps/shared/logger.ts";
import {
  BadRequestError,
  NotFoundError,
  ForbiddenError,
} from "../shared/errors.ts";

// ============================================================================
// Team Membership Operations
// ============================================================================

export async function dbAddTeamMembers(params: {
  teamId: string;
  members: Array<{ userId: string; role: TeamRole }>;
  invitedById: string;
}) {
  const { teamId, members, invitedById } = params;
  try {
    if (!members.length) {
      return [];
    }

    const uniqueMembers = members.filter(
      (member, index, arr) =>
        member.userId &&
        arr.findIndex((other) => other.userId === member.userId) === index
    );

    return await prisma.$transaction(async (tx) => {
      const team = await tx.team.findUnique({
        where: { id: teamId },
        select: { id: true, companyId: true, isPersonal: true },
      });

      if (!team) {
        throw NotFoundError("Team not found");
      }

      if (team.isPersonal) {
        throw BadRequestError("Cannot invite members to personal teams");
      }

      if (!team.companyId) {
        throw BadRequestError("Team is not associated with a company");
      }

      const inviterMembership = await tx.teamMembership.findUnique({
        where: { teamId_userId: { teamId, userId: invitedById } },
        select: { role: true },
      });

      const allowedTeamRoles: TeamRole[] = ["OWNER", "ADMIN"];
      let isAuthorized =
        !!inviterMembership &&
        allowedTeamRoles.includes(inviterMembership.role as TeamRole);

      if (!isAuthorized) {
        const companyMembership = await tx.companyMembership.findUnique({
          where: {
            companyId_userId: {
              companyId: team.companyId,
              userId: invitedById,
            },
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
        isAuthorized =
          !!companyMembership &&
          companyMembership.status === CompanyMembershipStatus.ACTIVE &&
          companyMembership.deactivatedAt === null &&
          companyMembership.user?.status === UserStatus.ACTIVE &&
          allowedCompanyRoles.includes(companyMembership.role as CompanyRole);
      }

      if (!isAuthorized) {
        throw ForbiddenError("Not authorized to invite members to this team");
      }

      const allowedInviteRoles: TeamRole[] = ["ADMIN", "MEMBER", "VIEWER"];

      for (const member of uniqueMembers) {
        if (!allowedInviteRoles.includes(member.role)) {
          throw BadRequestError("Invalid team role for invite");
        }
      }

      const memberIds = uniqueMembers.map((m) => m.userId);

      logger.info("Adding members to team - validation starting", {
        teamId,
        memberCount: memberIds.length,
        memberIds,
        companyId: team.companyId,
      });

      const existing = await tx.teamMembership.findMany({
        where: {
          teamId,
          userId: { in: memberIds },
          status: "ACTIVE",
        },
        select: { userId: true },
      });
      if (existing.length) {
        logger.warn("Some members already on team", {
          teamId,
          existingUserIds: existing.map((m) => m.userId),
        });
        const err = BadRequestError("Some users are already on this team");
        (err as any).details = existing.map((m) => m.userId);
        throw err;
      }

      const validCompanyMembers = await tx.companyMembership.findMany({
        where: {
          companyId: team.companyId!,
          userId: { in: memberIds },
          status: CompanyMembershipStatus.ACTIVE,
          deactivatedAt: null,
          user: { status: UserStatus.ACTIVE },
        },
        select: { userId: true },
      });

      logger.info("Company membership validation results", {
        teamId,
        requestedCount: memberIds.length,
        validCount: validCompanyMembers.length,
        validUserIds: validCompanyMembers.map((m) => m.userId),
      });

      const validSet = new Set(validCompanyMembers.map((m) => m.userId));
      const invalid = uniqueMembers.filter((m) => !validSet.has(m.userId));
      if (invalid.length) {
        logger.error("Invalid members - not in company", {
          teamId,
          companyId: team.companyId,
          invalidUserIds: invalid.map((m) => m.userId),
        });
        const err = BadRequestError(
          "All members must belong to the same company"
        );
        (err as any).details = invalid.map((m) => m.userId);
        throw err;
      }

      // Check for PENDING memberships (join requests) that can be upgraded
      const pendingMemberships = await tx.teamMembership.findMany({
        where: {
          teamId,
          userId: { in: memberIds },
          status: "PENDING",
        },
        select: { userId: true },
      });
      const pendingUserIds = new Set(pendingMemberships.map((m) => m.userId));

      const created = [] as Array<{ id: string; userId: string }>;
      for (const member of uniqueMembers) {
        // If user has a pending join request, upgrade it to ACTIVE with the specified role
        if (pendingUserIds.has(member.userId)) {
          const updatedMembership = await tx.teamMembership.update({
            where: { teamId_userId: { teamId, userId: member.userId } },
            data: {
              status: "ACTIVE",
              role: member.role,
            },
            select: { id: true, userId: true },
          });
          created.push(updatedMembership);
        } else {
          // Otherwise, create a new membership
          const createdMembership = await tx.teamMembership.create({
            data: {
              teamId,
              userId: member.userId,
              role: member.role,
            },
            select: { id: true, userId: true },
          });
          created.push(createdMembership);
        }
      }

      logger.info("Added members to team", {
        teamId,
        invitedById,
        added: created.length,
      });

      return created;
    });
  } catch (error) {
    logger.error("Failed to add members to team", {
      teamId,
      invitedById,
      error,
    });
    throw error;
  }
}

export async function dbRemoveTeamMember(params: {
  teamId: string;
  userId: string;
  requestedById: string;
}) {
  const { teamId, userId, requestedById } = params;

  try {
    return await prisma.$transaction(async (tx) => {
      const team = await tx.team.findUnique({
        where: { id: teamId },
        select: { id: true, companyId: true, isPersonal: true },
      });

      if (!team) {
        throw NotFoundError("Team not found");
      }

      if (team.isPersonal) {
        throw BadRequestError("Cannot remove members from personal teams");
      }

      const membership = await tx.teamMembership.findUnique({
        where: { teamId_userId: { teamId, userId } },
        select: { id: true },
      });

      if (!membership) {
        throw NotFoundError("User is not a member of this team");
      }

      const requesterTeamMembership = await tx.teamMembership.findUnique({
        where: { teamId_userId: { teamId, userId: requestedById } },
        select: { role: true },
      });

      const allowedTeamRoles: TeamRole[] = ["OWNER", "ADMIN"];
      let isAuthorized =
        !!requesterTeamMembership &&
        allowedTeamRoles.includes(requesterTeamMembership.role as TeamRole);

      if (!isAuthorized && team.companyId) {
        const companyMembership = await tx.companyMembership.findUnique({
          where: {
            companyId_userId: {
              companyId: team.companyId,
              userId: requestedById,
            },
          },
          select: {
            id: true,
            companyId: true,
            userId: true,
            role: true,
            canCreatePersonas: true,
            status: true,
            joinedAt: true,
            deactivatedAt: true,
            invitedById: true,
          },
        });

        const allowedCompanyRoles: CompanyRole[] = [
          CompanyRole.OWNER,
          CompanyRole.ADMIN,
        ];

        isAuthorized =
          !!companyMembership &&
          companyMembership.status === CompanyMembershipStatus.ACTIVE &&
          companyMembership.deactivatedAt === null &&
          allowedCompanyRoles.includes(companyMembership.role as CompanyRole);
      }

      if (!isAuthorized) {
        throw ForbiddenError("Not authorized to remove team members");
      }

      await tx.teamMembership.delete({
        where: { teamId_userId: { teamId, userId } },
      });

      logger.info("Removed member from team", {
        teamId,
        userId,
        requestedById,
      });

      return { success: true };
    });
  } catch (error) {
    logger.error("Failed to remove team member", {
      teamId,
      userId,
      requestedById,
      error,
    });
    throw error;
  }
}

export async function dbUpdateTeamMemberRole(params: {
  teamId: string;
  userId: string;
  role: TeamRole;
  requestedById: string;
}) {
  const { teamId, userId, role, requestedById } = params;

  try {
    return await prisma.$transaction(async (tx) => {
      const team = await tx.team.findUnique({
        where: { id: teamId },
        select: { id: true, companyId: true, isPersonal: true },
      });

      if (!team) {
        throw NotFoundError("Team not found");
      }

      if (team.isPersonal) {
        throw BadRequestError("Cannot change member roles in personal teams");
      }

      const membership = await tx.teamMembership.findUnique({
        where: { teamId_userId: { teamId, userId } },
        select: { id: true, role: true },
      });

      if (!membership) {
        throw NotFoundError("User is not a member of this team");
      }

      // Cannot change own role
      if (userId === requestedById) {
        throw BadRequestError("Cannot change your own role");
      }

      // Check if requester is authorized
      const requesterTeamMembership = await tx.teamMembership.findUnique({
        where: { teamId_userId: { teamId, userId: requestedById } },
        select: { role: true },
      });

      const allowedTeamRoles: TeamRole[] = ["OWNER", "ADMIN"];
      let isAuthorized =
        !!requesterTeamMembership &&
        allowedTeamRoles.includes(requesterTeamMembership.role as TeamRole);

      // Only team owner can change a member to owner or change another owner's role
      const targetRole = String(membership.role).toUpperCase();
      if (
        isAuthorized &&
        requesterTeamMembership?.role !== "OWNER" &&
        (role === "OWNER" || targetRole === "OWNER")
      ) {
        isAuthorized = false;
      }

      // Check company-level authorization
      if (!isAuthorized && team.companyId) {
        const companyMembership = await tx.companyMembership.findUnique({
          where: {
            companyId_userId: {
              companyId: team.companyId,
              userId: requestedById,
            },
          },
          select: {
            id: true,
            companyId: true,
            userId: true,
            role: true,
            status: true,
            deactivatedAt: true,
          },
        });

        const allowedCompanyRoles: CompanyRole[] = [
          CompanyRole.OWNER,
          CompanyRole.ADMIN,
        ];

        isAuthorized =
          !!companyMembership &&
          companyMembership.status === CompanyMembershipStatus.ACTIVE &&
          companyMembership.deactivatedAt === null &&
          allowedCompanyRoles.includes(companyMembership.role as CompanyRole);
      }

      if (!isAuthorized) {
        throw ForbiddenError("Not authorized to change team member roles");
      }

      // Update the role
      await tx.teamMembership.update({
        where: { teamId_userId: { teamId, userId } },
        data: { role },
      });

      logger.info("Updated team member role", {
        teamId,
        userId,
        role,
        requestedById,
      });

      return { success: true };
    });
  } catch (error) {
    logger.error("Failed to update team member role", {
      teamId,
      userId,
      role,
      requestedById,
      error,
    });
    throw error;
  }
}
