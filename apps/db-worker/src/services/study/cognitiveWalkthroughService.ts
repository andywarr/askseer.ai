import prisma from "@/apps/db-worker/src/services/db.ts";
import { CWIssueType, SourceType, ContentRating, StudyStatus } from "@prisma/client";
import { logger } from "@/apps/shared/logger.ts";
import {
  getUserMembershipIds,
  buildStudyVisibilityConditions,
  getStudyManagementContext,
  updateStudyModification,
  getStudyIdFromCWStep,
  getStudyIdFromCWIssue,
  getStudyIdFromCWRecommendation,
} from "../shared/authorization.ts";
import { ForbiddenError } from "../shared/errors.ts";
import type { CognitiveWalkthroughData } from "../shared/types.ts";
import { dbUpdateStudyStatus } from "./studyService.ts";

// ============================================================================
// CW Questions
// ============================================================================

export async function dbGetCWQuestion(version: number) {
  try {
    const questions = await prisma.cWQuestion.findMany({
      where: { version },
      orderBy: { questionNumber: "asc" },
    });

    logger.info("Successfully fetched CW questions", {
      version,
      questionCount: questions.length,
    });
    return questions;
  } catch (error) {
    logger.error("Failed to fetch CW questions", { version, error });
    throw error;
  }
}

// ============================================================================
// Cognitive Walkthrough CRUD
// ============================================================================

export async function dbPostCognitiveWalkthrough(data: CognitiveWalkthroughData) {
  const { studyData, results } = data;
  const core = {
    studyId: studyData.studyId,
    goal: studyData.payload.goal || "",
    user: studyData.payload.user ?? null,
    context: studyData.payload.context ?? null,
    personaStudyId: (studyData.payload as any)?.persona?.studyId ?? null,
  };

  try {
    let resolvedPersonaId: string | undefined;
    if (core.personaStudyId) {
      const persona = await prisma.persona.findUnique({
        where: { studyId: core.personaStudyId },
        select: { id: true },
      });
      resolvedPersonaId = persona?.id || undefined;
    }

    await prisma.cognitiveWalkthrough.create({
      data: {
        studyId: core.studyId,
        goal: core.goal || "",
        user: core.user,
        context: core.context,
        personaId: resolvedPersonaId,
        steps: {
          create: results.map((step, index) => ({
            step: index + 1,
            expected: step.expected,
            results: {
              create: step.results.map((result) => ({
                question: { connect: { id: result.questionId } },
                answer: result.answer,
                source: SourceType.AI,
              })),
            },
            issues: {
              create: step.issues.map((issue) => ({
                issueType: issue.issueType as CWIssueType,
                issue: issue.issue,
                severity: issue.severity ?? null,
                source: SourceType.AI,
                recommendations: {
                  create: issue.recommendations.map((recommendation) => ({
                    recommendation: recommendation.recommendation,
                    source: SourceType.AI,
                  })),
                },
              })),
            },
          })),
        },
      },
    });

    await dbUpdateStudyStatus(core.studyId, StudyStatus.COMPLETED);

    logger.info("Successfully added cognitive walkthrough to database", {
      studyId: core.studyId,
    });
  } catch (error) {
    logger.error("Failed to add cognitive walkthrough to database", {
      studyId: core.studyId,
      error,
    });
    throw error;
  }
}

export async function dbGetCognitiveWalkthrough(studyId: string, userId: string) {
  try {
    const {
      teamIds: userTeamIds,
      companyIds: userCompanyIds,
      adminTeamIds,
      adminCompanyIds,
    } = await getUserMembershipIds(userId);

    const cognitiveWalkthrough = await prisma.study.findFirst({
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
        cognitiveWalkthrough: {
          include: {
            persona: true,
            steps: {
              include: {
                issues: { include: { recommendations: true } },
                results: {
                  include: { question: true },
                  orderBy: { question: { questionNumber: "asc" } },
                },
              },
            },
          },
        },
      },
    });

    logger.info("Successfully fetched cognitive walkthrough", {
      studyId,
      userId,
      found: !!cognitiveWalkthrough,
    });
    return cognitiveWalkthrough;
  } catch (error) {
    logger.error("Failed to fetch cognitive walkthrough", { studyId, userId, error });
    throw error;
  }
}

// ============================================================================
// CW Issue Operations
// ============================================================================

