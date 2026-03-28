import prisma from "@/apps/db-worker/src/services/db.ts";
import type { Prisma, StudyStatus, StudyVisibility } from "@prisma/client";
import {
  TeamMembershipStatus,
  NotificationType,
  NotificationAudience,
} from "@prisma/client";
import { logger } from "@/apps/shared/logger.ts";
import {
  convertToStudyType,
  convertToFileType,
  convertToImageType,
  generateShareToken,
} from "../shared/helpers.ts";
import {
  getUserMembershipIds,
  buildStudyVisibilityConditions,
  getStudyManagementContext,
  requireStudyAccess,
} from "../shared/authorization.ts";
import {
  NotFoundError,
  BadRequestError,
  ForbiddenError,
} from "../shared/errors.ts";
import type { V2JobData, FileInput } from "../shared/types.ts";
import { dbCreateNotification } from "../user/notificationService.ts";

// ============================================================================
// Study CRUD Operations
// ============================================================================

export async function dbInitStudy(data: {
  userId: string;
  teamId: string;
  name: string;
  type: string;
  initialJobData?: any;
}) {
  try {
    // Check if the team is a personal team to determine default visibility
    const team = await prisma.team.findUnique({
      where: { id: data.teamId },
      select: { isPersonal: true },
    });

    // Default to PRIVATE visibility for personal teams, TEAM for company teams
    const defaultVisibility = team?.isPersonal ? "PRIVATE" : "TEAM";

    const studyType = convertToStudyType(data.type);
    if (!studyType) {
      throw BadRequestError(`Invalid study type: ${data.type}`);
    }

    const study = await prisma.study.create({
      data: {
        createdByUserId: data.userId,
        teamId: data.teamId,
        name: data.name,
        type: studyType,
        visibility: defaultVisibility as StudyVisibility,
        jobData: data.initialJobData ?? { init: true },
      },
    });

    logger.info("Successfully initialized study", {
      studyId: study.id,
      createdByUserId: data.userId,
      teamId: data.teamId,
    });
    return study;
  } catch (error) {
    logger.error("Failed to initialize study", {
      createdByUserId: data.userId,
      teamId: data.teamId,
      error,
    });
    throw error;
  }
}

export async function dbFinalizeStudy(data: {
  studyId: string;
  files: FileInput[];
  jobData: V2JobData;
}) {
  try {
    const existing = await prisma.study.findUnique({
      where: { id: data.studyId },
      select: { id: true, jobData: true },
    });
    if (!existing) {
      throw NotFoundError("Study not found");
    }

    const bucket = process.env.AWS_BUCKET || "";

    const updated = await prisma.study.update({
      where: { id: data.studyId },
      data: {
        files: {
          create: data.files.map((f) => ({
            bucket,
            key: f.key,
            originalName: f.name,
            size: f.size,
            fileType: convertToFileType(f.type),
            imageType: convertToImageType(f.type),
            figmaFileKey: f.figmaFileKey || null,
            figmaNodeId: f.figmaNodeId || null,
            figmaFrameName: f.figmaFrameName || null,
            figmaUrl: f.figmaUrl || null,
          })),
        },
        jobData: data.jobData as unknown as Prisma.InputJsonValue,
      },
      include: { files: true },
    });

    logger.info("Successfully finalized study", {
      studyId: updated.id,
      fileCount: updated.files?.length ?? 0,
    });
    return updated;
  } catch (error) {
    logger.error("Failed to finalize study", { studyId: data.studyId, error });
    throw error;
  }
}

