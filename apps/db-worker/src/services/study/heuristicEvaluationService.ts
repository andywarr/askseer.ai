import prisma from "@/apps/db-worker/src/services/db.ts";
import { SourceType, ContentRating, StudyStatus } from "@prisma/client";
import { logger } from "@/apps/shared/logger.ts";
import {
  getUserMembershipIds,
  buildStudyVisibilityConditions,
  getStudyManagementContext,
  updateStudyModification,
  getStudyIdFromHEEvaluation,
  getStudyIdFromHEResult,
  getStudyIdFromHERecommendation,
} from "../shared/authorization.ts";
import { ForbiddenError } from "../shared/errors.ts";
import type { HeuristicEvaluationData } from "../shared/types.ts";

// ============================================================================
// Heuristic Evaluation CRUD
// ============================================================================

/**
 * Creates a heuristic evaluation with all results in a single transaction.
 * This ensures atomicity - either all data is saved or none.
 */
export async function dbPostHeuristicEvaluation(data: HeuristicEvaluationData) {
  const { studyData, results } = data;
  const core = {
    studyId: studyData.studyId,
    goal: studyData.payload.goal || "",
    user: studyData.payload.user ?? null,
    context: studyData.payload.context ?? null,
    heuristic: studyData.payload.heuristic,
    personaStudyId: (studyData.payload as any)?.persona?.studyId ?? null,
  };

  try {
    if (!core.heuristic) {
      throw new Error("Heuristic family ID is required");
    }

    let resolvedPersonaId: string | undefined;
    if (core.personaStudyId) {
      const persona = await prisma.persona.findUnique({
        where: { studyId: core.personaStudyId },
        select: { id: true },
      });
      resolvedPersonaId = persona?.id || undefined;
    }

    // Use transaction to ensure atomicity of delete + create + status update
    await prisma.$transaction(async (tx) => {
      // Delete existing heuristic evaluation if any (for re-runs)
      await tx.heuristicEvaluation.deleteMany({
        where: { studyId: core.studyId },
      });

      // Create new heuristic evaluation with all results
      await tx.heuristicEvaluation.create({
        data: {
          studyId: core.studyId,
          goal: core.goal || "",
          user: core.user,
          context: core.context,
          personaId: resolvedPersonaId,
          heuristicFamilyId: core.heuristic,
          results: {
            create: results.map((result) => ({
              violated: result.violated,
              reason: result.reason,
              severity: result.severity ?? null,
              source: SourceType.AI,
              step: result.step,
              file: { connect: { id: result.fileId } },
              heuristic: { connect: { id: result.id } },
              recommendations: result.violated
                ? {
                    create: result.recommendations.map((recommendation) => ({
                      recommendation: recommendation.recommendation,
                      source: SourceType.AI,
                    })),
                  }
                : undefined,
            })),
          },
        },
      });

      // Update study status to COMPLETED
      await tx.study.update({
        where: { id: core.studyId },
        data: { status: StudyStatus.COMPLETED },
      });
    });

    // Create notification outside transaction (non-critical)
    try {
      const study = await prisma.study.findUnique({
        where: { id: core.studyId },
        select: { name: true, createdByUserId: true, type: true },
      });

      if (study?.createdByUserId) {
        const { dbCreateNotification } = await import(
          "../user/notificationService.ts"
        );
        await dbCreateNotification({
          userId: study.createdByUserId,
          type: "STUDY_COMPLETE",
          audience: "USER",
          title: "Study completed",
          message: `${study.name || "Your study"} has finished processing`,
          actionUrl: `/evaluation/${core.studyId}`,
          metadata: {
            studyId: core.studyId,
            studyName: study.name,
            studyType: study.type,
          },
        });
      }
    } catch (notifError) {
      logger.error("Failed to create study completion notification", {
        studyId: core.studyId,
        error: (notifError as Error)?.message,
      });
    }

    logger.info("Successfully added heuristic evaluation to database", {
      studyId: core.studyId,
    });
  } catch (error) {
    logger.error("Failed to add heuristic evaluation to database", {
      studyId: core.studyId,
      error,
    });
    throw error;
  }
}

export async function dbGetHeuristicEvaluation(
  studyId: string,
  userId: string
) {
  try {
    const {
      teamIds: userTeamIds,
      companyIds: userCompanyIds,
      adminTeamIds,
      adminCompanyIds,
    } = await getUserMembershipIds(userId);

    const heuristicEvaluation = await prisma.study.findFirst({
      where: {
        id: studyId,
        OR: buildStudyVisibilityConditions(
          userId,
          userTeamIds,
          userCompanyIds,
          adminTeamIds,
          adminCompanyIds
        ),
      },
      include: {
        files: true,
        createdByUser: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            imageKey: true,
            status: true,
          },
        },
        lastModifiedByUser: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            imageKey: true,
            status: true,
          },
        },
        heuristicEvaluation: {
          include: {
            persona: true,
            heuristicFamily: { include: { heuristics: true } },
            results: {
              include: { heuristic: true, recommendations: true },
              orderBy: [
                { step: "asc" },
                { heuristic: { heuristic: "asc" } },
                { createdAt: "asc" },
              ],
            },
          },
        },
      },
    });

    logger.info("Successfully fetched heuristic evaluation", {
      studyId,
      userId,
      found: !!heuristicEvaluation,
    });
    return heuristicEvaluation;
  } catch (error) {
    logger.error("Failed to fetch heuristic evaluation", {
      studyId,
      userId,
      error,
    });
    throw error;
  }
}

