import prisma from "@/apps/db-worker/src/services/db.ts";
import { SourceType, StudyStatus } from "@prisma/client";
import { logger } from "@/apps/shared/logger.ts";
import {
  getUserMembershipIds,
  buildStudyVisibilityConditions,
  requireStudyAccess,
} from "../shared/authorization.ts";
import { ForbiddenError } from "../shared/errors.ts";
import type { QualitativeAnalysisData } from "../shared/types.ts";

// ============================================================================
// Qualitative Analysis CRUD
// ============================================================================

/**
 * Creates a qualitative analysis with all insights, quotes, and tags in a single transaction.
 */
export async function dbPostQualitativeAnalysis(data: QualitativeAnalysisData) {
  const { studyData, result } = data;
  const { studyId, userId } = studyData;
  const { goal, researchQuestions, hypotheses, discussionGuide, context } =
    studyData.payload;

  try {
    await prisma.$transaction(async (tx) => {
      // Delete existing qualitative analysis if any (for re-runs)
      await tx.qualitativeAnalysis.deleteMany({
        where: { studyId },
      });

      // Create the qualitative analysis record with related entities
      const qualitativeAnalysis = await tx.qualitativeAnalysis.create({
        data: {
          studyId,
          goal: goal || null,
          context: context || null,
          discussionGuide: discussionGuide || null,
          inferredGoal: result.inferredGoal || null,
          inferredGuide: result.inferredGuide || null,
          summary: result.summary || null,
          summarySource: SourceType.AI,
          coverImageKey: result.coverImageKey || null,
          researchQuestions: {
            create: (researchQuestions || []).map((text, i) => ({
              text,
              sortOrder: i,
              isInferred: false,
            })),
          },
          hypotheses: {
            create: (hypotheses || []).map((text, i) => ({
              text,
              sortOrder: i,
              isInferred: false,
            })),
          },
        },
      });

      // Create inferred research questions (if any)
      if (result.inferredQuestions?.length) {
        await Promise.all(
          result.inferredQuestions.map((text, i) =>
            tx.researchQuestion.create({
              data: {
                qualitativeAnalysisId: qualitativeAnalysis.id,
                text,
                sortOrder: (researchQuestions?.length || 0) + i,
                isInferred: true,
              },
            }),
          ),
        );
      }

      // Collect all question IDs for join-table lookups
      const allQuestionIds = await tx.researchQuestion.findMany({
        where: { qualitativeAnalysisId: qualitativeAnalysis.id },
        orderBy: { sortOrder: "asc" },
        select: { id: true },
      });

      const allHypothesisIds = await tx.hypothesis.findMany({
        where: { qualitativeAnalysisId: qualitativeAnalysis.id },
        orderBy: { sortOrder: "asc" },
        select: { id: true },
      });

      // Create insights with join-table links
      for (const insight of result.insights) {
        const createdInsight = await tx.analysisInsight.create({
          data: {
            qualitativeAnalysisId: qualitativeAnalysis.id,
            title: insight.title,
            observation: insight.observation,
            motivation: insight.motivation,
            implication: insight.implication,
            insightStatement: insight.insightStatement,
            theme: insight.theme || null,
            severity: insight.severity ?? null,
            participantCount: insight.participantCount ?? null,
            source: SourceType.AI,
            createdByUserId: userId,
            quotes: {
              create: insight.quotes.map((q) => ({
                quote: q.quote,
                participant: q.participant || null,
                sourceFileId: q.sourceFileId || null,
                timestamp: q.timestamp || null,
              })),
            },
            tags: {
              create: insight.tags.map((tag) => ({ tag })),
            },
          },
        });

        // Link insight to research questions
        if (insight.researchQuestionIndices?.length) {
          await tx.insightResearchQuestion.createMany({
            data: insight.researchQuestionIndices
              .filter((idx) => idx < allQuestionIds.length)
              .map((idx) => ({
                insightId: createdInsight.id,
                researchQuestionId: allQuestionIds[idx].id,
              })),
          });
        }

        // Link insight to hypotheses
        if (insight.hypothesisIndices?.length) {
          await tx.insightHypothesis.createMany({
            data: insight.hypothesisIndices
              .filter((idx) => idx < allHypothesisIds.length)
              .map((idx) => ({
                insightId: createdInsight.id,
                hypothesisId: allHypothesisIds[idx].id,
              })),
          });
        }
      }

      // Update study status to COMPLETED and set generated name if needed
      const studyUpdateData: Record<string, unknown> = {
        status: StudyStatus.COMPLETED,
      };
      if (result.studyName) {
        // Only set the name if the study doesn't already have one
        const currentStudy = await tx.study.findUnique({
          where: { id: studyId },
          select: { name: true },
        });
        if (!currentStudy?.name?.trim()) {
          studyUpdateData.name = result.studyName;
        }
      }
      await tx.study.update({
        where: { id: studyId },
        data: studyUpdateData,
      });

      return qualitativeAnalysis;
    });

    // Create notification outside transaction (non-critical)
    try {
      const study = await prisma.study.findUnique({
        where: { id: studyId },
        select: { name: true, createdByUserId: true, type: true },
      });

      if (study?.createdByUserId) {
        await prisma.notification.create({
          data: {
            userId: study.createdByUserId,
            type: "STUDY_COMPLETE",
            title: `Analysis complete: ${study.name || "Untitled"}`,
            message: `Your qualitative analysis found ${result.insights.length} insight${result.insights.length === 1 ? "" : "s"}.`,
            actionUrl: `/analysis/${studyId}`,
          },
        });
      }
    } catch (notifError) {
      logger.warn("Failed to create completion notification", {
        studyId,
        error: (notifError as Error).message,
      });
    }

    logger.info("Qualitative analysis created successfully", {
      studyId,
      insightCount: result.insights.length,
    });
  } catch (error) {
    logger.error("Failed to create qualitative analysis", {
      studyId,
      error: (error as Error).message,
    });
    throw error;
  }
}

