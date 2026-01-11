import prisma from "../db.ts";
import type { TeamRole } from "@prisma/client";
import {
  CompanyMembershipStatus,
  CompanyRole,
  NotificationType,
  NotificationAudience,
  TeamJoinPolicy,
  TeamMembershipStatus,
} from "@prisma/client";
import { logger } from "@/apps/shared/logger.ts";
import { BadRequestError, NotFoundError, ForbiddenError } from "../shared/errors.ts";
import { dbCreateNotification } from "../user/notificationService.ts";

// ============================================================================
// Team Join Requests
// ============================================================================

export async function dbRequestTeamJoin(params: {
  teamId: string;
  userId: string;
  requestNote?: string;
}) {
  const { teamId, userId, requestNote } = params;

  try {
    // Get team and verify it allows requests
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: { id: true, companyId: true, joinPolicy: true, isPersonal: true },
    });

    if (!team) {
      throw NotFoundError("Team not found");
    }

    if (team.isPersonal) {
      throw BadRequestError("Cannot request to join personal teams");
    }

    if (team.joinPolicy !== TeamJoinPolicy.REQUEST_TO_JOIN) {
      throw BadRequestError("This team does not allow join requests");
    }

    // Verify user is a company member
    if (team.companyId) {
      const companyMembership = await prisma.companyMembership.findFirst({
        where: {
          companyId: team.companyId,
          userId,
          status: CompanyMembershipStatus.ACTIVE,
          deactivatedAt: null,
        },
      });

      if (!companyMembership) {
        throw ForbiddenError(
          "You must be a company member to request to join this team"
        );
      }
    }

    // Check if already a member or has pending request
    const existing = await prisma.teamMembership.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });

    if (existing) {
      if (existing.status === "ACTIVE") {
        throw BadRequestError("You are already a member of this team");
      } else {
        throw BadRequestError(
          "You already have a pending request for this team"
        );
      }
    }

    // Create pending membership
    const membership = await prisma.teamMembership.create({
      data: {
        teamId,
        userId,
        role: "MEMBER" as TeamRole,
        status: "PENDING",
        requestNote: requestNote || null,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        team: {
          select: {
            id: true,
            name: true,
            memberships: {
              where: {
                status: TeamMembershipStatus.ACTIVE,
                role: { in: ["ADMIN", "OWNER"] },
              },
              select: {
                userId: true,
                role: true,
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    // Create in-app notifications for team admins/owners
    const adminUserIds = membership.team.memberships
      .map((m) => m.user?.id)
      .filter((id): id is string => Boolean(id) && id !== userId);

    const requesterName =
      membership.user?.name || membership.user?.email || "A user";
    const teamName = membership.team?.name || "your team";

    for (const adminUserId of adminUserIds) {
      try {
        await dbCreateNotification({
          userId: adminUserId,
          type: NotificationType.TEAM_JOIN_REQUEST,
          audience: NotificationAudience.ADMIN,
          title: "New join request",
          message: `${requesterName} requested to join ${teamName}`,
          actionUrl: `/teams?teamId=${teamId}`,
          metadata: { teamId, requesterId: userId, requesterName },
        });
      } catch (notifError) {
        logger.error("Failed to create team join request notification", {
          teamId,
          adminUserId,
          error: (notifError as Error)?.message,
        });
        // Don't throw - notification failure shouldn't block the request
      }
    }

    logger.info("Created pending team membership request", { teamId, userId });
    return membership;
  } catch (error) {
    logger.error("Failed to create team join request", {
      teamId,
      userId,
      error,
    });
    throw error;
  }
}

export async function dbGetTeamJoinRequests(teamId: string) {
  try {
    const requests = await prisma.teamMembership.findMany({
      where: {
        teamId,
        status: "PENDING",
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            createdAt: true,
          },
        },
      },
      orderBy: {
        joinedAt: "desc",
      },
    });

    logger.info("Retrieved pending team join requests", {
      teamId,
      count: requests.length,
    });
    return requests;
  } catch (error) {
    logger.error("Failed to get team join requests", { teamId, error });
    throw error;
  }
}

export async function dbAcceptTeamJoinRequest(params: {
  teamId: string;
  userId: string;
  acceptedById: string;
}) {
  const { teamId, userId, acceptedById } = params;

  try {
    // Verify the requester is a team admin
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: { id: true, companyId: true, isPersonal: true },
    });

    if (!team) {
      throw NotFoundError("Team not found");
    }

    // Check if acceptedBy user is team admin or owner
    const adminMembership = await prisma.teamMembership.findUnique({
      where: { teamId_userId: { teamId, userId: acceptedById } },
    });

    const allowedRoles: TeamRole[] = ["ADMIN", "OWNER"];
    let isAuthorized =
      adminMembership &&
      adminMembership.status === "ACTIVE" &&
      allowedRoles.includes(adminMembership.role as TeamRole);

    // If not team admin, check if company admin
    if (!isAuthorized && team.companyId) {
      const companyMembership = await prisma.companyMembership.findFirst({
        where: {
          companyId: team.companyId,
          userId: acceptedById,
          status: CompanyMembershipStatus.ACTIVE,
        },
      });
      const allowedCompanyRoles = [CompanyRole.OWNER, CompanyRole.ADMIN];
      isAuthorized =
        !!companyMembership &&
        allowedCompanyRoles.includes(
          companyMembership.role as "OWNER" | "ADMIN"
        );
    }

    if (!isAuthorized) {
      throw ForbiddenError("Not authorized to accept team join requests");
    }

    // Update the membership status to ACTIVE
    const membership = await prisma.teamMembership.update({
      where: { teamId_userId: { teamId, userId } },
      data: { status: "ACTIVE" },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        team: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Create notification for the requester
    const teamName = membership.team?.name || "the team";
    try {
      await dbCreateNotification({
        userId,
        type: NotificationType.TEAM_JOIN_APPROVED,
        audience: NotificationAudience.USER,
        title: "Join request approved",
        message: `Your request to join ${teamName} was approved`,
        actionUrl: `/studies?teamId=${teamId}`,
        metadata: { teamId },
      });
    } catch (notifError) {
      logger.error("Failed to create team join approval notification", {
        teamId,
        userId,
        error: (notifError as Error)?.message,
      });
    }

    logger.info("Accepted team join request", { teamId, userId, acceptedById });
    return membership;
  } catch (error) {
    logger.error("Failed to accept team join request", {
      teamId,
      userId,
      error,
    });
    throw error;
  }
}

export async function dbRejectTeamJoinRequest(params: {
  teamId: string;
  userId: string;
  rejectedById: string;
  rejectReason?: string;
}) {
  const { teamId, userId, rejectedById, rejectReason } = params;

  try {
    // Verify the requester is a team admin
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: { id: true, companyId: true, isPersonal: true },
    });

    if (!team) {
      throw NotFoundError("Team not found");
    }

    // Check if rejectedBy user is team admin or owner
    const adminMembership = await prisma.teamMembership.findUnique({
      where: { teamId_userId: { teamId, userId: rejectedById } },
    });

    const allowedRoles: TeamRole[] = ["ADMIN", "OWNER"];
    let isAuthorized =
      adminMembership &&
      adminMembership.status === "ACTIVE" &&
      allowedRoles.includes(adminMembership.role as TeamRole);

    // If not team admin, check if company admin
    if (!isAuthorized && team.companyId) {
      const companyMembership = await prisma.companyMembership.findFirst({
        where: {
          companyId: team.companyId,
          userId: rejectedById,
          status: CompanyMembershipStatus.ACTIVE,
        },
      });
      const allowedCompanyRoles = [CompanyRole.OWNER, CompanyRole.ADMIN];
      isAuthorized =
        !!companyMembership &&
        allowedCompanyRoles.includes(
          companyMembership.role as "OWNER" | "ADMIN"
        );
    }

    if (!isAuthorized) {
      throw ForbiddenError("Not authorized to reject team join requests");
    }

    const membership = await prisma.teamMembership.findUnique({
      where: { teamId_userId: { teamId, userId } },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        team: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!membership) {
      throw NotFoundError("Join request not found");
    }

    // Delete the pending membership
    await prisma.teamMembership.delete({
      where: { teamId_userId: { teamId, userId } },
    });

    // Create notification for the requester
    const teamName = membership.team?.name || "the team";
    try {
      await dbCreateNotification({
        userId,
        type: NotificationType.TEAM_JOIN_REJECTED,
        audience: NotificationAudience.USER,
        title: "Join request declined",
        message: rejectReason
          ? `Your request to join ${teamName} was declined: ${rejectReason}`
          : `Your request to join ${teamName} was declined`,
        actionUrl: `/team`,
        metadata: { teamId, teamName, rejectReason: rejectReason || null },
      });
    } catch (notifError) {
      logger.error("Failed to create team join rejection notification", {
        teamId,
        userId,
        error: (notifError as Error)?.message,
      });
    }

    logger.info("Rejected team join request", { teamId, userId, rejectedById });
    return membership;
  } catch (error) {
    logger.error("Failed to reject team join request", {
      teamId,
      userId,
      error,
    });
    throw error;
  }
}