// ============================================================================
// HE Result (Issue) Operations
// ============================================================================

export async function dbCreateHEResult(params: {
  heuristicEvaluationId: string;
  heuristicId: string;
  step: number;
  fileId: string;
  reason: string;
  severity: number;
  source: string;
  userId?: string;
}) {
  const {
    heuristicEvaluationId,
    heuristicId,
    step,
    fileId,
    reason,
    severity,
    source,
    userId,
  } = params;

  try {
    if (userId) {
      const studyId = await getStudyIdFromHEEvaluation(heuristicEvaluationId);
      if (studyId) {
        const { isOwner, isTeamAdmin, isCompanyAdmin } =
          await getStudyManagementContext(studyId, userId);
        if (!isOwner && !isTeamAdmin && !isCompanyAdmin) {
          throw ForbiddenError("User not authorized to add issue");
        }
      }
    }

    const createData: any = {
      heuristicEvaluation: { connect: { id: heuristicEvaluationId } },
      heuristic: { connect: { id: heuristicId } },
      step,
      file: { connect: { id: fileId } },
      reason,
      severity,
      violated: true,
      source: source === "HUMAN" ? SourceType.HUMAN : SourceType.AI_HUMAN,
    };

    if (userId) {
      createData.createdByUser = { connect: { id: userId } };
      createData.lastModifiedByUser = { connect: { id: userId } };
    }

    const result = await prisma.hEResult.create({
      data: createData,
    });

    if (userId) {
      const studyId = await getStudyIdFromHEEvaluation(heuristicEvaluationId);
      if (studyId) {
        await updateStudyModification(studyId, userId);
      }
    }

    logger.info("Successfully created HE result", {
      heuristicEvaluationId,
      resultId: result.id,
      severity,
    });
    return result;
  } catch (error) {
    logger.error("Failed to create HE result", {
      heuristicEvaluationId,
      error,
    });
    throw error;
  }
}

export async function dbUpdateHEResult(
  id: string,
  reason?: string,
  severity?: number | null,
  rating?: ContentRating | null,
  userId?: string
) {
  try {
    if (userId) {
      const studyId = await getStudyIdFromHEResult(id);
      if (studyId) {
        const { isOwner, isTeamAdmin, isCompanyAdmin } =
          await getStudyManagementContext(studyId, userId);
        if (!isOwner && !isTeamAdmin && !isCompanyAdmin) {
          throw ForbiddenError("User not authorized to update issue");
        }
      }
    }

    const current = await prisma.hEResult.findUnique({
      where: { id },
      select: { source: true, heuristicEvaluationId: true },
    });

    let newSource: SourceType = SourceType.AI_HUMAN;
    if (current?.source === SourceType.HUMAN) {
      newSource = SourceType.HUMAN;
    }

    const updateData: any = {};

    if (reason !== undefined) {
      updateData.reason = reason;
      updateData.source = newSource;
      updateData.rating = null;
    }

    if (severity !== undefined) {
      updateData.severity = severity;
      if (current?.source === SourceType.AI) {
        updateData.source = SourceType.AI_HUMAN;
      }
    }

    if (rating !== undefined && reason === undefined) {
      updateData.rating = rating;
    }

    if (userId) {
      updateData.lastModifiedByUserId = userId;
    }

    const result = await prisma.hEResult.update({
      where: { id },
      data: updateData,
    });

    if (userId && current) {
      const studyId = await getStudyIdFromHEEvaluation(
        current.heuristicEvaluationId
      );
      if (studyId) {
        await updateStudyModification(studyId, userId);
      }
    }

    logger.info("Successfully updated HE result", { id });
    return result;
  } catch (error) {
    logger.error("Failed to update HE result", { id, error });
    throw error;
  }
}

export async function dbDeleteHEResult(id: string, userId?: string) {
  try {
    if (userId) {
      const studyId = await getStudyIdFromHEResult(id);
      if (studyId) {
        const { isOwner, isTeamAdmin, isCompanyAdmin } =
          await getStudyManagementContext(studyId, userId);
        if (!isOwner && !isTeamAdmin && !isCompanyAdmin) {
          throw ForbiddenError("User not authorized to delete issue");
        }
      }
    }

    const heResult = await prisma.hEResult.findUnique({
      where: { id },
      select: { heuristicEvaluationId: true },
    });

    const result = await prisma.hEResult.delete({
      where: { id },
      include: { recommendations: true },
    });

    if (userId && heResult) {
      const studyId = await getStudyIdFromHEEvaluation(
        heResult.heuristicEvaluationId
      );
      if (studyId) {
        await updateStudyModification(studyId, userId);
      }
    }

    logger.info("Successfully deleted HE result", {
      id,
      recommendationCount: result.recommendations.length,
    });
    return result;
  } catch (error) {
    logger.error("Failed to delete HE result", { id, error });
    throw error;
  }
}

