import prisma from "../db.ts";
import type { Prisma } from "@prisma/client";
import {
  NotificationType,
  NotificationAudience,
  TeamMembershipStatus,
  TeamRole,
} from "@prisma/client";
import { logger } from "@/apps/shared/logger.ts";
import { dbCreateNotification } from "../user/notificationService.ts";

// ============================================================================
// Credit Operations
// ============================================================================

export async function dbAdjustTeamCredits(params: {
  teamId: string;
  delta: number;
  byUserId?: string | null;
  studyId?: string | null;
  reason?: string | null;
}) {
  const { teamId, delta, byUserId, studyId, reason } = params;
  try {
    // Check for duplicate Stripe purchases (idempotency)
    if (reason && reason.startsWith("stripe_purchase:")) {
      const existing = await prisma.creditLedger.findFirst({
        where: {
          teamId,
          reason,
        },
      });

      if (existing) {
        logger.info("Credit adjustment already processed (idempotent)", {
          teamId,
          reason,
          existingId: existing.id,
        });
        // Return the current team state without making changes
        const team = await prisma.team.findUnique({
          where: { id: teamId },
          select: { id: true, credits: true },
        });
        return team;
      }
    }

    // Get previous credits before adjustment (for threshold crossing detection)
    const previousTeam = await prisma.team.findUnique({
      where: { id: teamId },
      select: {
        credits: true,
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

    const previousCredits = previousTeam?.credits ?? 0;

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.team.update({
        where: { id: teamId },
        data: { credits: { increment: delta } },
        select: { id: true, credits: true },
      });
      await tx.creditLedger.create({
        data: {
          teamId,
          byUserId: byUserId || null,
          studyId: studyId || null,
          delta,
          reason: reason || null,
        },
      });
      return updated;
    });

    const newCredits = (result as any).credits;

    logger.info("Adjusted team credits", {
      teamId,
      delta,
      byUserId,
      studyId,
      reason,
      newCredits,
    });

    // Send credit notifications for consumption (delta < 0)
    if (delta < 0 && previousTeam) {
      const threshold = previousTeam.autoRefillThreshold ?? 10;
      const teamName = previousTeam.name || "Your team";
      const adminUserIds = previousTeam.memberships.map((m) => m.userId);

      // CREDITS_EXHAUSTED: Credits just hit 0
      if (newCredits <= 0 && previousCredits > 0) {
        for (const adminUserId of adminUserIds) {
          try {
            await dbCreateNotification({
              userId: adminUserId,
              type: NotificationType.CREDITS_EXHAUSTED,
              audience: NotificationAudience.ADMIN,
              title: "Out of credits",
              message: `${teamName} has run out of credits. Studies cannot be run until credits are added.`,
              actionUrl: `/team`,
              metadata: { teamId, credits: newCredits },
            });
          } catch (notifError) {
            logger.error("Failed to create CREDITS_EXHAUSTED notification", {
              teamId,
              adminUserId,
              error: (notifError as Error)?.message,
            });
          }
        }
      }
      // CREDITS_LOW: Credits just crossed below threshold (but not at 0)
      else if (
        newCredits > 0 &&
        newCredits <= threshold &&
        previousCredits > threshold
      ) {
        for (const adminUserId of adminUserIds) {
          try {
            await dbCreateNotification({
              userId: adminUserId,
              type: NotificationType.CREDITS_LOW,
              audience: NotificationAudience.ADMIN,
              title: "Credits running low",
              message: `${teamName} has ${newCredits} credit${newCredits === 1 ? "" : "s"} remaining. Add more credits to continue running studies.`,
              actionUrl: `/team`,
              metadata: { teamId, credits: newCredits, threshold },
            });
          } catch (notifError) {
            logger.error("Failed to create CREDITS_LOW notification", {
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
    logger.error("Failed to adjust team credits", {
      teamId,
      delta,
      byUserId,
      studyId,
      reason,
      error,
    });
    throw error;
  }
}

export async function dbConsumeCreditForStudy(
  studyId: string,
  byUserId: string
) {
  try {
    // Look up study to get teamId
    const study = await prisma.study.findUnique({
      where: { id: studyId },
      select: { id: true, teamId: true },
    });
    if (!study) throw new Error("Study not found");
    const teamId = study.teamId;
    // Decrement team credit and record ledger
    const result = await dbAdjustTeamCredits({
      teamId,
      delta: -1,
      byUserId,
      studyId,
      reason: "consume_study",
    });

    // Return with teamId so caller can trigger auto-refill check if needed
    return { ...result, teamId };
  } catch (error) {
    logger.error("Failed to consume credit for study", {
      studyId,
      byUserId,
      error,
    });
    throw error;
  }
}

export async function dbRefundCreditForStudy(
  studyId: string,
  byUserId: string
) {
  try {
    const study = await prisma.study.findUnique({
      where: { id: studyId },
      select: { id: true, teamId: true },
    });
    if (!study) throw new Error("Study not found");
    const teamId = study.teamId;
    return await dbAdjustTeamCredits({
      teamId,
      delta: 1,
      byUserId,
      studyId,
      reason: "refund_study",
    });
  } catch (error) {
    logger.error("Failed to refund credit for study", {
      studyId,
      byUserId,
      error,
    });
    throw error;
  }
}

export async function dbGetCreditLedger(params: {
  userId: string;
  companyId?: string;
  isCompanyAdmin: boolean;
  teamIds: string[];
  page: number;
  pageSize: number;
  sortBy: "createdAt" | "delta" | "teamName" | "reason" | "byUserName";
  sortOrder: "asc" | "desc";
}) {
  const { userId, companyId, isCompanyAdmin, teamIds, page, pageSize, sortBy, sortOrder } = params;

  try {
    // Build the where clause based on permissions
    let whereClause: Prisma.CreditLedgerWhereInput = {};

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
      if (r.includes("purchase") || r.includes("stripe")) return "purchase";
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
      | Prisma.CreditLedgerOrderByWithRelationInput
      | Prisma.CreditLedgerOrderByWithRelationInput[];
    let orderBy: OrderByType;

    switch (sortBy) {
      case "delta":
        orderBy = { delta: sortOrder };
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
    const total = await prisma.creditLedger.count({
      where: whereClause,
    });

    // For reason sorting, fetch all entries to sort in memory
    // For other columns, use DB pagination
    const entries = await prisma.creditLedger.findMany({
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
      delta: entry.delta,
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
        page * pageSize
      );
    }

    const totalPages = Math.ceil(total / pageSize);

    logger.info("Retrieved credit ledger entries", {
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
    logger.error("Failed to get credit ledger entries", {
      userId,
      companyId,
      isCompanyAdmin,
      teamIds,
      error,
    });
    throw error;
  }
}
