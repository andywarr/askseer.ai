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