/**
 * Get a qualitative analysis by study ID (with access control).
 * Returns the Study object with nested qualitativeAnalysis, matching the pattern
 * used by other study types (CW, HE).
 */
export async function dbGetQualitativeAnalysis(
  studyId: string,
  userId: string,
) {
  // Verify user can access this study via visibility conditions
  const membershipIds = await getUserMembershipIds(userId);
  const visibilityConditions = buildStudyVisibilityConditions(
    userId,
    membershipIds.teamIds,
    membershipIds.companyIds,
    membershipIds.adminTeamIds,
    membershipIds.adminCompanyIds,
  );

  const study = await prisma.study.findFirst({
    where: {
      id: studyId,
      OR: visibilityConditions,
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
      qualitativeAnalysis: {
        include: {
          researchQuestions: {
            orderBy: { sortOrder: "asc" },
            include: {
              insights: { select: { insightId: true } },
            },
          },
          hypotheses: {
            orderBy: { sortOrder: "asc" },
            include: {
              insights: { select: { insightId: true } },
            },
          },
          personas: {
            include: {
              persona: {
                select: {
                  id: true,
                  name: true,
                  description: true,
                  photoFileId: true,
                },
              },
            },
          },
          insights: {
            include: {
              quotes: true,
              tags: true,
              createdByUser: {
                select: { id: true, name: true, image: true },
              },
              researchQuestions: { select: { researchQuestionId: true } },
              hypotheses: { select: { hypothesisId: true } },
            },
            orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
          },
        },
      },
    },
  });

  if (!study) {
    throw ForbiddenError("Study not found or access denied");
  }

  logger.info("Successfully fetched qualitative analysis", {
    studyId,
    userId,
    found: !!study?.qualitativeAnalysis,
  });

  return study;
}

/**
 * Updates the summary of a qualitative analysis.
 */
export async function dbUpdateQualitativeAnalysisSummary(
  qualitativeAnalysisId: string,
  summary: string,
  userId: string,
) {
  try {
    // Look up the study via the qualitative analysis to verify access
    const qa = await prisma.qualitativeAnalysis.findUnique({
      where: { id: qualitativeAnalysisId },
      select: { studyId: true },
    });

    if (!qa) {
      throw ForbiddenError("Qualitative analysis not found");
    }

    // Verify user has access to the study
    await requireStudyAccess(qa.studyId, userId);

    const updated = await prisma.qualitativeAnalysis.update({
      where: { id: qualitativeAnalysisId },
      data: { summary, summarySource: SourceType.AI_HUMAN },
    });

    // Also update the study's lastModifiedByUserId
    await prisma.study.update({
      where: { id: qa.studyId },
      data: { lastModifiedByUserId: userId },
    });

    logger.info("Successfully updated qualitative analysis summary", {
      qualitativeAnalysisId,
      userId,
    });

    return updated;
  } catch (error) {
    logger.error("Failed to update qualitative analysis summary", {
      qualitativeAnalysisId,
      userId,
      error,
    });
    throw error;
  }
}