export async function dbGetStudy(studyId: string, userId: string) {
  try {
    const {
      teamIds: userTeamIds,
      companyIds: userCompanyIds,
      adminTeamIds,
      adminCompanyIds,
    } = await getUserMembershipIds(userId);

    const study = await prisma.study.findFirst({
      where: {
        id: studyId,
        OR: buildStudyVisibilityConditions(
          userId,
          userTeamIds,
          userCompanyIds,
          adminTeamIds,
          adminCompanyIds,
        ),
      },
      include: {
        files: true,
        createdByUser: {
          select: {
            id: true,
            name: true,
            email: true,
            status: true,
            image: true,
            imageKey: true,
          },
        },
        lastModifiedByUser: {
          select: {
            id: true,
            name: true,
            email: true,
            status: true,
            image: true,
            imageKey: true,
          },
        },
        liveSessions: {
          include: {
            interviewer: {
              select: { id: true, name: true },
            },
            tags: {
              orderBy: { timestamp: "asc" as const },
              include: { user: { select: { id: true, name: true } } },
            },
            notes: {
              orderBy: { timestamp: "asc" as const },
              include: { user: { select: { id: true, name: true } } },
            },
          },
        },
        heuristicEvaluation: {
          include: {
            results: { include: { heuristic: true, recommendations: true } },
          },
        },
        cognitiveWalkthrough: {
          include: {
            steps: {
              include: {
                issues: { include: { recommendations: true } },
              },
            },
          },
        },
        qualitativeAnalysis: {
          include: {
            _count: { select: { insights: true } },
            insights: true,
          },
        },
      },
    });

    logger.info("Successfully fetched study", {
      studyId,
      userId,
      found: !!study,
    });
    return study;
  } catch (error) {
    logger.error("Failed to fetch study", { studyId, userId, error });
    throw error;
  }
}

export async function dbGetStudies(userId: string, teamId?: string) {
  try {
    const {
      teamIds: userTeamIds,
      companyIds: userCompanyIds,
      adminTeamIds,
      adminCompanyIds,
    } = await getUserMembershipIds(userId);

    const visibilityConditions = buildStudyVisibilityConditions(
      userId,
      userTeamIds,
      userCompanyIds,
      adminTeamIds,
      adminCompanyIds,
    );

    let whereClause: any;

    if (teamId) {
      const team = await prisma.team.findUnique({
        where: { id: teamId },
        select: { isDefaultForCompany: true, companyId: true },
      });

      if (team?.isDefaultForCompany && team.companyId) {
        whereClause = {
          OR: [
            {
              teamId,
              OR: visibilityConditions,
            },
            {
              visibility: "COMPANY",
              team: { companyId: team.companyId },
            },
          ],
        };
      } else {
        whereClause = {
          teamId,
          OR: visibilityConditions,
        };
      }
    } else {
      whereClause = {
        OR: visibilityConditions,
      };
    }

    const studies = await prisma.study.findMany({
      where: whereClause,
      orderBy: [{ createdAt: "desc" }],
      include: {
        files: true,
        createdByUser: {
          select: { id: true, name: true, email: true },
        },
        lastModifiedByUser: {
          select: { id: true, name: true, email: true },
        },
        liveSessions: true,
        persona: {
          select: {
            isLatest: true,
            _count: {
              select: {
                heuristicEvaluations: true,
                cognitiveWalkthroughs: true,
              },
            },
          },
        },
        team: {
          select: {
            isPersonal: true,
            company: { select: { id: true } },
          },
        },
        qualitativeAnalysis: {
          select: { coverImageKey: true },
        },
      },
    });

    // Filter out old persona versions
    const filteredStudies = studies.filter(
      (study) =>
        study.type !== "PERSONA" ||
        (study.persona && study.persona.isLatest) ||
        (!study.persona && study.status === "PENDING"),
    );

    logger.info("Successfully fetched studies", {
      userId,
      teamId,
      studyCount: studies.length,
      filteredCount: filteredStudies.length,
    });
    return filteredStudies;
  } catch (error) {
    logger.error("Failed to fetch studies", { userId, teamId, error });
    throw error;
  }
}