// ============================================================================
// HE Recommendation Operations
// ============================================================================

export async function dbCreateHERecommendation(
  resultId: string,
  recommendation: string,
  source: SourceType,
  userId?: string
) {
  try {
    if (userId) {
      const studyId = await getStudyIdFromHEResult(resultId);
      if (studyId) {
        const { isOwner, isTeamAdmin, isCompanyAdmin } =
          await getStudyManagementContext(studyId, userId);
        if (!isOwner && !isTeamAdmin && !isCompanyAdmin) {
          throw ForbiddenError("User not authorized to add recommendation");
        }
      }
    }

    const createData: any = {
      result: { connect: { id: resultId } },
      recommendation,
      source,
    };

    if (userId) {
      createData.createdByUser = { connect: { id: userId } };
      createData.lastModifiedByUser = { connect: { id: userId } };
    }

    const result = await prisma.hERecommendation.create({
      data: createData,
    });

    if (userId) {
      await prisma.hEResult.update({
        where: { id: resultId },
        data: { lastModifiedByUserId: userId },
      });

      const heResult = await prisma.hEResult.findUnique({
        where: { id: resultId },
        select: { heuristicEvaluationId: true },
      });
      if (heResult) {
        const studyId = await getStudyIdFromHEEvaluation(
          heResult.heuristicEvaluationId
        );
        if (studyId) {
          await updateStudyModification(studyId, userId);
        }
      }
    }

    logger.info("Successfully created HE recommendation", {
      resultId,
      recommendationId: result.id,
    });
    return result;
  } catch (error) {
    logger.error("Failed to create HE recommendation", { resultId, error });
    throw error;
  }
}

export async function dbUpdateHERecommendation(
  id: string,
  recommendation?: string,
  rating?: ContentRating | null,
  userId?: string
) {
  try {
    if (userId) {
      const studyId = await getStudyIdFromHERecommendation(id);
      if (studyId) {
        const { isOwner, isTeamAdmin, isCompanyAdmin } =
          await getStudyManagementContext(studyId, userId);
        if (!isOwner && !isTeamAdmin && !isCompanyAdmin) {
          throw ForbiddenError("User not authorized to update recommendation");
        }
      }
    }

    const current = await prisma.hERecommendation.findUnique({
      where: { id },
      select: { source: true, resultId: true },
    });

    let newSource: SourceType = SourceType.AI_HUMAN;
    if (current?.source === SourceType.HUMAN) {
      newSource = SourceType.HUMAN;
    }

    const updateData: any = {};
    if (recommendation !== undefined) {
      updateData.recommendation = recommendation;
      updateData.source = newSource;
      updateData.rating = null;
    }

    if (rating !== undefined && recommendation === undefined) {
      updateData.rating = rating;
    }

    if (userId) {
      updateData.lastModifiedByUserId = userId;
    }

    const result = await prisma.hERecommendation.update({
      where: { id },
      data: updateData,
    });

    if (userId && current) {
      await prisma.hEResult.update({
        where: { id: current.resultId },
        data: { lastModifiedByUserId: userId },
      });

      const heResult = await prisma.hEResult.findUnique({
        where: { id: current.resultId },
        select: { heuristicEvaluationId: true },
      });
      if (heResult) {
        const studyId = await getStudyIdFromHEEvaluation(
          heResult.heuristicEvaluationId
        );
        if (studyId) {
          await updateStudyModification(studyId, userId);
        }
      }
    }

    logger.info("Successfully updated HE recommendation", { id });
    return result;
  } catch (error) {
    logger.error("Failed to update HE recommendation", { id, error });
    throw error;
  }
}

export async function dbDeleteHERecommendation(id: string, userId?: string) {
  try {
    if (userId) {
      const studyId = await getStudyIdFromHERecommendation(id);
      if (studyId) {
        const { isOwner, isTeamAdmin, isCompanyAdmin } =
          await getStudyManagementContext(studyId, userId);
        if (!isOwner && !isTeamAdmin && !isCompanyAdmin) {
          throw ForbiddenError("User not authorized to delete recommendation");
        }
      }
    }

    const recommendation = await prisma.hERecommendation.findUnique({
      where: { id },
      select: { resultId: true },
    });

    const result = await prisma.hERecommendation.delete({
      where: { id },
    });

    if (userId && recommendation) {
      await prisma.hEResult.update({
        where: { id: recommendation.resultId },
        data: { lastModifiedByUserId: userId },
      });

      const heResult = await prisma.hEResult.findUnique({
        where: { id: recommendation.resultId },
        select: { heuristicEvaluationId: true },
      });
      if (heResult) {
        const studyId = await getStudyIdFromHEEvaluation(
          heResult.heuristicEvaluationId
        );
        if (studyId) {
          await updateStudyModification(studyId, userId);
        }
      }
    }

    logger.info("Successfully deleted HE recommendation", { id });
    return result;
  } catch (error) {
    logger.error("Failed to delete HE recommendation", { id, error });
    throw error;
  }
}