/**
 * Updates editable fields of an analysis insight and sets source to AI_HUMAN.
 */
export async function dbUpdateAnalysisInsight(
  insightId: string,
  fields: {
    title?: string;
    observation?: string;
    motivation?: string;
    implication?: string;
    insightStatement?: string;
    severity?: number;
  },
  userId: string,
) {
  try {
    const insight = await prisma.analysisInsight.findUnique({
      where: { id: insightId },
      select: {
        qualitativeAnalysis: {
          select: { studyId: true },
        },
      },
    });

    if (!insight) {
      throw ForbiddenError("Insight not found");
    }

    await requireStudyAccess(insight.qualitativeAnalysis.studyId, userId);

    const updated = await prisma.analysisInsight.update({
      where: { id: insightId },
      data: {
        ...fields,
        source: SourceType.AI_HUMAN,
      },
    });

    // Update the study's lastModifiedByUserId
    await prisma.study.update({
      where: { id: insight.qualitativeAnalysis.studyId },
      data: { lastModifiedByUserId: userId },
    });

    logger.info("Successfully updated analysis insight", {
      insightId,
      userId,
      fields: Object.keys(fields),
    });

    return updated;
  } catch (error) {
    logger.error("Failed to update analysis insight", {
      insightId,
      userId,
      error,
    });
    throw error;
  }
}

/**
 * Deletes a quote from an analysis insight.
 */
export async function dbDeleteAnalysisQuote(quoteId: string, userId: string) {
  try {
    const quote = await prisma.analysisQuote.findUnique({
      where: { id: quoteId },
      select: {
        insight: {
          select: {
            qualitativeAnalysis: {
              select: { studyId: true },
            },
          },
        },
      },
    });

    if (!quote) {
      throw ForbiddenError("Quote not found");
    }

    await requireStudyAccess(quote.insight.qualitativeAnalysis.studyId, userId);

    await prisma.analysisQuote.delete({
      where: { id: quoteId },
    });

    // Update the study's lastModifiedByUserId
    await prisma.study.update({
      where: { id: quote.insight.qualitativeAnalysis.studyId },
      data: { lastModifiedByUserId: userId },
    });

    logger.info("Successfully deleted analysis quote", {
      quoteId,
      userId,
    });

    return { success: true };
  } catch (error) {
    logger.error("Failed to delete analysis quote", {
      quoteId,
      userId,
      error,
    });
    throw error;
  }
}

/**
 * Adds a tag to an analysis insight.
 */
export async function dbAddAnalysisTag(
  insightId: string,
  tag: string,
  userId: string,
) {
  try {
    const insight = await prisma.analysisInsight.findUnique({
      where: { id: insightId },
      select: {
        qualitativeAnalysis: {
          select: { studyId: true },
        },
      },
    });

    if (!insight) {
      throw ForbiddenError("Insight not found");
    }

    await requireStudyAccess(insight.qualitativeAnalysis.studyId, userId);

    const created = await prisma.analysisInsightTag.create({
      data: {
        insightId,
        tag,
      },
    });

    // Update the study's lastModifiedByUserId
    await prisma.study.update({
      where: { id: insight.qualitativeAnalysis.studyId },
      data: { lastModifiedByUserId: userId },
    });

    logger.info("Successfully added analysis tag", {
      insightId,
      tag,
      userId,
    });

    return created;
  } catch (error) {
    logger.error("Failed to add analysis tag", {
      insightId,
      tag,
      userId,
      error,
    });
    throw error;
  }
}

/**
 * Deletes a tag from an analysis insight.
 */
export async function dbDeleteAnalysisTag(tagId: string, userId: string) {
  try {
    const tag = await prisma.analysisInsightTag.findUnique({
      where: { id: tagId },
      select: {
        insight: {
          select: {
            qualitativeAnalysis: {
              select: { studyId: true },
            },
          },
        },
      },
    });

    if (!tag) {
      throw ForbiddenError("Tag not found");
    }

    await requireStudyAccess(tag.insight.qualitativeAnalysis.studyId, userId);

    await prisma.analysisInsightTag.delete({
      where: { id: tagId },
    });

    // Update the study's lastModifiedByUserId
    await prisma.study.update({
      where: { id: tag.insight.qualitativeAnalysis.studyId },
      data: { lastModifiedByUserId: userId },
    });

    logger.info("Successfully deleted analysis tag", {
      tagId,
      userId,
    });

    return { success: true };
  } catch (error) {
    logger.error("Failed to delete analysis tag", {
      tagId,
      userId,
      error,
    });
    throw error;
  }
}

