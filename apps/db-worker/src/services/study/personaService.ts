import prisma from "@/apps/db-worker/src/services/db.ts";
import type { Prisma } from "@prisma/client";
import { StudyType, StudyStatus, FileType, TeamMembershipStatus } from "@prisma/client";
import { logger } from "@/apps/shared/logger.ts";
import { guessImageTypeFromKey } from "../shared/helpers.ts";
import {
  getUserMembershipIds,
  buildStudyVisibilityConditions,
} from "../shared/authorization.ts";
import type { JobEnvelopeV2_PE } from "../shared/types.ts";
import { dbUpdateStudyStatus, dbUpdateStudyName } from "./studyService.ts";

// ============================================================================
// Persona CRUD
// ============================================================================

export async function dbPostPersona(data: {
  studyData: JobEnvelopeV2_PE;
  persona: {
    name?: string | null;
    description?: string | null;
    photoKey?: string | null;
    coverKey?: string | null;
    payload?: any;
  };
}) {
  const { studyData, persona } = data;
  const studyId = studyData.studyId;
  const bucket = process.env.AWS_BUCKET || "";

  try {
    let photoFileId: string | undefined;
    let coverFileId: string | undefined;

    if (persona.photoKey) {
      const existing = await prisma.file.findFirst({
        where: { studyId, key: persona.photoKey },
        select: { id: true },
      });
      if (existing) {
        photoFileId = existing.id;
      } else {
        const file = await prisma.file.create({
          data: {
            studyId,
            bucket,
            key: persona.photoKey,
            size: null,
            fileType: FileType.IMAGE,
            imageType: guessImageTypeFromKey(persona.photoKey),
          },
        });
        photoFileId = file.id;
      }
    }

    if (persona.coverKey) {
      const existing = await prisma.file.findFirst({
        where: { studyId, key: persona.coverKey },
        select: { id: true },
      });
      if (existing) {
        coverFileId = existing.id;
      } else {
        const file = await prisma.file.create({
          data: {
            studyId,
            bucket,
            key: persona.coverKey,
            size: null,
            fileType: FileType.IMAGE,
            imageType: guessImageTypeFromKey(persona.coverKey),
          },
        });
        coverFileId = file.id;
      }
    }

    await prisma.persona.upsert({
      where: { studyId },
      create: {
        studyId,
        personaGroupId: studyId,
        version: 1,
        isLatest: true,
        name: (persona.name || undefined) as string | undefined,
        description: (persona.description || undefined) as string | undefined,
        photoFileId,
        coverFileId,
        data: (persona.payload ?? null) as unknown as Prisma.InputJsonValue,
      },
      update: {
        name: (persona.name || undefined) as string | undefined,
        description: (persona.description || undefined) as string | undefined,
        photoFileId,
        coverFileId,
        data: (persona.payload ?? null) as unknown as Prisma.InputJsonValue,
      },
    });

    if (
      persona.name &&
      typeof persona.name === "string" &&
      persona.name.trim().length > 0
    ) {
      await dbUpdateStudyName(studyId, persona.name);
    }

    await dbUpdateStudyStatus(studyId, StudyStatus.COMPLETED);

    logger.info("Successfully added persona to database", { studyId });
  } catch (error) {
    logger.error("Failed to add persona to database", { studyId, error });
    throw error;
  }
}

