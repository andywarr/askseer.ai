/**
 * Study Takeaway Service - TLDR / Takeaways
 *
 * Handles CRUD operations for study takeaways and their recommendations.
 */

import prisma from "@/apps/db-worker/src/services/db.ts";
import type { TldrStatus } from "@prisma/client";
import { logger } from "@/apps/shared/logger.ts";
import { requireStudyAccess } from "../shared/authorization.ts";

// ============================================================================
// TLDR Status
// ============================================================================

/**
 * Get the TLDR status and takeaways for a study
 */
export async function dbGetStudyTldrStatus(
  studyId: string,
  userId: string,
) {
  try {
    await requireStudyAccess(studyId, userId);

    const study = await prisma.study.findUnique({
      where: { id: studyId },
      select: {
        tldrStatus: true,
        takeaways: {
          orderBy: { sortOrder: "asc" },
          include: {
            recommendations: {
              orderBy: { sortOrder: "asc" },
            },
          },
        },
      },
    });

    if (!study) {
      return null;
    }

    return {
      tldrStatus: study.tldrStatus,
      takeaways: study.takeaways,
    };
  } catch (error) {
    logger.error("Failed to get study TLDR status", { studyId, userId, error });
    throw error;
  }
}

/**
 * Get ordered takeaways with recommendations for a study
 */