export async function dbDeleteStudy(studyId: string, userId: string) {
  try {
    const { isOwner, isTeamAdmin, isCompanyAdmin } =
      await getStudyManagementContext(studyId, userId);

    if (!isOwner && !isTeamAdmin && !isCompanyAdmin) {
      throw ForbiddenError("User not authorized to delete study");
    }

    // Check if this is a PERSONA study with related studies
    const persona = await prisma.persona.findUnique({
      where: { studyId },
      include: {
        heuristicEvaluations: { select: { id: true }, take: 1 },
        cognitiveWalkthroughs: { select: { id: true }, take: 1 },
      },
    });

    if (persona) {
      const hasRelatedStudies =
        persona.heuristicEvaluations.length > 0 ||
        persona.cognitiveWalkthroughs.length > 0;

      if (hasRelatedStudies) {
        throw BadRequestError(
          "Cannot delete persona with related studies. Please delete or reassign the related studies first.",
        );
      }
    }

    await prisma.study.delete({
      where: { id: studyId },
    });

    logger.info("Successfully deleted study", { studyId, userId });
  } catch (error) {
    logger.error("Failed to delete study", { studyId, userId, error });
    throw error;
  }
}

// ============================================================================
// Study Status & Metadata
// ============================================================================

export async function dbUpdateStudyAttempts(studyId: string) {
  try {
    await prisma.study.update({
      where: { id: studyId },
      data: { attempts: { increment: 1 } },
    });
    logger.info("Successfully updated study attempts", { studyId });
  } catch (error) {
    logger.error("Failed to update study attempts", { studyId, error });
    throw error;
  }
}

export async function dbUpdateStudyStatus(
  studyId: string,
  status: StudyStatus,
) {
  try {
    const study = await prisma.study.findUnique({
      where: { id: studyId },
      select: {
        id: true,
        name: true,
        createdByUserId: true,
        type: true,
      },
    });

    await prisma.study.update({
      where: { id: studyId },
      data: { status },
    });

    logger.info("Successfully updated study status", { studyId, status });

    // Create notification for study completion or failure
    if (
      study?.createdByUserId &&
      (status === "COMPLETED" || status === "FAILED")
    ) {
      try {
        const studyName = study.name || "Your study";
        const isCompleted = status === "COMPLETED";

        let routePrefix = "";
        switch (study.type) {
          case "HEURISTIC_EVALUATION":
            routePrefix = "/evaluation";
            break;
          case "PERSONA":
            routePrefix = "/persona";
            break;
          case "COGNITIVE_WALKTHROUGH":
            routePrefix = "/walkthrough";
            break;
          case "QUAL_ANALYSIS":
            routePrefix = "/analysis";
            break;
        }

        const title = isCompleted ? "Study completed" : "Study failed";
        const message = isCompleted
          ? `${studyName} has finished processing`
          : `${studyName} encountered an error`;

        await dbCreateNotification({
          userId: study.createdByUserId,
          type: isCompleted
            ? NotificationType.STUDY_COMPLETE
            : NotificationType.STUDY_FAILED,
          audience: NotificationAudience.USER,
          title,
          message,
          actionUrl: `${routePrefix}/${studyId}`,
          metadata: { studyId, studyName, studyType: study.type },
        });
      } catch (notifError) {
        logger.error("Failed to create study status notification", {
          studyId,
          error: (notifError as Error)?.message,
        });
      }
    }
  } catch (error) {
    logger.error("Failed to update study status", { studyId, status, error });
    throw error;
  }
}

export async function dbUpdateStudyName(
  studyId: string,
  name: string,
  userId?: string,
) {
  try {
    if (userId) {
      await requireStudyAccess(studyId, userId);
    }

    const updatedStudy = await prisma.study.update({
      where: { id: studyId },
      data: {
        name,
        lastModifiedByUserId: userId,
      },
    });

    logger.info("Successfully updated study name", { studyId, name, userId });
    return updatedStudy;
  } catch (error) {
    logger.error("Failed to update study name", { studyId, name, error });
    throw error;
  }
}