export async function dbCreateCWIssue(params: {
  stepId: string;
  issueType: string;
  issue: string;
  source: string;
  userId?: string;
}) {
  const { stepId, issueType, issue, source, userId } = params;

  try {
    if (userId) {
      const studyId = await getStudyIdFromCWStep(stepId);
      if (studyId) {
        const { isOwner, isTeamAdmin, isCompanyAdmin } =
          await getStudyManagementContext(studyId, userId);
        if (!isOwner && !isTeamAdmin && !isCompanyAdmin) {
          throw ForbiddenError("User not authorized to add issue");
        }
      }
    }

    const createData: any = {
      step: { connect: { id: stepId } },
      issueType: issueType as CWIssueType,
      issue,
      severity: 0,
      source: source === "HUMAN" ? SourceType.HUMAN : SourceType.AI_HUMAN,
    };

    if (userId) {
      createData.createdByUser = { connect: { id: userId } };
      createData.lastModifiedByUser = { connect: { id: userId } };
    }

    const result = await prisma.cWIssue.create({
      data: createData,
      include: { recommendations: true },
    });

    if (userId) {
      const studyId = await getStudyIdFromCWStep(stepId);
      if (studyId) {
        await updateStudyModification(studyId, userId);
      }
    }

    logger.info("Successfully created CW issue", { stepId, issueId: result.id });
    return result;
  } catch (error) {
    logger.error("Failed to create CW issue", { stepId, error });
    throw error;
  }
}

export async function dbUpdateCWIssue(
  id: string,
  issue?: string,
  severity?: number | null,
  rating?: ContentRating | null,
  userId?: string
) {
  try {
    if (userId) {
      const studyId = await getStudyIdFromCWIssue(id);
      if (studyId) {
        const { isOwner, isTeamAdmin, isCompanyAdmin } =
          await getStudyManagementContext(studyId, userId);
        if (!isOwner && !isTeamAdmin && !isCompanyAdmin) {
          throw ForbiddenError("User not authorized to update issue");
        }
      }
    }

    const current = await prisma.cWIssue.findUnique({
      where: { id },
      select: { source: true, stepId: true },
    });

    let newSource: SourceType = SourceType.AI_HUMAN;
    if (current?.source === SourceType.HUMAN) {
      newSource = SourceType.HUMAN;
    }

    const updateData: any = {};

    if (issue !== undefined) {
      updateData.issue = issue;
      updateData.source = newSource;
      updateData.rating = null;
    }

    if (severity !== undefined) {
      updateData.severity = severity;
      if (current?.source === SourceType.AI) {
        updateData.source = SourceType.AI_HUMAN;
      }
    }

    if (rating !== undefined && issue === undefined) {
      updateData.rating = rating;
    }

    if (userId) {
      updateData.lastModifiedByUserId = userId;
    }

    const result = await prisma.cWIssue.update({
      where: { id },
      data: updateData,
    });

    if (userId && current) {
      const studyId = await getStudyIdFromCWStep(current.stepId);
      if (studyId) {
        await updateStudyModification(studyId, userId);
      }
    }

    logger.info("Successfully updated CW issue", { id });
    return result;
  } catch (error) {
    logger.error("Failed to update CW issue", { id, error });
    throw error;
  }
}

export async function dbDeleteCWIssue(id: string, userId?: string) {
  try {
    if (userId) {
      const studyId = await getStudyIdFromCWIssue(id);
      if (studyId) {
        const { isOwner, isTeamAdmin, isCompanyAdmin } =
          await getStudyManagementContext(studyId, userId);
        if (!isOwner && !isTeamAdmin && !isCompanyAdmin) {
          throw ForbiddenError("User not authorized to delete issue");
        }
      }
    }

    const issue = await prisma.cWIssue.findUnique({
      where: { id },
      select: { stepId: true },
    });

    const result = await prisma.cWIssue.delete({
      where: { id },
      include: { recommendations: true },
    });

    if (userId && issue) {
      const studyId = await getStudyIdFromCWStep(issue.stepId);
      if (studyId) {
        await updateStudyModification(studyId, userId);
      }
    }

    logger.info("Successfully deleted CW issue", {
      id,
      recommendationCount: result.recommendations.length,
    });
    return result;
  } catch (error) {
    logger.error("Failed to delete CW issue", { id, error });
    throw error;
  }
}