/**
 * Deletes an analysis insight and all related quotes, tags, and join records.
 */
export async function dbDeleteAnalysisInsight(
  insightId: string,
  userId: string,
) {
  try {
    const insight = await prisma.analysisInsight.findUnique({
      where: { id: insightId },
      select: {
        qualitativeAnalysis: {
          select: { studyId: true },
        },
      },
    });

    if (!insight) {
      throw ForbiddenError("Insight not found");
    }

    await requireStudyAccess(insight.qualitativeAnalysis.studyId, userId);

    // Delete the insight (cascading deletes handle quotes, tags, join records)
    await prisma.analysisInsight.delete({
      where: { id: insightId },
    });

    // Update the study's lastModifiedByUserId
    await prisma.study.update({
      where: { id: insight.qualitativeAnalysis.studyId },
      data: { lastModifiedByUserId: userId },
    });

    logger.info("Successfully deleted analysis insight", {
      insightId,
      userId,
    });

    return { success: true };
  } catch (error) {
    logger.error("Failed to delete analysis insight", {
      insightId,
      userId,
      error,
    });
    throw error;
  }
}

/**
 * Adds a quote to an analysis insight.
 */
export async function dbAddAnalysisQuote(
  insightId: string,
  quote: string,
  userId: string,
  participant?: string,
  sourceFileId?: string,
  timestamp?: string,
) {
  try {
    const insight = await prisma.analysisInsight.findUnique({
      where: { id: insightId },
      select: {
        qualitativeAnalysis: {
          select: { studyId: true },
        },
      },
    });

    if (!insight) {
      throw ForbiddenError("Insight not found");
    }

    await requireStudyAccess(insight.qualitativeAnalysis.studyId, userId);

    const created = await prisma.analysisQuote.create({
      data: {
        insightId,
        quote,
        participant: participant || null,
        sourceFileId: sourceFileId || null,
        timestamp: timestamp || null,
      },
    });

    // Update the study's lastModifiedByUserId
    await prisma.study.update({
      where: { id: insight.qualitativeAnalysis.studyId },
      data: { lastModifiedByUserId: userId },
    });

    logger.info("Successfully added analysis quote", {
      insightId,
      quoteId: created.id,
      userId,
    });

    return created;
  } catch (error) {
    logger.error("Failed to add analysis quote", {
      insightId,
      userId,
      error,
    });
    throw error;
  }
}

/**
 * Creates a new analysis insight with optional quotes.
 */
export async function dbAddAnalysisInsight(
  qualitativeAnalysisId: string,
  fields: {
    title: string;
    insightStatement: string;
    observation: string;
    motivation: string;
    implication: string;
    severity?: number;
  },
  userId: string,
  quotes?: { quote: string; participant?: string; sourceFileId?: string }[],
) {
  try {
    const qa = await prisma.qualitativeAnalysis.findUnique({
      where: { id: qualitativeAnalysisId },
      select: { studyId: true },
    });

    if (!qa) {
      throw ForbiddenError("Qualitative analysis not found");
    }

    await requireStudyAccess(qa.studyId, userId);

    const created = await prisma.analysisInsight.create({
      data: {
        qualitativeAnalysisId,
        title: fields.title,
        insightStatement: fields.insightStatement,
        observation: fields.observation,
        motivation: fields.motivation,
        implication: fields.implication,
        severity: fields.severity || null,
        source: SourceType.HUMAN,
        createdByUserId: userId,
        quotes:
          quotes && quotes.length > 0
            ? {
                create: quotes.map((q) => ({
                  quote: q.quote,
                  participant: q.participant || null,
                  sourceFileId: q.sourceFileId || null,
                })),
              }
            : undefined,
      },
      include: {
        quotes: true,
        tags: true,
      },
    });

    // Update the study's lastModifiedByUserId
    await prisma.study.update({
      where: { id: qa.studyId },
      data: { lastModifiedByUserId: userId },
    });

    logger.info("Successfully created analysis insight", {
      qualitativeAnalysisId,
      insightId: created.id,
      userId,
      quoteCount: quotes?.length || 0,
    });

    return created;
  } catch (error) {
    logger.error("Failed to create analysis insight", {
      qualitativeAnalysisId,
      userId,
      error,
    });
    throw error;
  }
}