export async function dbUpdateStudyTeam(params: {
  studyId: string;
  teamId: string;
  userId: string;
}) {
  const { studyId, teamId, userId } = params;

  const membership = await prisma.teamMembership.findUnique({
    where: { teamId_userId: { teamId, userId } },
    select: { id: true },
  });

  if (!membership) {
    throw BadRequestError(
      "User is not a member of the requested team",
      "NOT_MEMBER",
    );
  }

  const study = await prisma.study.findUnique({
    where: { id: studyId },
    select: { id: true, teamId: true },
  });

  if (!study) {
    throw NotFoundError("Study not found", "NOT_FOUND");
  }

  if (study.teamId === teamId) {
    logger.info("Study already assigned to requested team", {
      studyId,
      teamId,
    });
    return study;
  }

  try {
    const updated = await prisma.study.update({
      where: { id: studyId },
      data: { teamId },
      select: { id: true, teamId: true },
    });

    logger.info("Updated study team", {
      studyId,
      previousTeamId: study.teamId,
      newTeamId: updated.teamId,
      userId,
    });
    return updated;
  } catch (error) {
    logger.error("Failed to update study team", {
      studyId,
      teamId,
      userId,
      error,
    });
    throw error;
  }
}

// ============================================================================
// Study Visibility & Sharing
// ============================================================================

export async function dbCanAccessStudy(
  studyId: string,
  userId: string,
): Promise<{
  hasAccess: boolean;
  study?: {
    id: string;
    visibility: StudyVisibility;
    createdByUserId: string;
    teamId: string | null;
  };
}> {
  try {
    const {
      teamIds: userTeamIds,
      companyIds: userCompanyIds,
      adminTeamIds,
      adminCompanyIds,
    } = await getUserMembershipIds(userId);

    const study = await prisma.study.findFirst({
      where: {
        id: studyId,
        OR: buildStudyVisibilityConditions(
          userId,
          userTeamIds,
          userCompanyIds,
          adminTeamIds,
          adminCompanyIds,
        ),
      },
      select: {
        id: true,
        visibility: true,
        createdByUserId: true,
        teamId: true,
      },
    });

    return {
      hasAccess: !!study,
      study: study || undefined,
    };
  } catch (error) {
    logger.error("Failed to check study access", { studyId, userId, error });
    throw error;
  }
}

export async function dbUpdateStudyVisibility(params: {
  studyId: string;
  visibility: StudyVisibility;
  userId: string;
}) {
  const { studyId, visibility, userId } = params;

  try {
    const { study, isOwner, isTeamAdmin, isCompanyAdmin } =
      await getStudyManagementContext(studyId, userId);

    if (!isOwner && !isTeamAdmin && !isCompanyAdmin) {
      throw ForbiddenError("User not authorized to update study visibility");
    }

    if (visibility === "COMPANY") {
      const team = await prisma.team.findUnique({
        where: { id: study.teamId! },
        select: { companyId: true },
      });
      if (!team?.companyId) {
        throw BadRequestError(
          "Company visibility requires the study's team to belong to a company",
        );
      }
    }

    const updatedStudy = await prisma.study.update({
      where: { id: studyId },
      data: {
        visibility,
        lastModifiedByUserId: userId,
      },
    });

    logger.info("Successfully updated study visibility", {
      studyId,
      visibility,
      userId,
    });

    return updatedStudy;
  } catch (error) {
    logger.error("Failed to update study visibility", {
      studyId,
      visibility,
      userId,
      error,
    });
    throw error;
  }
}

export async function dbRegenerateStudyShareToken(params: {
  studyId: string;
  userId: string;
}) {
  const { studyId, userId } = params;

  try {
    await requireStudyAccess(studyId, userId);

    const newToken = generateShareToken();

    const updatedStudy = await prisma.study.update({
      where: { id: studyId },
      data: {
        shareToken: newToken,
        lastModifiedByUserId: userId,
      },
    });

    logger.info("Successfully regenerated study share token", {
      studyId,
      userId,
    });
    return updatedStudy;
  } catch (error) {
    logger.error("Failed to regenerate study share token", {
      studyId,
      userId,
      error,
    });
    throw error;
  }
}

