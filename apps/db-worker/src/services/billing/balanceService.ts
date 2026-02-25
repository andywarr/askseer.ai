import prisma from "../db.ts";
import type { Prisma, StudyType } from "@prisma/client";
import {
  NotificationType,
  NotificationAudience,
  TeamMembershipStatus,
  TeamRole,
} from "@prisma/client";
import { logger } from "@/apps/shared/logger.ts";
import { dbCreateNotification } from "../user/notificationService.ts";
import {
  PERSONAL_EVALUATION_COST_CENTS,
  PERSONAL_WALKTHROUGH_COST_CENTS,
  PERSONAL_PERSONA_COST_CENTS,
  COMPANY_EVALUATION_COST_CENTS,
  COMPANY_WALKTHROUGH_COST_CENTS,
  COMPANY_PERSONA_COST_CENTS,
  PERSONAL_QUAL_ANALYSIS_COST_CENTS,
  COMPANY_QUAL_ANALYSIS_COST_CENTS,
  PERSONAL_MIN_STUDY_COST_CENTS,
  COMPANY_MIN_STUDY_COST_CENTS,
} from "@/apps/shared/constants.ts";

// ============================================================================
// Balance Operations (cents)
// ============================================================================

/**
 * Get the study cost in cents based on team membership and study type.
 */
export function getStudyCostCents(
  companyId: string | null | undefined,
  studyType?: StudyType | null,
): number {
  if (companyId) {
    if (studyType === "PERSONA") return COMPANY_PERSONA_COST_CENTS;
    if (studyType === "QUAL_ANALYSIS") return COMPANY_QUAL_ANALYSIS_COST_CENTS;
    if (studyType === "COGNITIVE_WALKTHROUGH")
      return COMPANY_WALKTHROUGH_COST_CENTS;
    return COMPANY_EVALUATION_COST_CENTS;
  }
  if (studyType === "PERSONA") return PERSONAL_PERSONA_COST_CENTS;
  if (studyType === "QUAL_ANALYSIS") return PERSONAL_QUAL_ANALYSIS_COST_CENTS;
  if (studyType === "COGNITIVE_WALKTHROUGH")
    return PERSONAL_WALKTHROUGH_COST_CENTS;
  return PERSONAL_EVALUATION_COST_CENTS;
}