export async function dbGetPersona(studyId: string, userId: string) {
  try {
    const {
      teamIds: userTeamIds,
      companyIds: userCompanyIds,
      adminTeamIds,
      adminCompanyIds,
    } = await getUserMembershipIds(userId);

    const personaStudy = await prisma.study.findFirst({
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
        persona: {
          include: {
            photoFile: true,
            coverFile: true,
          },
        },
      },
    });

    if (!personaStudy || !personaStudy.persona) {
      logger.info("Successfully fetched persona", {
        studyId,
        userId,
        found: !!personaStudy,
      });
      return personaStudy;
    }

    const relatedStudyVisibilityConditions = buildStudyVisibilityConditions(
      userId,
      userTeamIds,
      userCompanyIds,
      adminTeamIds,
      adminCompanyIds
    );

    const personaGroupId = personaStudy.persona.personaGroupId;
    
    if (personaGroupId) {
      const personaVersions = await prisma.persona.findMany({
        where: { personaGroupId },
        select: { id: true },
      });
      const personaIds = personaVersions.map((p) => p.id);

      const heuristicEvaluations = await prisma.heuristicEvaluation.findMany({
        where: {
          personaId: { in: personaIds },
          study: { OR: relatedStudyVisibilityConditions },
        },
        include: {
          persona: {
            select: { id: true, version: true, personaGroupId: true, name: true },
          },
          study: {
            include: {
              files: true,
              createdByUser: { select: { id: true, name: true, email: true } },
              lastModifiedByUser: { select: { id: true, name: true, email: true } },
            },
          },
        },
      });

      const cognitiveWalkthroughs = await prisma.cognitiveWalkthrough.findMany({
        where: {
          personaId: { in: personaIds },
          study: { OR: relatedStudyVisibilityConditions },
        },
        include: {
          persona: {
            select: { id: true, version: true, personaGroupId: true, name: true },
          },
          study: {
            include: {
              files: true,
              createdByUser: { select: { id: true, name: true, email: true } },
              lastModifiedByUser: { select: { id: true, name: true, email: true } },
            },
          },
        },
      });

      (personaStudy.persona as any).heuristicEvaluations = heuristicEvaluations;
      (personaStudy.persona as any).cognitiveWalkthroughs = cognitiveWalkthroughs;
    } else {
      // Fallback for personas without personaGroupId
      const heuristicEvaluations = await prisma.heuristicEvaluation.findMany({
        where: {
          personaId: personaStudy.persona.id,
          study: { OR: relatedStudyVisibilityConditions },
        },
        include: {
          persona: {
            select: { id: true, version: true, personaGroupId: true, name: true },
          },
          study: {
            include: {
              files: true,
              createdByUser: { select: { id: true, name: true, email: true } },
              lastModifiedByUser: { select: { id: true, name: true, email: true } },
            },
          },
        },
      });

      const cognitiveWalkthroughs = await prisma.cognitiveWalkthrough.findMany({
        where: {
          personaId: personaStudy.persona.id,
          study: { OR: relatedStudyVisibilityConditions },
        },
        include: {
          persona: {
            select: { id: true, version: true, personaGroupId: true, name: true },
          },
          study: {
            include: {
              files: true,
              createdByUser: { select: { id: true, name: true, email: true } },
              lastModifiedByUser: { select: { id: true, name: true, email: true } },
            },
          },
        },
      });

      (personaStudy.persona as any).heuristicEvaluations = heuristicEvaluations;
      (personaStudy.persona as any).cognitiveWalkthroughs = cognitiveWalkthroughs;
    }

    logger.info("Successfully fetched persona with related studies", {
      studyId,
      userId,
      found: !!personaStudy,
      personaGroupId,
      heuristicEvaluationsCount:
        (personaStudy.persona as any).heuristicEvaluations?.length || 0,
      cognitiveWalkthroughsCount:
        (personaStudy.persona as any).cognitiveWalkthroughs?.length || 0,
    });
    return personaStudy;
  } catch (error) {
    logger.error("Failed to fetch persona", { studyId, userId, error });
    throw error;
  }
}

export async function dbGetPersonaBasicInfo(studyId: string) {
  try {
    const personaStudy = await prisma.study.findUnique({
      where: { id: studyId },
      select: {
        id: true,
        persona: {
          select: {
            id: true,
            name: true,
            data: true,
            photoFile: { select: { key: true } },
          },
        },
      },
    });

    if (!personaStudy?.persona) {
      logger.debug("Persona not found for basic info", { studyId });
      return null;
    }

    const personaData = personaStudy.persona.data as any;
    const description =
      personaData?.data?.description ?? personaData?.description ?? null;

    logger.debug("Successfully fetched persona basic info", {
      studyId,
      found: true,
      hasPhoto: !!personaStudy.persona.photoFile?.key,
    });

    return {
      id: personaStudy.persona.id,
      name: personaStudy.persona.name,
      description,
      photoKey: personaStudy.persona.photoFile?.key ?? null,
    };
  } catch (error) {
    logger.error("Failed to fetch persona basic info", { studyId, error });
    throw error;
  }
}

export async function dbListPersonas(userId: string, teamId: string) {
  try {
    const membership = await prisma.teamMembership.findUnique({
      where: { teamId_userId: { teamId, userId } },
      select: { id: true },
    });

    if (!membership) {
      logger.warn(
        "User attempted to list personas for team without membership",
        { userId, teamId }
      );
      return [];
    }

    const studies = await prisma.study.findMany({
      where: {
        teamId,
        type: StudyType.PERSONA,
        team: {
          memberships: {
            some: { userId, status: TeamMembershipStatus.ACTIVE },
          },
        },
        persona: { isLatest: true },
      },
      orderBy: { createdAt: "desc" },
      include: {
        files: true,
        persona: {
          include: { photoFile: true, coverFile: true },
        },
      },
    });

    logger.info("Successfully listed personas", {
      userId,
      teamId,
      count: studies.length,
    });
    return studies;
  } catch (error) {
    logger.error("Failed to list personas", { userId, teamId, error });
    throw error;
  }
}