export async function dbToggleStudyShareLink(params: {
  studyId: string;
  userId: string;
  enabled: boolean;
}) {
  const { studyId, userId, enabled } = params;

  try {
    await requireStudyAccess(studyId, userId);

    const newToken = enabled ? generateShareToken() : null;

    const updatedStudy = await prisma.study.update({
      where: { id: studyId },
      data: {
        shareToken: newToken,
        lastModifiedByUserId: userId,
      },
    });

    logger.info("Successfully toggled study share link", {
      studyId,
      userId,
      enabled,
    });
    return { shareToken: updatedStudy.shareToken };
  } catch (error) {
    logger.error("Failed to toggle study share link", {
      studyId,
      userId,
      enabled,
      error,
    });
    throw error;
  }
}

export async function dbGetStudyByShareToken(shareToken: string) {
  try {
    const study = await prisma.study.findUnique({
      where: { shareToken },
      include: {
        files: true,
        createdByUser: { select: { id: true, name: true } },
        lastModifiedByUser: { select: { id: true, name: true } },
        team: { select: { id: true, name: true } },
        cognitiveWalkthrough: {
          include: {
            steps: {
              include: {
                results: { include: { question: true } },
                issues: { include: { recommendations: true } },
              },
            },
            persona: {
              select: {
                id: true,
                name: true,
                description: true,
                studyId: true,
                photoFile: { select: { key: true } },
              },
            },
          },
        },
        heuristicEvaluation: {
          include: {
            heuristicFamily: { include: { heuristics: true } },
            persona: {
              select: {
                id: true,
                name: true,
                description: true,
                studyId: true,
                photoFile: { select: { key: true } },
              },
            },
            results: {
              include: { heuristic: true, file: true, recommendations: true },
            },
          },
        },
        persona: {
          select: {
            id: true,
            name: true,
            description: true,
            photoFileId: true,
            coverFileId: true,
            personaGroupId: true,
            version: true,
            isLatest: true,
            data: true,
          },
        },
      },
    });

    if (!study) {
      logger.info("Study not found by share token", { shareToken });
      return null;
    }

    logger.info("Successfully fetched study by share token", {
      studyId: study.id,
      shareToken,
    });

    return study;
  } catch (error) {
    logger.error("Failed to fetch study by share token", { shareToken, error });
    throw error;
  }
}

export async function dbGetStudyShareInfo(studyId: string, userId: string) {
  try {
    await requireStudyAccess(studyId, userId);

    const study = await prisma.study.findUnique({
      where: { id: studyId },
      select: {
        id: true,
        visibility: true,
        shareToken: true,
        team: {
          select: {
            id: true,
            name: true,
            companyId: true,
            isPersonal: true,
          },
        },
      },
    });

    logger.info("Successfully fetched study share info", { studyId, userId });
    return study;
  } catch (error) {
    logger.error("Failed to fetch study share info", {
      studyId,
      userId,
      error,
    });
    throw error;
  }
}

export async function dbGetStudyPublicRedirectInfo(studyId: string) {
  try {
    const study = await prisma.study.findUnique({
      where: { id: studyId },
      select: { id: true, shareToken: true },
    });

    if (!study || !study.shareToken) {
      return null;
    }

    return { id: study.id, shareToken: study.shareToken };
  } catch (error) {
    logger.error("Failed to get study public redirect info", {
      studyId,
      error,
    });
    throw error;
  }
}

// ============================================================================
// Bookmarked Studies
// ============================================================================

export async function dbGetBookmarkedStudyIds(
  userId: string,
): Promise<string[]> {
  try {
    const bookmarkedStudies = await prisma.bookmarkedStudy.findMany({
      where: { userId },
      select: { studyId: true },
    });
    logger.info("Successfully fetched bookmarked study IDs", {
      userId,
      count: bookmarkedStudies.length,
    });
    return bookmarkedStudies.map((s) => s.studyId);
  } catch (error) {
    logger.error("Failed to fetch bookmarked study IDs", { userId, error });
    throw error;
  }
}

