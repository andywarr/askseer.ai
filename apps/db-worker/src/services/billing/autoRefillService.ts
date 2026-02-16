import prisma from "../db.ts";
import { CompanyMembershipStatus, CompanyRole, TeamRole } from "@prisma/client";
import { logger } from "@/apps/shared/logger.ts";
import {
  PERSONAL_STUDY_COST_CENTS,
  COMPANY_STUDY_COST_CENTS,
} from "@/apps/shared/constants.ts";
import {
  BadRequestError,
  NotFoundError,
  ForbiddenError,
} from "../shared/errors.ts";

// ============================================================================
// Authorization Helper
// ============================================================================

async function checkTeamAutoRefillAuthorization(
  teamId: string,
  userId: string
) {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { id: true, companyId: true, isPersonal: true },
  });

  if (!team) {
    return { isAuthorized: false, team: null };
  }

  // Check if user is team admin or owner
  const membership = await prisma.teamMembership.findUnique({
    where: { teamId_userId: { teamId, userId } },
    select: { role: true },
  });

  const allowedTeamRoles: TeamRole[] = [TeamRole.OWNER, TeamRole.ADMIN];
  let isAuthorized =
    !!membership && allowedTeamRoles.includes(membership.role as TeamRole);

  // If not team admin, check if company admin
  if (!isAuthorized && team.companyId) {
    const companyMembership = await prisma.companyMembership.findUnique({
      where: {
        companyId_userId: { companyId: team.companyId, userId },
      },
      select: {
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

  return { isAuthorized, team };
}

// ============================================================================
// Auto-Refill Settings
// ============================================================================

export async function dbGetTeamAutoRefillSettings(
  teamId: string,
  userId: string
) {
  try {
    // Check authorization
    const { isAuthorized, team: authTeam } =
      await checkTeamAutoRefillAuthorization(teamId, userId);

    if (!authTeam) {
      throw NotFoundError("Team not found");
    }

    if (!isAuthorized) {
      throw ForbiddenError("Not authorized to view team auto-refill settings");
    }

    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: {
        id: true,
        name: true,
        balanceCents: true,
        autoRefillEnabled: true,
        autoRefillThreshold: true,
        autoRefillAmount: true,
        stripeCustomerId: true,
        stripePaymentMethodId: true,
        paymentMethodLast4: true,
        paymentMethodBrand: true,
        autoRefillUpdatedAt: true,
        autoRefillUpdatedById: true,
        autoRefillUpdatedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        companyId: true,
        isPersonal: true,
      },
    });

    logger.info("Retrieved team auto-refill settings", { teamId, userId });
    return team;
  } catch (error) {
    logger.error("Failed to get team auto-refill settings", { teamId, error });
    throw error;
  }
}

export async function dbUpdateTeamAutoRefillSettings(params: {
  teamId: string;
  userId: string;
  autoRefillEnabled: boolean;
  autoRefillThreshold?: number | null;
  autoRefillAmount?: number | null;
}) {
  const {
    teamId,
    userId,
    autoRefillEnabled,
    autoRefillThreshold,
    autoRefillAmount,
  } = params;

  try {
    // Check authorization
    const { isAuthorized, team: authTeam } =
      await checkTeamAutoRefillAuthorization(teamId, userId);

    if (!authTeam) {
      throw NotFoundError("Team not found");
    }

    if (!isAuthorized) {
      throw ForbiddenError(
        "Not authorized to update team auto-refill settings"
      );
    }

    // Validate settings if enabling auto-refill
    if (autoRefillEnabled) {
      if (!autoRefillThreshold || autoRefillThreshold < 0) {
        throw BadRequestError(
          "Auto-refill threshold must be a positive number"
        );
      }
      const minRefillCents = authTeam.companyId
        ? COMPANY_STUDY_COST_CENTS
        : PERSONAL_STUDY_COST_CENTS;
      if (!autoRefillAmount || autoRefillAmount < minRefillCents) {
        throw BadRequestError(
          `Auto-refill amount must be at least $${(minRefillCents / 100).toFixed(2)}`
        );
      }

      // Check if payment method is saved
      const team = await prisma.team.findUnique({
        where: { id: teamId },
        select: { stripePaymentMethodId: true },
      });

      if (!team?.stripePaymentMethodId) {
        throw BadRequestError(
          "A payment method must be saved before enabling auto-refill"
        );
      }
    }

    const updated = await prisma.team.update({
      where: { id: teamId },
      data: {
        autoRefillEnabled,
        autoRefillThreshold: autoRefillEnabled ? autoRefillThreshold : null,
        autoRefillAmount: autoRefillEnabled ? autoRefillAmount : null,
        autoRefillUpdatedAt: new Date(),
        autoRefillUpdatedById: userId,
      },
      select: {
        id: true,
        autoRefillEnabled: true,
        autoRefillThreshold: true,
        autoRefillAmount: true,
        autoRefillUpdatedAt: true,
      },
    });

    logger.info("Updated team auto-refill settings", {
      teamId,
      userId,
      autoRefillEnabled,
      autoRefillThreshold,
      autoRefillAmount,
    });

    return updated;
  } catch (error) {
    logger.error("Failed to update team auto-refill settings", {
      teamId,
      userId,
      error,
    });
    throw error;
  }
}

export async function dbUpdateTeamStripeCustomer(params: {
  teamId: string;
  userId: string;
  stripeCustomerId: string;
}) {
  const { teamId, userId, stripeCustomerId } = params;

  try {
    // Check authorization
    const { isAuthorized, team: authTeam } =
      await checkTeamAutoRefillAuthorization(teamId, userId);

    if (!authTeam) {
      throw NotFoundError("Team not found");
    }

    if (!isAuthorized) {
      throw ForbiddenError("Not authorized to update team payment settings");
    }

    const updated = await prisma.team.update({
      where: { id: teamId },
      data: {
        stripeCustomerId,
        autoRefillUpdatedAt: new Date(),
        autoRefillUpdatedById: userId,
      },
      select: {
        id: true,
        stripeCustomerId: true,
      },
    });

    logger.info("Updated team Stripe customer", {
      teamId,
      userId,
      stripeCustomerId,
    });
    return updated;
  } catch (error) {
    logger.error("Failed to update team Stripe customer", {
      teamId,
      userId,
      error,
    });
    throw error;
  }
}

export async function dbUpdateTeamPaymentMethod(params: {
  teamId: string;
  userId: string;
  stripePaymentMethodId: string;
  paymentMethodLast4: string;
  paymentMethodBrand: string;
}) {
  const {
    teamId,
    userId,
    stripePaymentMethodId,
    paymentMethodLast4,
    paymentMethodBrand,
  } = params;

  try {
    // Check authorization
    const { isAuthorized, team: authTeam } =
      await checkTeamAutoRefillAuthorization(teamId, userId);

    if (!authTeam) {
      throw NotFoundError("Team not found");
    }

    if (!isAuthorized) {
      throw ForbiddenError("Not authorized to update team payment settings");
    }

    const updated = await prisma.team.update({
      where: { id: teamId },
      data: {
        stripePaymentMethodId,
        paymentMethodLast4,
        paymentMethodBrand,
        autoRefillUpdatedAt: new Date(),
        autoRefillUpdatedById: userId,
      },
      select: {
        id: true,
        stripePaymentMethodId: true,
        paymentMethodLast4: true,
        paymentMethodBrand: true,
      },
    });

    logger.info("Updated team payment method", {
      teamId,
      userId,
      paymentMethodLast4,
      paymentMethodBrand,
    });
    return updated;
  } catch (error) {
    logger.error("Failed to update team payment method", {
      teamId,
      userId,
      error,
    });
    throw error;
  }
}

export async function dbRemoveTeamPaymentMethod(params: {
  teamId: string;
  userId: string;
}) {
  const { teamId, userId } = params;

  try {
    // Check authorization
    const { isAuthorized, team: authTeam } =
      await checkTeamAutoRefillAuthorization(teamId, userId);

    if (!authTeam) {
      throw NotFoundError("Team not found");
    }

    if (!isAuthorized) {
      throw ForbiddenError("Not authorized to remove team payment method");
    }

    const updated = await prisma.team.update({
      where: { id: teamId },
      data: {
        stripePaymentMethodId: null,
        paymentMethodLast4: null,
        paymentMethodBrand: null,
        autoRefillEnabled: false, // Disable auto-refill when removing payment method
        autoRefillUpdatedAt: new Date(),
        autoRefillUpdatedById: userId,
      },
      select: {
        id: true,
        autoRefillEnabled: true,
      },
    });

    logger.info("Removed team payment method and disabled auto-refill", {
      teamId,
      userId,
    });
    return updated;
  } catch (error) {
    logger.error("Failed to remove team payment method", {
      teamId,
      userId,
      error,
    });
    throw error;
  }
}

export async function dbGetTeamsNeedingAutoRefill(teamId: string) {
  try {
    // Get the team and check if it needs auto-refill
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: {
        id: true,
        name: true,
        balanceCents: true,
        autoRefillEnabled: true,
        autoRefillThreshold: true,
        autoRefillAmount: true,
        stripeCustomerId: true,
        stripePaymentMethodId: true,
        companyId: true,
        isPersonal: true,
      },
    });

    if (!team) {
      return null;
    }

    // Check if auto-refill is needed
    const needsRefill =
      team.autoRefillEnabled &&
      team.stripePaymentMethodId &&
      team.stripeCustomerId &&
      team.autoRefillThreshold !== null &&
      team.autoRefillAmount !== null &&
      team.balanceCents <= team.autoRefillThreshold;

    if (!needsRefill) {
      return null;
    }

    logger.info("Team needs auto-refill", {
      teamId: team.id,
      balanceCents: team.balanceCents,
      threshold: team.autoRefillThreshold,
      amount: team.autoRefillAmount,
    });

    return team;
  } catch (error) {
    logger.error("Failed to check team auto-refill status", { teamId, error });
    throw error;
  }
}