export async function dbGetStudyTakeaways(
  studyId: string,
  userId: string,
) {
  try {
    await requireStudyAccess(studyId, userId);

    const takeaways = await prisma.studyTakeaway.findMany({
      where: { studyId },
      orderBy: { sortOrder: "asc" },
      include: {
        recommendations: {
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    return takeaways;
  } catch (error) {
    logger.error("Failed to get study takeaways", { studyId, userId, error });
    throw error;
  }
}

/**
 * Update TLDR generation status
 */
export async function dbUpdateStudyTldrStatus(
  studyId: string,
  tldrStatus: TldrStatus,
  userId: string,
) {
  try {
    await requireStudyAccess(studyId, userId);

    await prisma.study.update({
      where: { id: studyId },
      data: { tldrStatus },
    });

    logger.info("Updated study TLDR status", { studyId, tldrStatus, userId });
  } catch (error) {
    logger.error("Failed to update study TLDR status", {
      studyId,
      tldrStatus,
      userId,
      error,
    });
    throw error;
  }
}

// ============================================================================
// Upsert Takeaways (used by AI worker)
// ============================================================================

interface TakeawayInput {
  title: string;
  description: string;
  sortOrder: number;
  recommendations: Array<{
    text: string;
    sortOrder: number;
  }>;
}

/**
 * Replace all takeaways for a study with new ones.
 * Used by the AI worker after generating takeaways.
 */
export async function dbUpsertStudyTakeaways(
  studyId: string,
  takeaways: TakeawayInput[],
) {
  try {
    // Delete existing takeaways (cascade deletes recommendations)
    await prisma.studyTakeaway.deleteMany({
      where: { studyId },
    });

    // Create new takeaways with nested recommendations
    for (const takeaway of takeaways) {
      await prisma.studyTakeaway.create({
        data: {
          studyId,
          sortOrder: takeaway.sortOrder,
          title: takeaway.title,
          description: takeaway.description,
          source: "AI",
          recommendations: {
            create: takeaway.recommendations.map((rec) => ({
              text: rec.text,
              sortOrder: rec.sortOrder,
              source: "AI",
            })),
          },
        },
      });
    }

    // Update study TLDR status to COMPLETED
    await prisma.study.update({
      where: { id: studyId },
      data: { tldrStatus: "COMPLETED" },
    });

    logger.info("Upserted study takeaways", {
      studyId,
      takeawayCount: takeaways.length,
    });
  } catch (error) {
    logger.error("Failed to upsert study takeaways", { studyId, error });
    throw error;
  }
}

// ============================================================================
// Granular Edit/Delete
// ============================================================================

export async function dbUpdateStudyTakeaway(
  takeawayId: string,
  data: { title?: string; description?: string },
  userId: string,
) {
  try {
    const takeaway = await prisma.studyTakeaway.findUnique({
      where: { id: takeawayId },
      select: { studyId: true },
    });
    if (!takeaway) throw new Error("Takeaway not found");

    await requireStudyAccess(takeaway.studyId, userId);

    const updated = await prisma.studyTakeaway.update({
      where: { id: takeawayId },
      data: {
        ...data,
        source: "AI_HUMAN",
      },
    });

    return updated;
  } catch (error) {
    logger.error("Failed to update study takeaway", { takeawayId, error });
    throw error;
  }
}

export async function dbDeleteStudyTakeaway(
  takeawayId: string,
  userId: string,
) {
  try {
    const takeaway = await prisma.studyTakeaway.findUnique({
      where: { id: takeawayId },
      select: { studyId: true },
    });
    if (!takeaway) throw new Error("Takeaway not found");

    await requireStudyAccess(takeaway.studyId, userId);

    await prisma.studyTakeaway.delete({
      where: { id: takeawayId },
    });

    return { success: true };
  } catch (error) {
    logger.error("Failed to delete study takeaway", { takeawayId, error });
    throw error;
  }
}

export async function dbUpdateTakeawayRecommendation(
  recommendationId: string,
  data: { text?: string },
  userId: string,
) {
  try {
    const recommendation = await prisma.takeawayRecommendation.findUnique({
      where: { id: recommendationId },
      include: { takeaway: { select: { studyId: true } } },
    });
    if (!recommendation) throw new Error("Recommendation not found");

    await requireStudyAccess(recommendation.takeaway.studyId, userId);

    const updated = await prisma.takeawayRecommendation.update({
      where: { id: recommendationId },
      data: {
        ...data,
        source: "AI_HUMAN",
      },
    });

    return updated;
  } catch (error) {
    logger.error("Failed to update takeaway recommendation", { recommendationId, error });
    throw error;
  }
}

export async function dbDeleteTakeawayRecommendation(
  recommendationId: string,
  userId: string,
) {
  try {
    const recommendation = await prisma.takeawayRecommendation.findUnique({
      where: { id: recommendationId },
      include: { takeaway: { select: { studyId: true } } },
    });
    if (!recommendation) throw new Error("Recommendation not found");

    await requireStudyAccess(recommendation.takeaway.studyId, userId);

    await prisma.takeawayRecommendation.delete({
      where: { id: recommendationId },
    });

    return { success: true };
  } catch (error) {
    logger.error("Failed to delete takeaway recommendation", { recommendationId, error });
    throw error;
  }
}

export async function dbCreateTakeawayRecommendation(
  takeawayId: string,
  text: string,
  userId: string,
) {
  try {
    const takeaway = await prisma.studyTakeaway.findUnique({
      where: { id: takeawayId },
      select: {
        studyId: true,
        recommendations: {
          select: { sortOrder: true },
          orderBy: { sortOrder: "desc" },
          take: 1,
        },
      },
    });
    if (!takeaway) throw new Error("Takeaway not found");

    await requireStudyAccess(takeaway.studyId, userId);

    const nextSortOrder =
      takeaway.recommendations.length > 0
        ? takeaway.recommendations[0].sortOrder + 1
        : 0;

    const created = await prisma.takeawayRecommendation.create({
      data: {
        takeawayId,
        text,
        sortOrder: nextSortOrder,
        source: "HUMAN",
      },
    });

    return created;
  } catch (error) {
    logger.error("Failed to create takeaway recommendation", { takeawayId, error });
    throw error;
  }
}

export async function dbCreateStudyTakeaway(
  studyId: string,
  data: { title: string; description: string },
  userId: string,
) {
  try {
    await requireStudyAccess(studyId, userId);

    const existing = await prisma.studyTakeaway.findMany({
      where: { studyId },
      select: { sortOrder: true },
      orderBy: { sortOrder: "desc" },
      take: 1,
    });

    const nextSortOrder =
      existing.length > 0 ? existing[0].sortOrder + 1 : 0;

    const created = await prisma.studyTakeaway.create({
      data: {
        studyId,
        title: data.title,
        description: data.description,
        sortOrder: nextSortOrder,
        source: "HUMAN",
      },
      include: {
        recommendations: true,
      },
    });

    return created;
  } catch (error) {
    logger.error("Failed to create study takeaway", { studyId, error });
    throw error;
  }
}

export async function dbReorderStudyTakeaways(
  studyId: string,
  orderedIds: string[],
  userId: string,
) {
  try {
    await requireStudyAccess(studyId, userId);

    await prisma.$transaction(
      orderedIds.map((id, index) =>
        prisma.studyTakeaway.update({
          where: { id },
          data: { sortOrder: index },
        }),
      ),
    );

    return { success: true };
  } catch (error) {
    logger.error("Failed to reorder study takeaways", { studyId, error });
    throw error;
  }
}