export async function dbAdjustTeamBalance(params: {
  teamId: string;
  amountCents: number;
  byUserId?: string | null;
  studyId?: string | null;
  reason?: string | null;
}) {
  const { teamId, amountCents, byUserId, studyId, reason } = params;
  try {
    // Check for duplicate Stripe purchases (idempotency)
    if (reason && reason.startsWith("stripe_purchase:")) {
      const existing = await prisma.balanceLedger.findFirst({
        where: {
          teamId,
          reason,
        },
      });

      if (existing) {
        logger.info("Balance adjustment already processed (idempotent)", {
          teamId,
          reason,
          existingId: existing.id,
        });
        // Return the current team state without making changes
        const team = await prisma.team.findUnique({
          where: { id: teamId },
          select: { id: true, balanceCents: true },
        });
        return team;
      }
    }

    // Get previous balance before adjustment (for threshold crossing detection)
    const previousTeam = await prisma.team.findUnique({
      where: { id: teamId },
      select: {
        balanceCents: true,
        companyId: true,
        name: true,
        autoRefillThreshold: true,
        memberships: {
          where: {
            status: TeamMembershipStatus.ACTIVE,
            role: { in: [TeamRole.ADMIN, TeamRole.OWNER] },
          },
          select: {
            userId: true,
          },
        },
      },
    });

    const previousBalance = previousTeam?.balanceCents ?? 0;
    // Use min study cost for threshold notifications so alerts fire
    // when no study type is affordable
    const studyCost = previousTeam?.companyId
      ? COMPANY_MIN_STUDY_COST_CENTS
      : PERSONAL_MIN_STUDY_COST_CENTS;

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.team.update({
        where: { id: teamId },
        data: { balanceCents: { increment: amountCents } },
        select: { id: true, balanceCents: true },
      });
      await tx.balanceLedger.create({
        data: {
          teamId,
          byUserId: byUserId || null,
          studyId: studyId || null,
          amountCents,
          reason: reason || null,
        },
      });
      return updated;
    });

    const newBalance = (result as any).balanceCents;

    logger.info("Adjusted team balance", {
      teamId,
      amountCents,
      byUserId,
      studyId,
      reason,
      newBalance,
    });

    // Send balance notifications for consumption (amountCents < 0)
    if (amountCents < 0 && previousTeam) {
      const threshold = previousTeam.autoRefillThreshold ?? studyCost * 2;
      const teamName = previousTeam.name || "Your team";
      const adminUserIds = previousTeam.memberships.map((m) => m.userId);
      const formattedBalance = `$${(newBalance / 100).toFixed(2)}`;

      // BALANCE_EXHAUSTED: Balance can no longer cover a study
      if (newBalance < studyCost && previousBalance >= studyCost) {
        for (const adminUserId of adminUserIds) {
          try {
            await dbCreateNotification({
              userId: adminUserId,
              type: NotificationType.BALANCE_EXHAUSTED,
              audience: NotificationAudience.ADMIN,
              title: "Insufficient funds",
              message: `${teamName} has insufficient funds (${formattedBalance}). Studies cannot be run until more funds are added.`,
              actionUrl: `/funds`,
              metadata: { teamId, balanceCents: newBalance },
            });
          } catch (notifError) {
            logger.error("Failed to create BALANCE_EXHAUSTED notification", {
              teamId,
              adminUserId,
              error: (notifError as Error)?.message,
            });
          }
        }
      }
      // BALANCE_LOW: Balance just crossed below threshold (but still can cover a study)
      else if (
        newBalance >= studyCost &&
        newBalance <= threshold &&
        previousBalance > threshold
      ) {
        for (const adminUserId of adminUserIds) {
          try {
            await dbCreateNotification({
              userId: adminUserId,
              type: NotificationType.BALANCE_LOW,
              audience: NotificationAudience.ADMIN,
              title: "Funds running low",
              message: `${teamName} has ${formattedBalance} remaining. Add more funds to continue running studies.`,
              actionUrl: `/funds`,
              metadata: { teamId, balanceCents: newBalance, threshold },
            });
          } catch (notifError) {
            logger.error("Failed to create BALANCE_LOW notification", {
              teamId,
              adminUserId,
              error: (notifError as Error)?.message,
            });
          }
        }
      }
    }

    return result;
  } catch (error) {
    logger.error("Failed to adjust team balance", {
      teamId,
      amountCents,
      byUserId,
      studyId,
      reason,
      error,
    });
    throw error;
  }
}

export async function dbConsumeBalanceForStudy(
  studyId: string,
  byUserId: string,
) {
  try {
    // Look up study to get teamId, companyId, and type
    const study = await prisma.study.findUnique({
      where: { id: studyId },
      select: {
        id: true,
        teamId: true,
        type: true,
        team: { select: { companyId: true } },
      },
    });
    if (!study) throw new Error("Study not found");
    const teamId = study.teamId;
    const studyCost = getStudyCostCents(study.team?.companyId, study.type);

    // Deduct study cost from team balance and record ledger
    const result = await dbAdjustTeamBalance({
      teamId,
      amountCents: -studyCost,
      byUserId,
      studyId,
      reason: "consume_study",
    });

    // Return with teamId so caller can trigger auto-refill check if needed
    return { ...result, teamId };
  } catch (error) {
    logger.error("Failed to consume balance for study", {
      studyId,
      byUserId,
      error,
    });
    throw error;
  }
}

export async function dbRefundBalanceForStudy(
  studyId: string,
  byUserId: string,
) {
  try {
    const study = await prisma.study.findUnique({
      where: { id: studyId },
      select: {
        id: true,
        teamId: true,
        type: true,
        team: { select: { companyId: true } },
      },
    });
    if (!study) throw new Error("Study not found");
    const teamId = study.teamId;
    const studyCost = getStudyCostCents(study.team?.companyId, study.type);
    return await dbAdjustTeamBalance({
      teamId,
      amountCents: studyCost,
      byUserId,
      studyId,
      reason: "refund_study",
    });
  } catch (error) {
    logger.error("Failed to refund balance for study", {
      studyId,
      byUserId,
      error,
    });
    throw error;
  }
}