// ============================================================================
// CW Recommendation Operations
// ============================================================================

export async function dbCreateCWRecommendation(
  issueId: string,
  recommendation: string,
  source: SourceType,
  userId?: string
) {
  try {
    if (userId) {
      const studyId = await getStudyIdFromCWIssue(issueId);
      if (studyId) {
        const { isOwner, isTeamAdmin, isCompanyAdmin } =
          await getStudyManagementContext(studyId, userId);
        if (!isOwner && !isTeamAdmin && !isCompanyAdmin) {
          throw ForbiddenError("User not authorized to add recommendation");
        }
      }
    }

    const createData: any = {
      issue: { connect: { id: issueId } },
      recommendation,
      source,
    };

    if (userId) {
      createData.createdByUser = { connect: { id: userId } };
      createData.lastModifiedByUser = { connect: { id: userId } };
    }

    const result = await prisma.cWRecommendation.create({
      data: createData,
    });

    if (userId) {
      await prisma.cWIssue.update({
        where: { id: issueId },
        data: { lastModifiedByUserId: userId },
      });

      const issue = await prisma.cWIssue.findUnique({
        where: { id: issueId },
        select: { stepId: true },
      });
      if (issue) {
        const studyId = await getStudyIdFromCWStep(issue.stepId);
        if (studyId) {
          await updateStudyModification(studyId, userId);
        }
      }
    }

    logger.info("Successfully created CW recommendation", {
      issueId,
      recommendationId: result.id,
    });
    return result;
  } catch (error) {
    logger.error("Failed to create CW recommendation", { issueId, error });
    throw error;
  }
}

export async function dbUpdateCWRecommendation(
  id: string,
  recommendation?: string,
  rating?: ContentRating | null,
  userId?: string
) {
  try {
    if (userId) {
      const studyId = await getStudyIdFromCWRecommendation(id);
      if (studyId) {
        const { isOwner, isTeamAdmin, isCompanyAdmin } =
          await getStudyManagementContext(studyId, userId);
        if (!isOwner && !isTeamAdmin && !isCompanyAdmin) {
          throw ForbiddenError("User not authorized to update recommendation");
        }
      }
    }

    const current = await prisma.cWRecommendation.findUnique({
      where: { id },
      select: { source: true, issueId: true },
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

    const result = await prisma.cWRecommendation.update({
      where: { id },
      data: updateData,
    });

    if (userId && current) {
      await prisma.cWIssue.update({
        where: { id: current.issueId },
        data: { lastModifiedByUserId: userId },
      });

      const issue = await prisma.cWIssue.findUnique({
        where: { id: current.issueId },
        select: { stepId: true },
      });
      if (issue) {
        const studyId = await getStudyIdFromCWStep(issue.stepId);
        if (studyId) {
          await updateStudyModification(studyId, userId);
        }
      }
    }

    logger.info("Successfully updated CW recommendation", { id });
    return result;
  } catch (error) {
    logger.error("Failed to update CW recommendation", { id, error });
    throw error;
  }
}

export async function dbDeleteCWRecommendation(id: string, userId?: string) {
  try {
    if (userId) {
      const studyId = await getStudyIdFromCWRecommendation(id);
      if (studyId) {
        const { isOwner, isTeamAdmin, isCompanyAdmin } =
          await getStudyManagementContext(studyId, userId);
        if (!isOwner && !isTeamAdmin && !isCompanyAdmin) {
          throw ForbiddenError("User not authorized to delete recommendation");
        }
      }
    }

    const recommendation = await prisma.cWRecommendation.findUnique({
      where: { id },
      select: { issueId: true },
    });

    const result = await prisma.cWRecommendation.delete({
      where: { id },
    });

    if (userId && recommendation) {
      await prisma.cWIssue.update({
        where: { id: recommendation.issueId },
        data: { lastModifiedByUserId: userId },
      });

      const issue = await prisma.cWIssue.findUnique({
        where: { id: recommendation.issueId },
        select: { stepId: true },
      });
      if (issue) {
        const studyId = await getStudyIdFromCWStep(issue.stepId);
        if (studyId) {
          await updateStudyModification(studyId, userId);
        }
      }
    }

    logger.info("Successfully deleted CW recommendation", { id });
    return result;
  } catch (error) {
    logger.error("Failed to delete CW recommendation", { id, error });
    throw error;
  }
}