export async function dbGetPersonaVersions(personaGroupId: string, userId: string) {
  try {
    const versions = await prisma.persona.findMany({
      where: {
        personaGroupId,
        study: {
          OR: [
            { createdByUserId: userId },
            {
              team: {
                memberships: {
                  some: { userId, status: TeamMembershipStatus.ACTIVE },
                },
              },
            },
          ],
        },
      },
      orderBy: { version: "desc" },
      include: {
        study: {
          select: {
            id: true,
            name: true,
            createdAt: true,
            updatedAt: true,
            createdByUser: { select: { id: true, name: true, email: true } },
          },
        },
        photoFile: true,
        coverFile: true,
      },
    });

    logger.info("Successfully fetched persona versions", {
      personaGroupId,
      userId,
      versionCount: versions.length,
    });
    return versions;
  } catch (error) {
    logger.error("Failed to fetch persona versions", {
      personaGroupId,
      userId,
      error,
    });
    throw error;
  }
}

export async function dbUpdatePersona(studyId: string, userId: string, data: any) {
  try {
    const studyWithPersona = await prisma.study.findFirst({
      where: {
        id: studyId,
        OR: [
          { createdByUserId: userId },
          {
            team: {
              memberships: {
                some: { userId, status: TeamMembershipStatus.ACTIVE },
              },
            },
          },
        ],
      },
      select: {
        id: true,
        teamId: true,
        createdByUserId: true,
        visibility: true,
        persona: {
          select: {
            id: true,
            personaGroupId: true,
            version: true,
            name: true,
            description: true,
            photoFileId: true,
            coverFileId: true,
            data: true,
          },
        },
      },
    });

    if (!studyWithPersona) {
      logger.warn("User attempted to update persona without access", {
        userId,
        studyId,
      });
      throw new Error("Unauthorized");
    }

    if (!studyWithPersona.persona) {
      logger.warn("User attempted to update non-existent persona", {
        userId,
        studyId,
      });
      throw new Error("Persona not found");
    }

    const currentPersona = studyWithPersona.persona;
    const bucket = process.env.AWS_BUCKET || "";

    // Mark the current version as no longer latest
    await prisma.persona.update({
      where: { id: currentPersona.id },
      data: { isLatest: false },
    });

    // Create a new study for the new persona version
    const newStudy = await prisma.study.create({
      data: {
        createdByUserId: studyWithPersona.createdByUserId,
        lastModifiedByUserId: userId,
        teamId: studyWithPersona.teamId,
        name: data.name || currentPersona.name || "Untitled Persona",
        type: StudyType.PERSONA,
        status: StudyStatus.COMPLETED,
        visibility: studyWithPersona.visibility,
        jobData: { init: true },
      },
    });

    let photoFileId: string | undefined;
    let coverFileId: string | undefined;

    if (data.images?.photoKey) {
      const file = await prisma.file.create({
        data: {
          studyId: newStudy.id,
          bucket,
          key: data.images.photoKey,
          size: null,
          fileType: FileType.IMAGE,
          imageType: guessImageTypeFromKey(data.images.photoKey),
        },
      });
      photoFileId = file.id;
    }

    if (data.images?.coverKey) {
      const file = await prisma.file.create({
        data: {
          studyId: newStudy.id,
          bucket,
          key: data.images.coverKey,
          size: null,
          fileType: FileType.IMAGE,
          imageType: guessImageTypeFromKey(data.images.coverKey),
        },
      });
      coverFileId = file.id;
    }

    const newPersona = await prisma.persona.create({
      data: {
        studyId: newStudy.id,
        personaGroupId: currentPersona.personaGroupId,
        version: currentPersona.version + 1,
        isLatest: true,
        name: data.name || undefined,
        description: data.description || undefined,
        photoFileId,
        coverFileId,
        data: { data } as unknown as Prisma.InputJsonValue,
      },
    });

    logger.info("Successfully created new persona version", {
      oldStudyId: studyId,
      newStudyId: newStudy.id,
      personaGroupId: currentPersona.personaGroupId,
      oldVersion: currentPersona.version,
      newVersion: newPersona.version,
      userId,
    });

    return {
      persona: newPersona,
      study: newStudy,
    };
  } catch (error) {
    logger.error("Failed to update persona", { studyId, userId, error });
    throw error;
  }
}