export async function dbGetBalanceLedger(params: {
  userId: string;
  companyId?: string;
  isCompanyAdmin: boolean;
  teamIds: string[];
  page: number;
  pageSize: number;
  sortBy: "createdAt" | "amountCents" | "teamName" | "reason" | "byUserName";
  sortOrder: "asc" | "desc";
}) {
  const {
    userId,
    companyId,
    isCompanyAdmin,
    teamIds,
    page,
    pageSize,
    sortBy,
    sortOrder,
  } = params;

  try {
    // Build the where clause based on permissions
    let whereClause: Prisma.BalanceLedgerWhereInput = {};

    if (isCompanyAdmin && companyId) {
      // Company admins/owners can see all ledger entries for company teams
      whereClause = {
        team: {
          companyId,
        },
      };
    } else if (teamIds.length > 0) {
      // Team admins can only see entries for their teams
      whereClause = {
        teamId: {
          in: teamIds,
        },
      };
    } else {
      // No access - return empty
      return {
        entries: [],
        total: 0,
        page,
        pageSize,
        totalPages: 0,
      };
    }

    // Helper function to normalize reason to a sortable key
    const normalizeReason = (reason: string | null): string => {
      if (!reason) return "zzz_unknown"; // Sort nulls last
      const r = reason.toLowerCase();
      if (r.includes("adjustment")) return "adjustment";
      if (r.includes("grant") && r.includes("removed")) return "grant_removed";
      if (r.includes("grant")) return "grant";
      if (r.includes("migration")) return "migration";
      if (r.includes("purchase") || r.includes("stripe") || r.includes("fund"))
        return "funding";
      if (r.includes("refund")) return "refund";
      if (r.includes("consume") || r.includes("study")) return "study";
      if (r.includes("transfer")) return "transfer";
      return "zzz_" + reason; // Unknown reasons sort last
    };

    // For reason sorting, we need to fetch all entries for current filter,
    // sort in application layer, then paginate
    const isReasonSort = sortBy === "reason";

    // Build sort order for non-reason columns
    type OrderByType =
      | Prisma.BalanceLedgerOrderByWithRelationInput
      | Prisma.BalanceLedgerOrderByWithRelationInput[];
    let orderBy: OrderByType;

    switch (sortBy) {
      case "amountCents":
        orderBy = { amountCents: sortOrder };
        break;
      case "teamName":
        orderBy = { team: { name: sortOrder } };
        break;
      case "reason":
        // For reason, we'll sort in application layer, so just use createdAt for DB query
        orderBy = { createdAt: "desc" };
        break;
      case "byUserName":
        // Sort by user email since name might be null
        orderBy = { byUser: { email: sortOrder } };
        break;
      case "createdAt":
      default:
        orderBy = { createdAt: sortOrder };
        break;
    }

    // Get total count
    const total = await prisma.balanceLedger.count({
      where: whereClause,
    });

    // For reason sorting, fetch all entries to sort in memory
    // For other columns, use DB pagination
    const entries = await prisma.balanceLedger.findMany({
      where: whereClause,
      include: {
        team: {
          select: {
            id: true,
            name: true,
            isPersonal: true,
          },
        },
        study: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
        byUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy,
      ...(isReasonSort ? {} : { skip: (page - 1) * pageSize, take: pageSize }),
    });

    // Map entries to response format
    let mappedEntries = entries.map((entry) => ({
      id: entry.id,
      teamId: entry.teamId,
      teamName: entry.team?.name ?? "Unknown",
      teamIsPersonal: entry.team?.isPersonal ?? false,
      studyId: entry.studyId,
      studyName: entry.study?.name ?? null,
      studyType: entry.study?.type ?? null,
      byUserId: entry.byUserId,
      byUserName: entry.byUser?.name ?? null,
      byUserEmail: entry.byUser?.email ?? null,
      amountCents: entry.amountCents,
      reason: entry.reason,
      reasonKey: normalizeReason(entry.reason),
      createdAt: entry.createdAt,
    }));

    // If sorting by reason, sort in memory and paginate
    if (isReasonSort) {
      mappedEntries.sort((a, b) => {
        const comparison = a.reasonKey.localeCompare(b.reasonKey);
        return sortOrder === "asc" ? comparison : -comparison;
      });
      // Apply pagination
      mappedEntries = mappedEntries.slice(
        (page - 1) * pageSize,
        page * pageSize,
      );
    }

    const totalPages = Math.ceil(total / pageSize);

    logger.info("Retrieved balance ledger entries", {
      userId,
      companyId,
      isCompanyAdmin,
      teamIds,
      page,
      pageSize,
      sortBy,
      sortOrder,
      total,
    });

    return {
      entries: mappedEntries,
      total,
      page,
      pageSize,
      totalPages,
    };
  } catch (error) {
    logger.error("Failed to get balance ledger entries", {
      userId,
      companyId,
      isCompanyAdmin,
      teamIds,
      error,
    });
    throw error;
  }
}