export async function dbIsStudyBookmarked(
  userId: string,
  studyId: string,
): Promise<boolean> {
  try {
    const bookmarked = await prisma.bookmarkedStudy.findUnique({
      where: { userId_studyId: { userId, studyId } },
    });
    return !!bookmarked;
  } catch (error) {
    logger.error("Failed to check if study is bookmarked", {
      userId,
      studyId,
      error,
    });
    throw error;
  }
}

export async function dbToggleStudyBookmark(
  userId: string,
  studyId: string,
): Promise<{ success: boolean; isBookmarked: boolean }> {
  try {
    const isCurrentlyBookmarked = await dbIsStudyBookmarked(userId, studyId);

    if (isCurrentlyBookmarked) {
      try {
        await prisma.bookmarkedStudy.delete({
          where: { userId_studyId: { userId, studyId } },
        });
        logger.info("Successfully removed bookmark from study", {
          userId,
          studyId,
        });
        return { success: true, isBookmarked: false };
      } catch (error: any) {
        if (error.code === "P2025") {
          return { success: true, isBookmarked: false };
        }
        throw error;
      }
    } else {
      const study = await prisma.study.findUnique({
        where: { id: studyId },
        include: {
          team: {
            include: {
              memberships: {
                where: { userId, status: TeamMembershipStatus.ACTIVE },
              },
            },
          },
        },
      });

      if (!study) {
        throw NotFoundError("Study not found");
      }

      const isTeamMember =
        study.team?.memberships && study.team.memberships.length > 0;
      const isCreator = study.createdByUserId === userId;

      if (!isTeamMember && !isCreator) {
        throw ForbiddenError("User not authorized to bookmark this study");
      }

      try {
        await prisma.bookmarkedStudy.create({
          data: { userId, studyId },
        });
        logger.info("Successfully bookmarked study", { userId, studyId });
        return { success: true, isBookmarked: true };
      } catch (error: any) {
        if (error.code === "P2002") {
          return { success: true, isBookmarked: true };
        }
        throw error;
      }
    }
  } catch (error) {
    logger.error("Failed to toggle study bookmark", { userId, studyId, error });
    throw error;
  }
}

// ============================================================================
// Study Files
// ============================================================================

export async function dbGetFiles(studyId: string) {
  try {
    const files = await prisma.file.findMany({
      where: { studyId },
    });
    logger.info("Successfully fetched files", {
      studyId,
      fileCount: files.length,
    });
    return files;
  } catch (error) {
    logger.error("Failed to fetch files", { studyId, error });
    throw error;
  }
}

/**
 * Update the transcript field on a file record.
 * Used by the AI worker to cache Whisper transcriptions and PDF-extracted text.
 */
export async function dbUpdateFileTranscript(
  fileId: string,
  transcript: string,
) {
  try {
    const file = await prisma.file.update({
      where: { id: fileId },
      data: { transcript },
      select: { id: true, originalName: true },
    });
    logger.info("File transcript updated", {
      fileId,
      originalName: file.originalName,
      transcriptLength: transcript.length,
    });
    return file;
  } catch (error) {
    logger.error("Failed to update file transcript", { fileId, error });
    throw error;
  }
}

/**
 * Update the identifier field on a file record.
 * Used to store a participant identifier (e.g., "P1") extracted by AI or set manually.
 */
export async function dbUpdateFileIdentifier(
  fileId: string,
  identifier: string,
) {
  try {
    const file = await prisma.file.update({
      where: { id: fileId },
      data: { identifier: identifier || null },
      select: { id: true, originalName: true, identifier: true },
    });
    logger.info("File identifier updated", {
      fileId,
      originalName: file.originalName,
      identifier: file.identifier,
    });
    return file;
  } catch (error) {
    logger.error("Failed to update file identifier", { fileId, error });
    throw error;
  }
}
