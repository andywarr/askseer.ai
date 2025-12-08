// Prisma imports
import prisma from "@/apps/db-worker/src/services/db.ts";
import type { Prisma } from "@prisma/client";
import { logger } from "@/apps/shared/logger.ts";
import { DeleteObjectsCommand, S3Client } from "@aws-sdk/client-s3";
import type {
  JobEnvelopeV2,
  JobEnvelopeV2_HE,
  JobEnvelopeV2_CW,
  JobEnvelopeV2_PE,
} from "@/apps/shared/jobSchema.ts";
import {
  CWIssueType,
  FileType,
  ImageType,
  InviteStatus,
  SourceType,
  ContentRating,
  StudyStatus,
  StudyType,
  CompanyRole,
  CompanyMembershipStatus,
  TeamRole,
  TeamJoinPolicy,
  TeamMembershipStatus,
  UserStatus,
} from "@prisma/client";
import {
  TEAM_NAME_MIN_LENGTH,
  TEAM_NAME_MAX_LENGTH,
  RESERVED_TEAM_NAMES,
} from "@/apps/shared/constants.ts";

type V2JobData = JobEnvelopeV2;

interface HERecommendation {
  recommendation: string;
}

interface ResultData {
  id: string;
  heuristic: string;
  violated: boolean;
  reason: string;
  severity?: number;
  recommendations: HERecommendation[];
  fileId: string;
  step: number;
}

// Helper function to update study modification tracking
async function updateStudyModification(studyId: string, userId: string) {
  try {
    await prisma.study.update({
      where: { id: studyId },
      data: {
        lastModifiedByUserId: userId,
        // updatedAt will auto-update due to @updatedAt in schema
      },
    });
    logger.info("Updated study modification tracking", { studyId, userId });
  } catch (error) {
    logger.error("Failed to update study modification tracking", {
      studyId,
      userId,
      error,
    });
    // Don't throw - this is a non-critical update
  }
}

// Helper function to get studyId from heuristicEvaluationId
async function getStudyIdFromHEEvaluation(
  heuristicEvaluationId: string
): Promise<string | null> {
  const evaluation = await prisma.heuristicEvaluation.findUnique({
    where: { id: heuristicEvaluationId },
    select: { studyId: true },
  });
  return evaluation?.studyId || null;
}

// Helper function to get studyId from CW stepId
async function getStudyIdFromCWStep(stepId: string): Promise<string | null> {
  const step = await prisma.cWStep.findUnique({
    where: { id: stepId },
    include: {
      cognitiveWalkthrough: {
        select: { studyId: true },
      },
    },
  });
  return step?.cognitiveWalkthrough.studyId || null;
}

// Helper function to get studyId from a CW issue
async function getStudyIdFromCWIssue(issueId: string): Promise<string | null> {
  const issue = await prisma.cWIssue.findUnique({
    where: { id: issueId },
    select: { stepId: true },
  });
  if (!issue) return null;
  return getStudyIdFromCWStep(issue.stepId);
}

// Helper function to get studyId from a CW recommendation
async function getStudyIdFromCWRecommendation(
  recommendationId: string
): Promise<string | null> {
  const recommendation = await prisma.cWRecommendation.findUnique({
    where: { id: recommendationId },
    select: { issueId: true },
  });
  if (!recommendation) return null;
  return getStudyIdFromCWIssue(recommendation.issueId);
}

// Helper function to get studyId from an HE result (issue)
async function getStudyIdFromHEResult(
  resultId: string
): Promise<string | null> {
  const result = await prisma.hEResult.findUnique({
    where: { id: resultId },
    select: { heuristicEvaluationId: true },
  });
  if (!result) return null;
  return getStudyIdFromHEEvaluation(result.heuristicEvaluationId);
}

// Helper function to get studyId from an HE recommendation
async function getStudyIdFromHERecommendation(
  recommendationId: string
): Promise<string | null> {
  const recommendation = await prisma.hERecommendation.findUnique({
    where: { id: recommendationId },
    select: { resultId: true },
  });
  if (!recommendation) return null;
  return getStudyIdFromHEResult(recommendation.resultId);
}

interface HeuristicEvaluationData {
  studyData: JobEnvelopeV2_HE;
  results: ResultData[];
}

interface CognitiveWalkthroughData {
  studyData: JobEnvelopeV2_CW;
  results: CWStepData[];
}

interface CWResultData {
  questionId: string;
  answer: string;
}

interface CWIssueData {
  issueType: string;
  issue: string;
  severity?: number;
  recommendations: Array<CWRecommendationData>;
}

interface CWRecommendationData {
  recommendation: string;
}

interface CWStepData {
  step: number;
  expected: boolean;
  results: Array<CWResultData>;
  issues: Array<CWIssueData>;
}

function convertToFileType(type: string): FileType {
  switch (type.split("/")[0].toLowerCase()) {
    case "image":
      return FileType.IMAGE;
    default:
      return FileType.UNKNOWN;
  }
}

function convertToImageType(type: string): ImageType {
  switch (type.split("/")[1].toLowerCase()) {
    case "apng":
      return ImageType.APNG;
    case "avif":
      return ImageType.AVIF;
    case "gif":
      return ImageType.GIF;
    case "jpeg":
      return ImageType.JPEG;
    case "png":
      return ImageType.PNG;
    case "svg+xml":
      return ImageType.SVG;
    case "webp":
      return ImageType.WEBP;
    default:
      return ImageType.UNKNOWN;
  }
}

function guessImageTypeFromKey(key: string): ImageType {
  const lower = key.toLowerCase();
  if (lower.endsWith(".png")) return ImageType.PNG;
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return ImageType.JPEG;
  if (lower.endsWith(".gif")) return ImageType.GIF;
  if (lower.endsWith(".webp")) return ImageType.WEBP;
  if (lower.endsWith(".avif")) return ImageType.AVIF;
  if (lower.endsWith(".apng")) return ImageType.APNG;
  if (lower.endsWith(".svg")) return ImageType.SVG;
  return ImageType.UNKNOWN;
}

const s3Client = new S3Client({ region: process.env.AWS_REGION });

function canDeleteCompany(
  membership:
    | (typeof prisma.companyMembership extends { findUnique: any }
        ? Prisma.CompanyMembershipGetPayload<{
            select: {
              role: true;
              status: true;
              deactivatedAt: true;
              user: { select: { status: true } };
            };
          }>
        : never)
    | null
) {
  const allowedRoles: CompanyRole[] = [CompanyRole.OWNER, CompanyRole.ADMIN];
  return (
    !!membership &&
    membership.status === CompanyMembershipStatus.ACTIVE &&
    membership.deactivatedAt === null &&
    membership.user?.status === UserStatus.ACTIVE &&
    allowedRoles.includes(membership.role as CompanyRole)
  );
}

async function deleteS3Objects(keys: string[]) {
  const bucket = process.env.AWS_BUCKET || process.env.AWS_BUCKET_NAME;

  if (!bucket) {
    const err: any = new Error("AWS bucket not configured");
    err.status = 500;
    throw err;
  }

  if (!keys.length) {
    return {
      deleted: [] as string[],
      errors: [] as Array<{ key: string; message: string }>,
    };
  }

  const deleted: string[] = [];
  const errors: Array<{ key: string; message: string }> = [];

  const batches = Array.from(
    { length: Math.ceil(keys.length / 1000) },
    (_, index) => keys.slice(index * 1000, (index + 1) * 1000)
  );

  const responses = await Promise.allSettled(
    batches.map((batch) =>
      s3Client.send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: { Objects: batch.map((key) => ({ Key: key })) },
        })
      )
    )
  );

  responses.forEach((result, idx) => {
    const batch = batches[idx];

    if (result.status === "fulfilled") {
      result.value.Deleted?.forEach((item) => {
        if (item.Key) deleted.push(item.Key);
      });

      result.value.Errors?.forEach((item) => {
        errors.push({
          key: item.Key || "",
          message: item.Message || "Unknown error",
        });
      });
      return;
    }

    logger.error("Failed to delete S3 objects batch", {
      bucket,
      count: batch.length,
      error: result.reason,
    });

    batch.forEach((key) =>
      errors.push({ key, message: result.reason?.message || "Unknown error" })
    );
  });

  return { deleted, errors };
}

function convertToStudyType(type: string): StudyType | null {
  switch (type.toUpperCase()) {
    case "COGNITIVE_WALKTHROUGH":
      return StudyType.COGNITIVE_WALKTHROUGH;
    case "HEURISTIC_EVALUATION":
      return StudyType.HEURISTIC_EVALUATION;
    case "PERSONA":
      return StudyType.PERSONA;
    case "UNKNOWN":
      return StudyType.UNKNOWN;
    default:
      return null;
  }
}

async function getStudyManagementContext(studyId: string, userId: string) {
  const study = await prisma.study.findUnique({
    where: { id: studyId },
    select: {
      id: true,
      teamId: true,
      createdByUserId: true,
      team: { select: { companyId: true } },
    },
  });

  if (!study) {
    const error: any = new Error("Study not found");
    error.status = 404;
    throw error;
  }

  const isOwner = study.createdByUserId === userId;
  let isTeamAdmin = false;
  let isCompanyAdmin = false;

  if (study.teamId) {
    const membership = await prisma.teamMembership.findUnique({
      where: { teamId_userId: { teamId: study.teamId, userId } },
    });

    isTeamAdmin =
      !!membership &&
      membership.status === TeamMembershipStatus.ACTIVE &&
      [TeamRole.ADMIN, TeamRole.OWNER].includes(
        membership.role as "ADMIN" | "OWNER"
      );

    // If not team admin, check if company admin
    if (!isTeamAdmin && study.team?.companyId) {
      const companyMembership = await prisma.companyMembership.findFirst({
        where: {
          companyId: study.team.companyId,
          userId: userId,
          status: CompanyMembershipStatus.ACTIVE,
        },
      });
      const allowedCompanyRoles = [CompanyRole.OWNER, CompanyRole.ADMIN];
      isCompanyAdmin =
        !!companyMembership &&
        allowedCompanyRoles.includes(
          companyMembership.role as "OWNER" | "ADMIN"
        );
    }
  }

  return { study, isOwner, isTeamAdmin, isCompanyAdmin };
}

// V2-only: use the envelope directly

export async function dbDeleteStudy(studyId: string, userId: string) {
  try {
    const { isOwner, isTeamAdmin, isCompanyAdmin } =
      await getStudyManagementContext(studyId, userId);

    if (!isOwner && !isTeamAdmin && !isCompanyAdmin) {
      const error: any = new Error("User not authorized to delete study");
      error.status = 403;
      throw error;
    }

    // Check if this is a PERSONA study with related studies (heuristic evaluations or cognitive walkthroughs)
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
        const error: any = new Error(
          "Cannot delete persona with related studies. Please delete or reassign the related studies first."
        );
        error.status = 400;
        throw error;
      }
    }

    await prisma.study.delete({
      where: {
        id: studyId,
      },
    });
    logger.info("Successfully deleted study", { studyId, userId });
  } catch (error) {
    logger.error("Failed to delete study", { studyId, userId, error });
    throw error;
  }
}

export async function dbGetCWQuestion(version: number) {
  try {
    let questions = await prisma.cWQuestion.findMany({
      where: {
        version: version,
      },
      orderBy: {
        questionNumber: "asc",
      },
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

export async function dbGetFiles(studyId: string) {
  try {
    let files = await prisma.file.findMany({
      where: {
        studyId: studyId,
      },
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
 * Get heuristics for a specific family
 * @param familyKey - The key of the heuristic family (e.g., "NIELSEN", "TENETS", or custom key)
 * @param companyId - Optional company ID to check visibility settings
 */
export async function dbGetHeuristics(
  familyKey?: string,
  familyId?: string,
  companyId?: string | null
) {
  try {
    if (!familyKey && !familyId) {
      throw new Error("Either familyKey or familyId must be provided");
    }

    // Check if this family is hidden for the company (only if we have a key)
    if (companyId && familyKey) {
      const visibility = await prisma.companyHeuristicVisibility.findFirst({
        where: {
          companyId,
          heuristicFamily: { key: familyKey },
          isHidden: true,
        },
      });

      if (visibility) {
        logger.warn("Heuristic family is hidden for this company", {
          familyKey,
          companyId,
        });
        return [];
      }
    }

    // Get the family and its heuristics - by ID or by key
    const family = await prisma.heuristicFamily.findUnique({
      where: familyId ? { id: familyId } : { key: familyKey },
      include: {
        heuristics: {
          include: {
            examples: true,
          },
        },
      },
    });

    if (!family) {
      logger.error("Heuristic family not found", { familyKey, familyId });
      throw new Error(`Heuristic family not found: ${familyKey || familyId}`);
    }

    // Check if this is a custom family that doesn't belong to the company
    if (family.companyId && family.companyId !== companyId) {
      logger.warn("Access denied to custom heuristic family", {
        familyKey: familyKey || family.key,
        familyId: familyId || family.id,
        ownerId: family.companyId,
        requesterId: companyId,
      });
      return [];
    }

    logger.info("Successfully fetched heuristics", {
      familyKey: familyKey || family.key,
      familyId: familyId || family.id,
      companyId,
      heuristicCount: family.heuristics.length,
    });

    return family.heuristics;
  } catch (error) {
    logger.error("Failed to fetch heuristics", {
      familyKey,
      familyId,
      companyId,
      error,
    });
    throw error;
  }
}

/**
 * Get all available heuristic families for a company
 * Returns global families (not hidden) + company-specific families
 */
export async function dbGetHeuristicFamilies(companyId?: string | null) {
  try {
    let hiddenFamilyIds: string[] = [];

    // Get hidden families for this company
    if (companyId) {
      const hiddenVisibility = await prisma.companyHeuristicVisibility.findMany(
        {
          where: {
            companyId,
            isHidden: true,
          },
          select: {
            heuristicFamilyId: true,
          },
        }
      );
      hiddenFamilyIds = hiddenVisibility.map((v) => v.heuristicFamilyId);
    }

    // Get all global families (not hidden) and company-specific families
    const families = await prisma.heuristicFamily.findMany({
      where: {
        AND: [
          {
            OR: [
              { companyId: null }, // Global families
              { companyId }, // Company-specific families
            ],
          },
          {
            id: {
              notIn: hiddenFamilyIds, // Exclude hidden families
            },
          },
        ],
      },
      include: {
        heuristics: {
          include: {
            examples: true,
          },
          orderBy: {
            createdAt: "asc",
          },
        },
        _count: {
          select: {
            heuristics: true,
          },
        },
      },
      orderBy: [{ companyId: "asc" }, { name: "asc" }], // Global first, then company-specific
    });

    logger.info("Successfully fetched heuristic families", {
      companyId,
      familyCount: families.length,
      hiddenCount: hiddenFamilyIds.length,
    });

    return families;
  } catch (error) {
    logger.error("Failed to fetch heuristic families", { companyId, error });
    throw error;
  }
}

export async function dbGetHeuristicFamily(familyId: string) {
  try {
    const family = await prisma.heuristicFamily.findUnique({
      where: {
        id: familyId,
      },
      include: {
        heuristics: {
          include: {
            examples: true,
          },
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });

    if (!family) {
      logger.warn("Heuristic family not found", { familyId });
      return null;
    }

    logger.info("Successfully fetched heuristic family", {
      familyId,
      heuristicCount: family.heuristics.length,
    });

    return family;
  } catch (error) {
    logger.error("Failed to fetch heuristic family", { familyId, error });

    throw error;
  }
}

export async function dbGetHeuristic(
  heuristicId: string,
  userCompanyId?: string | null
) {
  try {
    const heuristic = await prisma.heuristic.findUnique({
      where: {
        id: heuristicId,
      },
      include: {
        family: {
          select: {
            id: true,
            companyId: true,
          },
        },
        examples: {
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });

    if (!heuristic) {
      logger.warn("Heuristic not found", { heuristicId });
      return null;
    }

    // Filter examples based on company access
    // Only show examples if:
    // 1. The heuristic belongs to the user's company AND
    // 2. The user has a company (userCompanyId is provided)
    const shouldShowExamples =
      userCompanyId &&
      heuristic.family.companyId &&
      heuristic.family.companyId === userCompanyId;

    const filteredHeuristic = {
      ...heuristic,
      examples: shouldShowExamples ? heuristic.examples : [],
    };

    logger.info("Successfully fetched heuristic", {
      heuristicId,
      totalExamples: heuristic.examples.length,
      filteredExamples: filteredHeuristic.examples.length,
      userCompanyId,
      heuristicCompanyId: heuristic.family.companyId,
    });

    return filteredHeuristic;
  } catch (error) {
    logger.error("Failed to fetch heuristic", { heuristicId, error });
    throw error;
  }
}

export async function dbGetStudy(studyId: string, userId: string) {
  try {
    let study = await prisma.study.findFirst({
      where: {
        id: studyId,
        OR: [
          { createdByUserId: userId },
          {
            team: {
              memberships: {
                some: {
                  userId,
                  status: TeamMembershipStatus.ACTIVE,
                },
              },
            },
          },
        ],
      },
      include: {
        files: true,
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
    const whereClause = teamId
      ? {
          teamId,
          team: {
            memberships: {
              some: {
                userId,
                status: TeamMembershipStatus.ACTIVE,
              },
            },
          },
        }
      : { createdByUserId: userId };

    const studies = await prisma.study.findMany({
      where: whereClause,
      orderBy: [
        {
          createdAt: "desc",
        },
      ],
      include: {
        files: true,
        createdByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        lastModifiedByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        persona: {
          select: {
            isLatest: true,
          },
        },
      },
    });

    // Filter out old persona versions - only show studies where:
    // 1. It's not a PERSONA study, OR
    // 2. It's a PERSONA study AND it's the latest version, OR
    // 3. It's a PERSONA study that's still being created (no persona record yet)
    const filteredStudies = studies.filter(
      (study) =>
        study.type !== "PERSONA" ||
        (study.persona && study.persona.isLatest) ||
        (!study.persona && study.status === "PENDING")
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

export async function dbGetUser(userId: string) {
  try {
    let user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
    });

    logger.info("Successfully fetched user", {
      userId,
      found: !!user,
    });
    return user;
  } catch (error) {
    logger.error("Failed to fetch user", { userId, error });
    throw error;
  }
}

export async function dbPostCognitiveWalkthrough(
  data: CognitiveWalkthroughData
) {
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

    // Create a cognitive walkthrough
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
                question: {
                  connect: { id: result.questionId },
                },
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

    // Update the study status to completed
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
    // Validate that heuristic family ID is provided
    if (!core.heuristic) {
      throw new Error("Heuristic family ID is required");
    }

    // Resolve selected personaId (optional) from personaStudyId
    let resolvedPersonaId: string | undefined;
    if (core.personaStudyId) {
      const persona = await prisma.persona.findUnique({
        where: { studyId: core.personaStudyId },
        select: { id: true },
      });
      resolvedPersonaId = persona?.id || undefined;
    }

    // Delete existing heuristic evaluation if any (for re-runs)
    await prisma.heuristicEvaluation.deleteMany({
      where: { studyId: core.studyId },
    });

    // Create a heuristic evaluation
    await prisma.heuristicEvaluation.create({
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
            file: {
              connect: { id: result.fileId },
            },
            heuristic: {
              connect: { id: result.id },
            },
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

    // Update the study status to completed
    await dbUpdateStudyStatus(core.studyId, StudyStatus.COMPLETED);

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

// New: Team credits API
export async function dbGetTeam(teamId: string) {
  try {
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: {
        memberships: {
          where: { status: "ACTIVE" },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
                status: true,
              },
            },
          },
        },
      },
    });
    logger.info("Successfully fetched team", { teamId, found: !!team });
    return team;
  } catch (error) {
    logger.error("Failed to fetch team", { teamId, error });
    throw error;
  }
}

export async function dbListUserTeams(userId: string) {
  try {
    const memberships = await prisma.teamMembership.findMany({
      where: { userId, status: "ACTIVE" },
      include: {
        team: {
          select: {
            id: true,
            name: true,
            isPersonal: true,
            companyId: true,
            credits: true,
            joinPolicy: true,
            isDefaultForCompany: true,
            company: {
              select: { id: true, name: true, disablePersonalTeams: true },
            },
          },
        },
      },
      orderBy: { joinedAt: "asc" },
    });

    const teams = memberships.map((membership) => ({
      id: membership.team.id,
      name: membership.team.name,
      isPersonal: membership.team.isPersonal,
      companyId: membership.team.companyId,
      companyName: membership.team.company?.name ?? null,
      companyPersonalTeamsDisabled:
        membership.team.company?.disablePersonalTeams ?? false,
      credits: membership.team.credits,
      joinPolicy: membership.team.joinPolicy,
      isDefaultForCompany: membership.team.isDefaultForCompany,
      role: membership.role,
    }));

    logger.info("Listed user teams", { userId, count: teams.length });
    return teams;
  } catch (error) {
    logger.error("Failed to list user teams", { userId, error });
    throw error;
  }
}

export async function dbUpdateUserSelectedTeam(params: {
  userId: string;
  teamId: string;
}) {
  const { userId, teamId } = params;
  try {
    const membership = await prisma.teamMembership.findUnique({
      where: { teamId_userId: { teamId, userId } },
      select: { id: true, status: true },
    });

    if (!membership || membership.status !== "ACTIVE") {
      logger.warn("Attempt to set selected team without active membership", {
        userId,
        teamId,
      });
      const err: any = new Error("User is not a member of the requested team");
      err.code = "NOT_MEMBER";
      throw err;
    }

    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: {
        isPersonal: true,
        company: { select: { disablePersonalTeams: true } },
      },
    });

    if (team?.isPersonal && team.company?.disablePersonalTeams) {
      const err: any = new Error(
        "Personal teams are disabled for your company"
      );
      err.code = "PERSONAL_TEAM_DISABLED";
      err.status = 403;
      throw err;
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { selectedTeamId: teamId },
      select: { id: true, selectedTeamId: true },
    });

    logger.info("Updated user selected team", { userId, teamId });
    return updatedUser;
  } catch (error) {
    if ((error as any)?.code === "NOT_MEMBER") {
      throw error;
    }
    logger.error("Failed to update user selected team", {
      userId,
      teamId,
      error,
    });
    throw error;
  }
}

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
    logger.info("Adjusted team credits", {
      teamId,
      delta,
      byUserId,
      studyId,
      reason,
      newCredits: (result as any).credits,
    });
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
    return await dbAdjustTeamCredits({
      teamId,
      delta: -1,
      byUserId,
      studyId,
      reason: "consume_study",
    });
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

// Company/domain services
/**
 * Get a company membership for a specific user
 */
export async function dbGetCompanyMembership(
  companyId: string,
  userId: string
) {
  try {
    const membership = await prisma.companyMembership.findFirst({
      where: {
        companyId,
        userId,
        status: CompanyMembershipStatus.ACTIVE,
      },
      select: {
        id: true,
        role: true,
        status: true,
        joinedAt: true,
      },
    });

    logger.info("Successfully fetched company membership", {
      companyId,
      userId,
      found: !!membership,
    });

    return membership;
  } catch (error) {
    logger.error("Failed to fetch company membership", {
      companyId,
      userId,
      error,
    });
    throw error;
  }
}

export async function dbGetCompanyByDomain(domain: string) {
  try {
    const companyDomain = await prisma.companyDomain.findUnique({
      where: { domain },
      select: {
        id: true,
        domain: true,
        companyId: true,
        status: true,
        requestedByUserId: true,
      },
    });
    if (!companyDomain) return null;
    const company = await prisma.company.findUnique({
      where: { id: companyDomain.companyId },
      select: {
        id: true,
        name: true,
        status: true,
        logoKey: true,
        logoUpdatedAt: true,
        autoEnroll: true,
        disablePersonalTeams: true,
      },
    });
    return {
      domain: companyDomain.domain,
      companyId: companyDomain.companyId,
      domainStatus: companyDomain.status,
      requestedByUserId: companyDomain.requestedByUserId,
      company: company
        ? {
            id: company.id,
            name: company.name,
            status: company.status,
            logoKey: company.logoKey ?? null,
            logoUpdatedAt: company.logoUpdatedAt ?? null,
            autoEnroll: company.autoEnroll,
            disablePersonalTeams: company.disablePersonalTeams,
          }
        : null,
    };
  } catch (error) {
    logger.error("Failed to get company by domain", { domain, error });
    throw error;
  }
}

export async function dbUpdateCompanyName(params: {
  companyId: string;
  userId: string;
  name: string;
}) {
  const { companyId, userId, name } = params;
  try {
    // Only OWNERs can update company name
    const membership = await prisma.companyMembership.findUnique({
      where: { companyId_userId: { companyId, userId } },
      select: {
        role: true,
        status: true,
        deactivatedAt: true,
        user: { select: { status: true } },
      },
    });
    if (
      !membership ||
      membership.status !== CompanyMembershipStatus.ACTIVE ||
      membership.deactivatedAt !== null ||
      membership.user?.status !== UserStatus.ACTIVE ||
      membership.role !== CompanyRole.OWNER
    ) {
      const err = new Error("Forbidden: Only owners can update company name");
      (err as any).status = 403;
      throw err;
    }
    const updated = await prisma.company.update({
      where: { id: companyId },
      data: { name: name.trim() },
      select: { id: true, name: true, updatedAt: true },
    });
    logger.info("Company name updated", { companyId, byUserId: userId });
    return updated;
  } catch (error) {
    logger.error("Failed to update company name", { companyId, userId, error });
    throw error;
  }
}

export async function dbUpdateCompanyLogo(params: {
  companyId: string;
  userId: string;
  logoKey: string | null;
}) {
  const { companyId, userId, logoKey } = params;
  try {
    // Only OWNERs can update company image
    const membership = await prisma.companyMembership.findUnique({
      where: { companyId_userId: { companyId, userId } },
      select: {
        role: true,
        status: true,
        deactivatedAt: true,
        user: { select: { status: true } },
      },
    });
    if (
      !membership ||
      membership.status !== CompanyMembershipStatus.ACTIVE ||
      membership.deactivatedAt !== null ||
      membership.user?.status !== UserStatus.ACTIVE ||
      membership.role !== CompanyRole.OWNER
    ) {
      const err = new Error("Forbidden: Only owners can update company image");
      (err as any).status = 403;
      throw err;
    }
    const updated = await prisma.company.update({
      where: { id: companyId },
      data: {
        ...(logoKey === null ? { logoKey: null } : { logoKey }),
        logoUpdatedAt: new Date(),
      },
      select: { id: true },
    });
    logger.info("Company logo updated", { companyId, byUserId: userId });
    return updated;
  } catch (error) {
    logger.error("Failed to update company logo", {
      companyId,
      userId,
      error,
    });
    throw error;
  }
}

export async function dbUpdateCompanyJoinSettings(params: {
  companyId: string;
  userId: string;
  autoEnroll: boolean;
}) {
  const { companyId, userId, autoEnroll } = params;
  try {
    const membership = await prisma.companyMembership.findUnique({
      where: { companyId_userId: { companyId, userId } },
      select: {
        role: true,
        status: true,
        deactivatedAt: true,
        user: { select: { status: true } },
      },
    });
    if (
      !membership ||
      membership.status !== CompanyMembershipStatus.ACTIVE ||
      membership.deactivatedAt !== null ||
      membership.user?.status !== UserStatus.ACTIVE ||
      membership.role !== CompanyRole.OWNER
    ) {
      const err = new Error("Forbidden: Only owners can update join settings");
      (err as any).status = 403;
      throw err;
    }
    const updated = await prisma.company.update({
      where: { id: companyId },
      data: { autoEnroll },
      select: { id: true, autoEnroll: true },
    });
    logger.info("Company join settings updated", {
      companyId,
      byUserId: userId,
      autoEnroll,
    });
    return updated;
  } catch (error) {
    logger.error("Failed to update company join settings", {
      companyId,
      userId,
      autoEnroll,
      error,
    });
    throw error;
  }
}

export async function dbUpdateCompanyPersonalTeams(params: {
  companyId: string;
  userId: string;
  disablePersonalTeams: boolean;
}) {
  const { companyId, userId, disablePersonalTeams } = params;
  try {
    const membership = await prisma.companyMembership.findUnique({
      where: { companyId_userId: { companyId, userId } },
      select: {
        role: true,
        status: true,
        deactivatedAt: true,
        user: { select: { status: true } },
      },
    });
    if (
      !membership ||
      membership.status !== CompanyMembershipStatus.ACTIVE ||
      membership.deactivatedAt !== null ||
      membership.user?.status !== UserStatus.ACTIVE ||
      membership.role !== CompanyRole.OWNER
    ) {
      const err = new Error(
        "Forbidden: Only owners can update personal team settings"
      );
      (err as any).status = 403;
      throw err;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const company = await tx.company.update({
        where: { id: companyId },
        data: { disablePersonalTeams },
        select: { id: true, disablePersonalTeams: true },
      });

      if (disablePersonalTeams) {
        const defaultTeam = await tx.team.findFirst({
          where: { companyId, isDefaultForCompany: true },
          select: { id: true },
        });

        if (defaultTeam) {
          const personalTeams = await tx.team.findMany({
            where: { companyId, isPersonal: true },
            select: { id: true },
          });

          if (personalTeams.length > 0) {
            await tx.user.updateMany({
              where: {
                selectedTeamId: { in: personalTeams.map((team) => team.id) },
                companyMemberships: {
                  some: {
                    companyId,
                    status: CompanyMembershipStatus.ACTIVE,
                  },
                },
              },
              data: { selectedTeamId: defaultTeam.id },
            });
          }
        }
      }

      return company;
    });

    logger.info("Company personal team settings updated", {
      companyId,
      byUserId: userId,
      disablePersonalTeams,
    });
    return updated;
  } catch (error) {
    logger.error("Failed to update company personal team settings", {
      companyId,
      userId,
      disablePersonalTeams,
      error,
    });
    throw error;
  }
}

export async function dbListDomainUsersNotMembers(params: {
  companyId: string;
  domain: string;
}) {
  const { companyId, domain } = params;
  try {
    const users = await prisma.user.findMany({
      where: {
        email: { endsWith: `@${domain}` },
        status: UserStatus.ACTIVE,
        companyMemberships: {
          none: {
            companyId,
            status: {
              in: [
                CompanyMembershipStatus.ACTIVE,
                CompanyMembershipStatus.DEACTIVATED,
              ],
            },
          },
        },
      },
      select: { id: true, name: true, email: true },
    });
    logger.info("Listed domain users not in company", {
      companyId,
      domain,
      count: users.length,
    });
    return users;
  } catch (error) {
    logger.error("Failed to list domain users", { companyId, domain, error });
    throw error;
  }
}

export async function dbEnrollUsersToCompany(params: {
  companyId: string;
  userIds: string[];
  invitedById?: string | null;
}) {
  const { companyId, userIds, invitedById } = params;
  try {
    // First ensure memberships exist (upsert) inside a transaction
    await prisma.$transaction(
      userIds.map((userId) =>
        prisma.companyMembership.upsert({
          where: { companyId_userId: { companyId, userId } },
          create: {
            companyId,
            userId,
            role: CompanyRole.MEMBER,
            invitedById: invitedById || null,
            status: CompanyMembershipStatus.ACTIVE,
            deactivatedAt: null,
          },
          update: {
            role: CompanyRole.MEMBER,
            status: CompanyMembershipStatus.ACTIVE,
            deactivatedAt: null,
          },
        })
      )
    );

    // After memberships are ensured, attempt to attach each user's personal team
    // and remove any remaining initial grant credits
    for (const userId of userIds) {
      try {
        await attachPersonalTeamIfSameDomain(companyId, userId);
      } catch (innerErr) {
        logger.warn("Failed to attach personal team post bulk enrollment", {
          companyId,
          userId,
          error: innerErr,
        });
      }

      try {
        await removeInitialGrantCredits(userId);
      } catch (innerErr) {
        logger.warn("Failed to remove initial grant credits on enrollment", {
          companyId,
          userId,
          error: innerErr,
        });
      }
    }

    await addUsersToAutoJoinTeams(prisma, companyId, userIds);
    logger.info("Enrolled users to company", {
      companyId,
      count: userIds.length,
    });
  } catch (error) {
    logger.error("Failed to enroll users to company", {
      companyId,
      userIds: userIds.length,
      error,
    });
    throw error;
  }
}

export async function dbDeleteCompany(params: {
  companyId: string;
  requestedById: string;
}) {
  const { companyId, requestedById } = params;

  try {
    const membership = await prisma.companyMembership.findUnique({
      where: { companyId_userId: { companyId, userId: requestedById } },
      select: {
        role: true,
        status: true,
        deactivatedAt: true,
        user: { select: { status: true } },
      },
    });

    if (!canDeleteCompany(membership)) {
      const err: any = new Error("Not authorized to delete company");
      err.status = 403;
      throw err;
    }

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      include: {
        teams: {
          include: {
            studies: {
              include: { files: true },
            },
          },
        },
        memberships: {
          select: {
            userId: true,
          },
        },
      },
    });

    if (!company) {
      const err: any = new Error("Company not found");
      err.status = 404;
      throw err;
    }

    const teamIds = company.teams.map((team) => team.id);
    const studyIds = company.teams.flatMap((team) =>
      team.studies.map((study) => study.id)
    );
    const fileKeys = company.teams.flatMap((team) =>
      team.studies.flatMap((study) =>
        study.files.map((file) => file.key).filter((key) => !!key)
      )
    );
    const userIds = company.memberships.map((membership) => membership.userId);

    const storageResult = await deleteS3Objects(fileKeys);

    if (storageResult.errors.length > 0) {
      logger.warn("Storage cleanup incomplete during company deletion", {
        companyId,
        requestedById,
        errorCount: storageResult.errors.length,
      });

      // TODO: Notify developer when storage cleanup fails (e.g., email or Slack alert)
    }

    const result = await prisma.$transaction(async (tx) => {
      const latestMembership = await tx.companyMembership.findUnique({
        where: { companyId_userId: { companyId, userId: requestedById } },
        select: {
          role: true,
          status: true,
          deactivatedAt: true,
          user: { select: { status: true } },
        },
      });

      if (!canDeleteCompany(latestMembership)) {
        const err: any = new Error("Not authorized to delete company");
        err.status = 403;
        throw err;
      }

      const existingCompany = await tx.company.findUnique({
        where: { id: companyId },
        select: { id: true },
      });

      if (!existingCompany) {
        const err: any = new Error("Company not found");
        err.status = 404;
        throw err;
      }

      if (teamIds.length > 0) {
        await tx.user.updateMany({
          where: { selectedTeamId: { in: teamIds } },
          data: { selectedTeamId: null },
        });

        if (studyIds.length > 0) {
          await tx.study.deleteMany({ where: { id: { in: studyIds } } });
        }

        await tx.team.deleteMany({ where: { id: { in: teamIds } } });
      }

      await tx.company.delete({ where: { id: companyId } });

      // Delete all company members since their personal teams are gone
      // This ensures data consistency - a user must always have a personal team
      if (userIds.length > 0) {
        await tx.user.deleteMany({ where: { id: { in: userIds } } });
      }

      return {
        deletedTeams: teamIds.length,
        deletedStudies: studyIds.length,
        deletedFiles: fileKeys.length,
        deletedUsers: userIds.length,
      } as const;
    });

    logger.info("Company and all member users deleted", {
      companyId,
      requestedById,
      deletedTeams: result.deletedTeams,
      deletedStudies: result.deletedStudies,
      deletedFiles: result.deletedFiles,
      deletedUsers: result.deletedUsers,
      deletedStorageObjects: storageResult.deleted.length,
      storageErrors: storageResult.errors.length,
    });

    return {
      ...result,
      deletedStorageObjects: storageResult.deleted.length,
      storageErrors: storageResult.errors,
    };
  } catch (error) {
    logger.error("Failed to delete company", {
      companyId,
      requestedById,
      error,
    });
    throw error;
  }
}

export async function dbDeleteUserAccount(params: {
  userId: string;
  requestedById: string;
}) {
  const { userId, requestedById } = params;

  try {
    if (userId !== requestedById) {
      const err: any = new Error("Not authorized to delete user");
      err.status = 403;
      throw err;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        companyMemberships: {
          where: { status: CompanyMembershipStatus.ACTIVE },
          select: { companyId: true },
        },
        teamsCreated: {
          where: { isPersonal: true },
          include: {
            studies: { include: { files: true } },
          },
        },
      },
    });

    if (!user) {
      const err: any = new Error("User not found");
      err.status = 404;
      throw err;
    }

    if (user.companyMemberships.length > 0) {
      const err: any = new Error(
        "Cannot delete account while you are part of a company."
      );
      err.status = 400;
      err.companies = user.companyMemberships.map((m) => m.companyId);
      throw err;
    }

    const teamIds = user.teamsCreated.map((team) => team.id);
    const studyIds = user.teamsCreated.flatMap((team) =>
      team.studies.map((study) => study.id)
    );
    const fileKeys = user.teamsCreated.flatMap((team) =>
      team.studies.flatMap((study) =>
        study.files.map((file) => file.key).filter((key) => !!key)
      )
    );

    const storageResult = await deleteS3Objects(fileKeys);

    if (storageResult.errors.length > 0) {
      logger.warn("Storage cleanup incomplete during user deletion", {
        userId,
        requestedById,
        errorCount: storageResult.errors.length,
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      await tx.teamMembership.deleteMany({ where: { userId } });

      if (studyIds.length > 0) {
        await tx.study.deleteMany({ where: { id: { in: studyIds } } });
      }

      if (teamIds.length > 0) {
        await tx.team.deleteMany({ where: { id: { in: teamIds } } });
      }

      await tx.communicationPreferences.deleteMany({ where: { userId } });
      await tx.companyInvite.deleteMany({ where: { invitedById: userId } });
      await tx.teamInvite.deleteMany({ where: { invitedById: userId } });
      await tx.account.deleteMany({ where: { userId } });
      await tx.session.deleteMany({ where: { userId } });

      await tx.user.delete({ where: { id: userId } });

      return {
        deletedTeams: teamIds.length,
        deletedStudies: studyIds.length,
        deletedFiles: fileKeys.length,
      } as const;
    });

    logger.info("User account deleted", {
      userId,
      requestedById,
      deletedTeams: result.deletedTeams,
      deletedStudies: result.deletedStudies,
      deletedFiles: result.deletedFiles,
      deletedStorageObjects: storageResult.deleted.length,
      storageErrors: storageResult.errors.length,
    });

    return {
      ...result,
      deletedStorageObjects: storageResult.deleted.length,
      storageErrors: storageResult.errors,
    };
  } catch (error) {
    logger.error("Failed to delete user account", {
      userId,
      requestedById,
      error,
    });
    throw error;
  }
}

export async function dbCreateCompanyForDomain(params: {
  domain: string;
  name: string;
  userId: string;
}) {
  const { domain, name, userId } = params;
  try {
    // If already exists, just return existing mapping
    const existing = await prisma.companyDomain.findUnique({
      where: { domain },
    });
    if (existing) {
      return { alreadyExisted: true, companyId: existing.companyId };
    }

    const created = await prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          name: name.trim(),
          createdByUserId: userId as string, // required relation
        },
      });
      await tx.companyDomain.create({
        data: {
          companyId: company.id,
          domain,
          requestedByUserId: userId as string, // required relation
        },
      });

      // Attach the user's personal team (if any) ONLY if their email domain matches the company domain
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { email: true },
      });
      const emailDomain = user?.email?.split("@")[1]?.toLowerCase();
      if (emailDomain && emailDomain === domain.toLowerCase()) {
        const personalTeam = await tx.team.findFirst({
          where: {
            isPersonal: true,
            companyId: null,
            memberships: { some: { userId } },
          },
          select: { id: true },
        });
        if (personalTeam) {
          await tx.team.update({
            where: { id: personalTeam.id },
            data: { companyId: company.id },
          });
        }
      }

      // Upsert OWNER membership for creator
      if (userId) {
        await tx.companyMembership.upsert({
          where: { companyId_userId: { companyId: company.id, userId } },
          create: {
            companyId: company.id,
            userId,
            role: CompanyRole.OWNER,
            status: CompanyMembershipStatus.ACTIVE,
            deactivatedAt: null,
          },
          update: {
            role: CompanyRole.OWNER,
            status: CompanyMembershipStatus.ACTIVE,
            deactivatedAt: null,
          },
        });
      }

      const defaultTeamName = `${company.name} Team`;
      const defaultTeam = await tx.team.create({
        data: {
          companyId: company.id,
          name: defaultTeamName,
          createdByUserId: userId,
          joinPolicy: TeamJoinPolicy.AUTO_JOIN,
          isDefaultForCompany: true,
        },
      });

      await tx.teamMembership.create({
        data: {
          teamId: defaultTeam.id,
          userId,
          role: TeamRole.OWNER,
          status: TeamMembershipStatus.ACTIVE,
        },
      });

      await addUsersToAutoJoinTeams(tx, company.id);

      await tx.user.updateMany({
        where: { id: userId },
        data: { selectedTeamId: defaultTeam.id },
      });

      return company;
    });

    return { alreadyExisted: false, companyId: created.id };
  } catch (error) {
    logger.error("Failed to create company for domain", {
      domain,
      userId,
      error,
    });
    throw error;
  }
}

export async function dbAddCompanyMembership(params: {
  companyId: string;
  userId: string;
  role: CompanyRole;
  invitedById?: string | null;
  canCreatePersonas?: boolean;
}) {
  const { companyId, userId, role, invitedById, canCreatePersonas } = params;
  try {
    const membership = await prisma.companyMembership.upsert({
      where: { companyId_userId: { companyId, userId } },
      create: {
        companyId,
        userId,
        role: role,
        invitedById: invitedById || null,
        status: CompanyMembershipStatus.ACTIVE,
        deactivatedAt: null,
        canCreatePersonas: canCreatePersonas ?? true,
      },
      update: {
        role: role,
        status: CompanyMembershipStatus.ACTIVE,
        deactivatedAt: null,
        ...(canCreatePersonas === undefined ? {} : { canCreatePersonas }),
      },
    });
    logger.info("Company membership upserted", { companyId, userId, role });
    // Attempt to attach personal team if domains match (best-effort)
    try {
      await attachPersonalTeamIfSameDomain(companyId, userId);
    } catch (innerErr) {
      logger.warn("Failed to attach personal team after membership upsert", {
        companyId,
        userId,
        error: innerErr,
      });
    }
    // Remove any remaining initial grant credits from personal team
    try {
      await removeInitialGrantCredits(userId);
    } catch (innerErr) {
      logger.warn(
        "Failed to remove initial grant credits on membership upsert",
        {
          companyId,
          userId,
          error: innerErr,
        }
      );
    }
    await addUsersToAutoJoinTeams(prisma, companyId, [userId]);
    return membership;
  } catch (error) {
    logger.error("Failed to upsert company membership", {
      companyId,
      userId,
      role,
      error,
    });
    throw error;
  }
}

export async function dbRemoveCompanyMember(params: {
  companyId: string;
  userId: string;
  requestedById: string;
}) {
  const { companyId, userId, requestedById } = params;
  try {
    const result = await prisma.$transaction(async (tx) => {
      const requester = await tx.companyMembership.findUnique({
        where: { companyId_userId: { companyId, userId: requestedById } },
        select: {
          role: true,
          status: true,
          deactivatedAt: true,
          user: { select: { status: true } },
        },
      });
      const allowedRoles: CompanyRole[] = [
        CompanyRole.OWNER,
        CompanyRole.ADMIN,
      ];
      if (
        !requester ||
        requester.status !== CompanyMembershipStatus.ACTIVE ||
        requester.deactivatedAt !== null ||
        requester.user?.status !== UserStatus.ACTIVE ||
        !allowedRoles.includes(requester.role as CompanyRole)
      ) {
        const err: any = new Error("Not authorized to deactivate members");
        err.status = 403;
        throw err;
      }

      const target = await tx.companyMembership.findUnique({
        where: { companyId_userId: { companyId, userId } },
        select: {
          role: true,
          status: true,
          deactivatedAt: true,
          user: { select: { status: true } },
        },
      });
      if (
        !target ||
        target.status !== CompanyMembershipStatus.ACTIVE ||
        target.deactivatedAt !== null ||
        target.user?.status !== UserStatus.ACTIVE
      ) {
        return { deactivated: false } as const;
      }

      if (
        target.role === CompanyRole.OWNER &&
        requester.role !== CompanyRole.OWNER
      ) {
        const err: any = new Error("Only owners can deactivate other owners");
        err.status = 403;
        throw err;
      }

      if (target.role === CompanyRole.OWNER) {
        const ownerCount = await tx.companyMembership.count({
          where: {
            companyId,
            role: CompanyRole.OWNER,
            status: CompanyMembershipStatus.ACTIVE,
            deactivatedAt: null,
            user: { status: UserStatus.ACTIVE },
          },
        });
        if (ownerCount <= 1) {
          const err: any = new Error("Cannot deactivate the last owner");
          err.status = 400;
          throw err;
        }
      }

      // Disassociate user's personal team from the company
      // The user retains their personal team and its studies
      const personalTeams = await tx.team.findMany({
        where: {
          isPersonal: true,
          companyId,
          memberships: { some: { userId } },
        },
        select: {
          id: true,
          name: true,
          _count: { select: { studies: true } },
        },
      });

      await tx.team.updateMany({
        where: {
          id: { in: personalTeams.map((t) => t.id) },
        },
        data: { companyId: null },
      });

      // Remove user from all company teams (non-personal only)
      // Personal team membership is preserved
      const companyTeams = await tx.teamMembership.findMany({
        where: {
          userId,
          team: {
            companyId,
            isPersonal: false,
          },
        },
        select: {
          team: {
            select: {
              id: true,
              name: true,
              _count: { select: { memberships: true, studies: true } },
            },
          },
        },
      });

      await tx.teamMembership.deleteMany({
        where: {
          userId,
          team: {
            companyId,
            isPersonal: false,
          },
        },
      });

      // Identify teams that will become orphaned (0 members remaining)
      const orphanedTeams = companyTeams.filter(
        (tm) => tm.team._count.memberships === 1 && tm.team._count.studies > 0
      );

      const updated = await tx.companyMembership.update({
        where: { companyId_userId: { companyId, userId } },
        data: {
          status: CompanyMembershipStatus.DEACTIVATED,
          deactivatedAt: new Date(),
        },
        select: { deactivatedAt: true },
      });

      return {
        deactivated: true,
        deactivatedAt: updated.deactivatedAt,
        personalTeamsDisassociated: personalTeams.map((t) => ({
          id: t.id,
          name: t.name,
          studyCount: t._count.studies,
        })),
        companyTeamsLeft: companyTeams.map((tm) => ({
          id: tm.team.id,
          name: tm.team.name,
        })),
        orphanedTeams: orphanedTeams.map((tm) => ({
          id: tm.team.id,
          name: tm.team.name,
          studyCount: tm.team._count.studies,
        })),
      } as const;
    });

    if (result.deactivated) {
      logger.info("Company member deactivated", {
        companyId,
        userId,
        requestedById,
        deactivatedAt: result.deactivatedAt,
        personalTeamsDisassociated: result.personalTeamsDisassociated,
        companyTeamsLeft: result.companyTeamsLeft,
      });

      if (result.orphanedTeams.length > 0) {
        logger.warn("Teams became orphaned after member deactivation", {
          companyId,
          userId,
          orphanedTeams: result.orphanedTeams,
        });
      }
    } else {
      logger.info(
        "Company member deactivation skipped; membership not active",
        {
          companyId,
          userId,
          requestedById,
        }
      );
    }

    return result;
  } catch (error) {
    logger.error("Failed to deactivate company member", {
      companyId,
      userId,
      requestedById,
      error,
    });
    throw error;
  }
}

export async function dbActivateCompanyMember(params: {
  companyId: string;
  userId: string;
  requestedById: string;
}) {
  const { companyId, userId, requestedById } = params;
  try {
    const result = await prisma.$transaction(async (tx) => {
      const requester = await tx.companyMembership.findUnique({
        where: { companyId_userId: { companyId, userId: requestedById } },
        select: {
          role: true,
          status: true,
          deactivatedAt: true,
          user: { select: { status: true } },
        },
      });
      const allowedRoles: CompanyRole[] = [
        CompanyRole.OWNER,
        CompanyRole.ADMIN,
      ];
      if (
        !requester ||
        requester.status !== CompanyMembershipStatus.ACTIVE ||
        requester.deactivatedAt !== null ||
        requester.user?.status !== UserStatus.ACTIVE ||
        !allowedRoles.includes(requester.role as CompanyRole)
      ) {
        const err: any = new Error("Not authorized to activate members");
        err.status = 403;
        throw err;
      }

      const target = await tx.companyMembership.findUnique({
        where: { companyId_userId: { companyId, userId } },
        select: {
          role: true,
          status: true,
          deactivatedAt: true,
          user: { select: { status: true } },
        },
      });
      if (!target) {
        const err: any = new Error("Company member not found");
        err.status = 404;
        throw err;
      }

      if (target.status === CompanyMembershipStatus.ACTIVE) {
        return { activated: false, reason: "already-active" } as const;
      }

      if (target.user?.status !== UserStatus.ACTIVE) {
        const err: any = new Error(
          "Cannot activate member with inactive user account"
        );
        err.status = 400;
        throw err;
      }

      const updated = await tx.companyMembership.update({
        where: { companyId_userId: { companyId, userId } },
        data: {
          status: CompanyMembershipStatus.ACTIVE,
          deactivatedAt: null,
        },
        select: { status: true, role: true },
      });

      // Add the reactivated user to any teams with AUTO_JOIN policy
      await addUsersToAutoJoinTeams(tx, companyId, [userId]);

      return {
        activated: true,
        status: updated.status,
        role: updated.role,
      } as const;
    });

    if (result.activated) {
      logger.info("Company member activated", {
        companyId,
        userId,
        requestedById,
      });
    } else {
      logger.info("Company member activation skipped; already active", {
        companyId,
        userId,
        requestedById,
      });
    }

    return result;
  } catch (error) {
    logger.error("Failed to activate company member", {
      companyId,
      userId,
      requestedById,
      error,
    });
    throw error;
  }
}

/**
 * Erase a user account (GDPR Right to be Forgotten)
 * Removes all PII while preserving studies and work attribution
 */
export async function dbEraseUser(params: {
  userId: string;
  requestedById: string;
  companyId: string;
  reason?: string;
}) {
  const { userId, requestedById, companyId, reason } = params;

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Verify requester has permission (company admin or owner)
      const requester = await tx.companyMembership.findUnique({
        where: { companyId_userId: { companyId, userId: requestedById } },
        select: {
          role: true,
          status: true,
          deactivatedAt: true,
          user: { select: { status: true } },
        },
      });
      const allowedRoles: CompanyRole[] = [
        CompanyRole.OWNER,
        CompanyRole.ADMIN,
      ];
      if (
        !requester ||
        requester.status !== CompanyMembershipStatus.ACTIVE ||
        requester.deactivatedAt !== null ||
        requester.user?.status !== UserStatus.ACTIVE ||
        !allowedRoles.includes(requester.role as CompanyRole)
      ) {
        const err: any = new Error("Not authorized to erase users");
        err.status = 403;
        throw err;
      }

      // 2. Verify user exists and isn't already erased
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { status: true, email: true, name: true },
      });

      if (!user) {
        const err: any = new Error("User not found");
        err.status = 404;
        throw err;
      }

      if (user.status === UserStatus.ERASED) {
        return { erased: false, reason: "already-erased" } as const;
      }

      // 3. Check for blocking conditions
      // Prevent erasure if user is the last owner of any company
      const companiesOwned = await tx.companyMembership.findMany({
        where: {
          userId,
          role: CompanyRole.OWNER,
          status: CompanyMembershipStatus.ACTIVE,
        },
        include: {
          company: {
            include: {
              memberships: {
                where: {
                  role: CompanyRole.OWNER,
                  status: CompanyMembershipStatus.ACTIVE,
                  userId: { not: userId },
                },
              },
            },
          },
        },
      });

      const companiesWhereLastOwner = companiesOwned.filter(
        (cm) => cm.company.memberships.length === 0
      );

      if (companiesWhereLastOwner.length > 0) {
        const err: any = new Error(
          "Cannot erase user: they are the sole owner of one or more companies. " +
            "Transfer ownership first."
        );
        err.status = 400;
        err.companies = companiesWhereLastOwner.map((cm) => ({
          id: cm.company.id,
          name: cm.company.name,
        }));
        throw err;
      }

      // 4. Generate anonymized email (must remain unique)
      const timestamp = Date.now();
      const anonymizedEmail = `erased-${userId}-${timestamp}@erased.local`;

      // 5. Delete all authentication data
      await tx.account.deleteMany({
        where: { userId },
      });

      await tx.session.deleteMany({
        where: { userId },
      });

      // 6. Delete personal data
      await tx.communicationPreferences.deleteMany({
        where: { userId },
      });

      // 7. Remove from all teams
      await tx.teamMembership.deleteMany({
        where: { userId },
      });

      // 8. Deactivate all company memberships
      await tx.companyMembership.updateMany({
        where: { userId },
        data: {
          status: CompanyMembershipStatus.ERASED,
          deactivatedAt: new Date(),
        },
      });

      // 9. Revoke/delete all invites they created
      await tx.companyInvite.updateMany({
        where: { invitedById: userId },
        data: { status: InviteStatus.REVOKED },
      });

      await tx.teamInvite.deleteMany({
        where: { invitedById: userId },
      });

      // 10. Delete personal teams (only if no studies)
      const personalTeams = await tx.team.findMany({
        where: {
          isPersonal: true,
          createdByUserId: userId,
        },
        select: {
          id: true,
          _count: { select: { studies: true } },
        },
      });

      const emptyPersonalTeams = personalTeams.filter(
        (t) => t._count.studies === 0
      );
      const personalTeamsWithStudies = personalTeams.filter(
        (t) => t._count.studies > 0
      );

      if (emptyPersonalTeams.length > 0) {
        await tx.team.deleteMany({
          where: { id: { in: emptyPersonalTeams.map((t) => t.id) } },
        });
      }

      // Personal teams with studies: disassociate but keep
      if (personalTeamsWithStudies.length > 0) {
        await tx.team.updateMany({
          where: { id: { in: personalTeamsWithStudies.map((t) => t.id) } },
          data: { companyId: null },
        });
      }

      // 11. Anonymize user record
      // Studies will keep createdByUserId reference
      // This preserves audit trail while removing PII
      await tx.user.update({
        where: { id: userId },
        data: {
          name: null,
          email: anonymizedEmail,
          emailVerified: null,
          image: null,
          imageKey: null,
          imageUpdatedAt: null,
          status: UserStatus.ERASED,
          selectedTeamId: null,
        },
      });

      return {
        erased: true,
        anonymizedEmail,
        personalTeamsDeleted: emptyPersonalTeams.length,
        personalTeamsRetained: personalTeamsWithStudies.length,
      } as const;
    });

    if (result.erased) {
      logger.info("User erased (GDPR)", {
        userId,
        requestedById,
        companyId,
        reason,
        anonymizedEmail: result.anonymizedEmail,
        personalTeamsDeleted: result.personalTeamsDeleted,
        personalTeamsRetained: result.personalTeamsRetained,
      });
    } else {
      logger.info("User erasure skipped", {
        userId,
        requestedById,
        companyId,
        reason: result.reason,
      });
    }

    return result;
  } catch (error) {
    logger.error("Failed to erase user", {
      userId,
      requestedById,
      companyId,
      reason,
      error,
    });
    throw error;
  }
}

export async function dbCreateCompanyInvite(params: {
  companyId: string;
  email: string;
  role: CompanyRole;
  token: string;
  invitedById: string;
}) {
  const { companyId, email, role, token, invitedById } = params;
  try {
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    const invite = await prisma.companyInvite.create({
      data: {
        companyId,
        email,
        role,
        token,
        expiresAt,
        invitedById,
      },
    });
    logger.info("Company invite created", { companyId, email, invitedById });
    return invite;
  } catch (error) {
    logger.error("Failed to create company invite", {
      companyId,
      email,
      error,
    });
    throw error;
  }
}

// Helper: Attach the user's existing unattached personal team to the company
// Only when the user's email domain matches a domain associated with the company.
async function removeInitialGrantCredits(userId: string) {
  // Find the user's personal team
  const personalTeam = await prisma.team.findFirst({
    where: {
      isPersonal: true,
      memberships: { some: { userId } },
    },
    include: {
      creditTransactions: {
        where: { reason: "initial_personal_team_grant" },
      },
    },
  });

  if (!personalTeam) return;

  // Calculate how much of the initial grant remains
  const initialGrant = personalTeam.creditTransactions.reduce(
    (sum: number, entry: { delta: number }) => sum + entry.delta,
    0
  );

  if (initialGrant <= 0 || personalTeam.credits <= 0) return;

  // Remove the remaining credits from the initial grant (up to current balance)
  const creditsToRemove = Math.min(initialGrant, personalTeam.credits);

  if (creditsToRemove > 0) {
    await prisma.$transaction(async (tx) => {
      await tx.team.update({
        where: { id: personalTeam.id },
        data: { credits: { decrement: creditsToRemove } },
      });

      await tx.creditLedger.create({
        data: {
          teamId: personalTeam.id,
          byUserId: userId,
          delta: -creditsToRemove,
          reason: "initial_grant_removed_on_company_enrollment",
        },
      });
    });

    logger.info("Removed initial grant credits on manual enrollment", {
      userId,
      teamId: personalTeam.id,
      creditsRemoved: creditsToRemove,
    });
  }
}

async function attachPersonalTeamIfSameDomain(
  companyId: string,
  userId: string
) {
  // Fetch user email & ensure domain match
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  const emailDomain = user?.email?.split("@")[1]?.toLowerCase();
  if (!emailDomain) return;

  const domainMatch = await prisma.companyDomain.findFirst({
    where: { companyId, domain: emailDomain },
    select: { id: true },
  });
  if (!domainMatch) return; // Different domain => do nothing (preserve isolation)

  // Find an unattached personal team owned by / containing only this user
  const personalTeam = await prisma.team.findFirst({
    where: {
      isPersonal: true,
      companyId: null,
      memberships: { some: { userId } },
    },
    select: { id: true },
  });
  if (!personalTeam) return;

  await prisma.team.update({
    where: { id: personalTeam.id },
    data: { companyId },
  });
  logger.info("Personal team attached to company", {
    companyId,
    userId,
    teamId: personalTeam.id,
  });
}

async function addUsersToAutoJoinTeams(
  db: typeof prisma | Prisma.TransactionClient,
  companyId: string,
  userIds?: string[]
) {
  const targetUserIds = userIds?.length
    ? Array.from(new Set(userIds))
    : (
        await db.companyMembership.findMany({
          where: {
            companyId,
            status: CompanyMembershipStatus.ACTIVE,
            deactivatedAt: null,
            user: { status: UserStatus.ACTIVE },
          },
          select: { userId: true },
        })
      ).map((m) => m.userId);

  if (!targetUserIds.length) return;

  const activeMembers = await db.companyMembership.findMany({
    where: {
      companyId,
      userId: { in: targetUserIds },
      status: CompanyMembershipStatus.ACTIVE,
      deactivatedAt: null,
      user: { status: UserStatus.ACTIVE },
    },
    select: { userId: true },
  });

  const activeUserIds = Array.from(new Set(activeMembers.map((m) => m.userId)));
  if (!activeUserIds.length) return;

  const autoJoinTeams = await db.team.findMany({
    where: {
      companyId,
      joinPolicy: TeamJoinPolicy.AUTO_JOIN,
      isPersonal: false,
    },
    select: { id: true, isDefaultForCompany: true },
  });

  if (!autoJoinTeams.length) return;

  await db.teamMembership.updateMany({
    where: {
      teamId: { in: autoJoinTeams.map((team) => team.id) },
      userId: { in: activeUserIds },
      status: TeamMembershipStatus.PENDING,
    },
    data: { status: TeamMembershipStatus.ACTIVE },
  });

  const memberships = autoJoinTeams.flatMap((team) =>
    activeUserIds.map((userId) => ({
      teamId: team.id,
      userId,
      role: TeamRole.MEMBER,
      status: TeamMembershipStatus.ACTIVE,
    }))
  );

  await db.teamMembership.createMany({
    data: memberships,
    skipDuplicates: true,
  });

  const defaultTeamId = autoJoinTeams.find(
    (team) => team.isDefaultForCompany
  )?.id;
  if (defaultTeamId) {
    await db.user.updateMany({
      where: {
        id: { in: activeUserIds },
      },
      data: { selectedTeamId: defaultTeamId },
    });
  }
  logger.info("Auto-joined company members to teams", {
    companyId,
    teamCount: autoJoinTeams.length,
    userCount: activeUserIds.length,
  });
}

export async function dbListCompanyMembers(companyId: string) {
  try {
    const members = await prisma.companyMembership.findMany({
      where: {
        companyId,
        status: CompanyMembershipStatus.ACTIVE,
        deactivatedAt: null,
        user: { status: UserStatus.ACTIVE },
      },
      include: {
        user: {
          include: {
            sessions: {
              select: { updatedAt: true },
              orderBy: { updatedAt: "desc" },
              take: 1,
            },
          },
        },
      },
      orderBy: { joinedAt: "asc" },
    });
    const formatted = members.map((m) => {
      const { sessions, ...user } = m.user as any;
      return {
        ...m,
        user: {
          ...user,
          lastAccessedAt: sessions?.[0]?.updatedAt ?? null,
        },
      };
    });
    logger.info("Listed company members", {
      companyId,
      count: formatted.length,
    });
    return formatted;
  } catch (error) {
    logger.error("Failed to list company members", { companyId, error });
    throw error;
  }
}

export async function dbCreateTeam(params: {
  companyId: string;
  userId: string;
  name: string;
  members?: { userId: string; role: TeamRole }[];
}) {
  const { companyId, userId, name, members = [] } = params;
  try {
    const trimmedName = name.trim();
    if (
      trimmedName.length < TEAM_NAME_MIN_LENGTH ||
      trimmedName.length > TEAM_NAME_MAX_LENGTH
    ) {
      const err: any = new Error(
        `Team name must be between ${TEAM_NAME_MIN_LENGTH} and ${TEAM_NAME_MAX_LENGTH} characters`
      );
      err.status = 400;
      throw err;
    }
    if (RESERVED_TEAM_NAMES.has(trimmedName.toLowerCase())) {
      const err: any = new Error("This team name is reserved");
      err.status = 400;
      throw err;
    }
    // Ensure user is company OWNER or ADMIN
    const membership = await prisma.companyMembership.findUnique({
      where: { companyId_userId: { companyId, userId } },
      select: {
        role: true,
        status: true,
        deactivatedAt: true,
        user: { select: { status: true } },
      },
    });
    const allowedRoles: CompanyRole[] = [CompanyRole.OWNER, CompanyRole.ADMIN];
    if (
      !membership ||
      membership.status !== CompanyMembershipStatus.ACTIVE ||
      membership.deactivatedAt !== null ||
      membership.user?.status !== UserStatus.ACTIVE ||
      !allowedRoles.includes(membership.role)
    ) {
      const err: any = new Error("Not authorized to create teams");
      err.status = 403;
      throw err;
    }
    // Ensure name uniqueness within company
    const existing = await prisma.team.findFirst({
      where: { companyId, name: { equals: trimmedName, mode: "insensitive" } },
      select: { id: true },
    });
    if (existing) {
      const err: any = new Error("A team with this name already exists");
      err.status = 400;
      throw err;
    }

    const created = await prisma.team.create({
      data: {
        companyId,
        name: trimmedName,
        createdByUserId: userId,
      },
    });

    // Validate and add optional members (including creator if provided)
    if (members.length) {
      const uniqueMembers = members.filter(
        (m, idx, arr) => arr.findIndex((x) => x.userId === m.userId) === idx
      );
      const memberIds = uniqueMembers.map((m) => m.userId);
      if (memberIds.length) {
        const validMemberships = await prisma.companyMembership.findMany({
          where: {
            companyId,
            userId: { in: memberIds },
            status: CompanyMembershipStatus.ACTIVE,
            deactivatedAt: null,
            user: { status: UserStatus.ACTIVE },
          },
          select: { userId: true },
        });
        const validSet = new Set(validMemberships.map((m) => m.userId));
        for (const m of uniqueMembers) {
          if (!validSet.has(m.userId)) {
            const err: any = new Error(
              `User ${m.userId} is not a member of this company`
            );
            err.status = 400;
            throw err;
          }
          try {
            await prisma.teamMembership.create({
              data: {
                teamId: created.id,
                userId: m.userId,
                role: m.role,
              },
            });
          } catch (innerErr) {
            logger.warn("Failed to add team member", {
              teamId: created.id,
              userId: m.userId,
              error: innerErr,
            });
          }
        }
      }
    }

    logger.info("Created team", {
      teamId: created.id,
      companyId,
      createdBy: userId,
    });
    return created;
  } catch (error) {
    logger.error("Failed to create team", { companyId, userId, error });
    throw error;
  }
}

export async function dbAddTeamMembers(params: {
  teamId: string;
  members: Array<{ userId: string; role: TeamRole }>;
  invitedById: string;
}) {
  const { teamId, members, invitedById } = params;
  try {
    if (!members.length) {
      return [];
    }

    const uniqueMembers = members.filter(
      (member, index, arr) =>
        member.userId &&
        arr.findIndex((other) => other.userId === member.userId) === index
    );

    return await prisma.$transaction(async (tx) => {
      const team = await tx.team.findUnique({
        where: { id: teamId },
        select: { id: true, companyId: true, isPersonal: true },
      });

      if (!team) {
        const err: any = new Error("Team not found");
        err.status = 404;
        throw err;
      }

      if (team.isPersonal) {
        const err: any = new Error("Cannot invite members to personal teams");
        err.status = 400;
        throw err;
      }

      if (!team.companyId) {
        const err: any = new Error("Team is not associated with a company");
        err.status = 400;
        throw err;
      }

      const inviterMembership = await tx.teamMembership.findUnique({
        where: { teamId_userId: { teamId, userId: invitedById } },
        select: { role: true },
      });

      const allowedTeamRoles: TeamRole[] = [TeamRole.OWNER, TeamRole.ADMIN];
      let isAuthorized =
        !!inviterMembership &&
        allowedTeamRoles.includes(inviterMembership.role as TeamRole);

      if (!isAuthorized) {
        const companyMembership = await tx.companyMembership.findUnique({
          where: {
            companyId_userId: {
              companyId: team.companyId,
              userId: invitedById,
            },
          },
          select: {
            role: true,
            status: true,
            deactivatedAt: true,
            user: { select: { status: true } },
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
          companyMembership.user?.status === UserStatus.ACTIVE &&
          allowedCompanyRoles.includes(companyMembership.role as CompanyRole);
      }

      if (!isAuthorized) {
        const err: any = new Error(
          "Not authorized to invite members to this team"
        );
        err.status = 403;
        throw err;
      }

      const allowedInviteRoles: TeamRole[] = [
        TeamRole.ADMIN,
        TeamRole.MEMBER,
        TeamRole.VIEWER,
      ];

      for (const member of uniqueMembers) {
        if (!allowedInviteRoles.includes(member.role)) {
          const err: any = new Error("Invalid team role for invite");
          err.status = 400;
          throw err;
        }
      }

      const memberIds = uniqueMembers.map((m) => m.userId);

      logger.info("Adding members to team - validation starting", {
        teamId,
        memberCount: memberIds.length,
        memberIds,
        companyId: team.companyId,
      });

      const existing = await tx.teamMembership.findMany({
        where: {
          teamId,
          userId: { in: memberIds },
          status: "ACTIVE",
        },
        select: { userId: true },
      });
      if (existing.length) {
        logger.warn("Some members already on team", {
          teamId,
          existingUserIds: existing.map((m) => m.userId),
        });
        const err: any = new Error("Some users are already on this team");
        err.status = 400;
        err.details = existing.map((m) => m.userId);
        throw err;
      }

      const validCompanyMembers = await tx.companyMembership.findMany({
        where: {
          companyId: team.companyId!,
          userId: { in: memberIds },
          status: CompanyMembershipStatus.ACTIVE,
          deactivatedAt: null,
          user: { status: UserStatus.ACTIVE },
        },
        select: { userId: true },
      });

      logger.info("Company membership validation results", {
        teamId,
        requestedCount: memberIds.length,
        validCount: validCompanyMembers.length,
        validUserIds: validCompanyMembers.map((m) => m.userId),
      });

      const validSet = new Set(validCompanyMembers.map((m) => m.userId));
      const invalid = uniqueMembers.filter((m) => !validSet.has(m.userId));
      if (invalid.length) {
        logger.error("Invalid members - not in company", {
          teamId,
          companyId: team.companyId,
          invalidUserIds: invalid.map((m) => m.userId),
        });
        const err: any = new Error(
          "All members must belong to the same company"
        );
        err.status = 400;
        err.details = invalid.map((m) => m.userId);
        throw err;
      }

      // Check for PENDING memberships (join requests) that can be upgraded
      const pendingMemberships = await tx.teamMembership.findMany({
        where: {
          teamId,
          userId: { in: memberIds },
          status: "PENDING",
        },
        select: { userId: true },
      });
      const pendingUserIds = new Set(pendingMemberships.map((m) => m.userId));

      const created = [] as Array<{ id: string; userId: string }>;
      for (const member of uniqueMembers) {
        // If user has a pending join request, upgrade it to ACTIVE with the specified role
        if (pendingUserIds.has(member.userId)) {
          const updatedMembership = await tx.teamMembership.update({
            where: { teamId_userId: { teamId, userId: member.userId } },
            data: {
              status: "ACTIVE",
              role: member.role,
            },
            select: { id: true, userId: true },
          });
          created.push(updatedMembership);
        } else {
          // Otherwise, create a new membership
          const createdMembership = await tx.teamMembership.create({
            data: {
              teamId,
              userId: member.userId,
              role: member.role,
            },
            select: { id: true, userId: true },
          });
          created.push(createdMembership);
        }
      }

      logger.info("Added members to team", {
        teamId,
        invitedById,
        added: created.length,
      });

      return created;
    });
  } catch (error) {
    logger.error("Failed to add members to team", {
      teamId,
      invitedById,
      error,
    });
    throw error;
  }
}

export async function dbRemoveTeamMember(params: {
  teamId: string;
  userId: string;
  requestedById: string;
}) {
  const { teamId, userId, requestedById } = params;

  try {
    return await prisma.$transaction(async (tx) => {
      const team = await tx.team.findUnique({
        where: { id: teamId },
        select: { id: true, companyId: true, isPersonal: true },
      });

      if (!team) {
        const err: any = new Error("Team not found");
        err.status = 404;
        throw err;
      }

      if (team.isPersonal) {
        const err: any = new Error("Cannot remove members from personal teams");
        err.status = 400;
        throw err;
      }

      const membership = await tx.teamMembership.findUnique({
        where: { teamId_userId: { teamId, userId } },
        select: { id: true },
      });

      if (!membership) {
        const err: any = new Error("User is not a member of this team");
        err.status = 404;
        throw err;
      }

      const requesterTeamMembership = await tx.teamMembership.findUnique({
        where: { teamId_userId: { teamId, userId: requestedById } },
        select: { role: true },
      });

      const allowedTeamRoles: TeamRole[] = [TeamRole.OWNER, TeamRole.ADMIN];
      let isAuthorized =
        !!requesterTeamMembership &&
        allowedTeamRoles.includes(requesterTeamMembership.role as TeamRole);

      if (!isAuthorized && team.companyId) {
        const companyMembership = await tx.companyMembership.findUnique({
          where: {
            companyId_userId: {
              companyId: team.companyId,
              userId: requestedById,
            },
          },
          select: {
            id: true,
            companyId: true,
            userId: true,
            role: true,
            canCreatePersonas: true,
            status: true,
            joinedAt: true,
            deactivatedAt: true,
            invitedById: true,
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

      if (!isAuthorized) {
        const err: any = new Error("Not authorized to remove team members");
        err.status = 403;
        throw err;
      }

      await tx.teamMembership.delete({
        where: { teamId_userId: { teamId, userId } },
      });

      logger.info("Removed member from team", {
        teamId,
        userId,
        requestedById,
      });

      return { success: true };
    });
  } catch (error) {
    logger.error("Failed to remove team member", {
      teamId,
      userId,
      requestedById,
      error,
    });
    throw error;
  }
}

export async function dbUpdateTeamName(params: {
  teamId: string;
  userId: string;
  name: string;
}) {
  const { teamId, userId, name } = params;
  try {
    const trimmedName = name.trim();
    if (
      trimmedName.length < TEAM_NAME_MIN_LENGTH ||
      trimmedName.length > TEAM_NAME_MAX_LENGTH
    ) {
      const err: any = new Error(
        `Team name must be between ${TEAM_NAME_MIN_LENGTH} and ${TEAM_NAME_MAX_LENGTH} characters`
      );
      err.status = 400;
      throw err;
    }

    if (RESERVED_TEAM_NAMES.has(trimmedName.toLowerCase())) {
      const err: any = new Error("This team name is reserved");
      err.status = 400;
      throw err;
    }

    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: {
        id: true,
        name: true,
        companyId: true,
        isPersonal: true,
        createdByUserId: true,
      },
    });

    if (!team) {
      const err: any = new Error("Team not found");
      err.status = 404;
      throw err;
    }

    const membership = await prisma.teamMembership.findUnique({
      where: { teamId_userId: { teamId, userId } },
      select: { role: true },
    });

    let isAuthorized = false;
    if (membership) {
      const allowedTeamRoles: TeamRole[] = [TeamRole.OWNER, TeamRole.ADMIN];
      if (allowedTeamRoles.includes(membership.role as TeamRole)) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized && team.createdByUserId === userId) {
      isAuthorized = true;
    }

    if (!isAuthorized && team.companyId) {
      const companyMembership = await prisma.companyMembership.findUnique({
        where: {
          companyId_userId: { companyId: team.companyId, userId },
        },
        select: {
          role: true,
          status: true,
          deactivatedAt: true,
          user: { select: { status: true } },
        },
      });
      const allowedCompanyRoles: CompanyRole[] = [
        CompanyRole.OWNER,
        CompanyRole.ADMIN,
      ];
      if (
        companyMembership &&
        companyMembership.status === CompanyMembershipStatus.ACTIVE &&
        companyMembership.deactivatedAt === null &&
        companyMembership.user?.status === UserStatus.ACTIVE &&
        allowedCompanyRoles.includes(companyMembership.role as CompanyRole)
      ) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      const err: any = new Error("Not authorized to rename this team");
      err.status = 403;
      throw err;
    }

    if (team.companyId) {
      const existing = await prisma.team.findFirst({
        where: {
          companyId: team.companyId,
          id: { not: teamId },
          name: { equals: trimmedName, mode: "insensitive" },
        },
        select: { id: true },
      });
      if (existing) {
        const err: any = new Error("A team with this name already exists");
        err.status = 400;
        throw err;
      }
    }

    if (team.name === trimmedName) {
      logger.info("Team name unchanged", { teamId, userId });
      return team;
    }

    const updated = await prisma.team.update({
      where: { id: teamId },
      data: { name: trimmedName },
      select: { id: true, name: true, companyId: true, isPersonal: true },
    });

    logger.info("Updated team name", { teamId, userId, name: trimmedName });
    return updated;
  } catch (error) {
    if ((error as any)?.status) {
      logger.warn("Failed to update team name", { teamId, userId, error });
    } else {
      logger.error("Failed to update team name", { teamId, userId, error });
    }
    throw error;
  }
}

export async function dbUpdateTeamJoinPolicy(params: {
  teamId: string;
  userId: string;
  joinPolicy: TeamJoinPolicy;
}) {
  const { teamId, userId, joinPolicy } = params;
  try {
    if (!Object.values(TeamJoinPolicy).includes(joinPolicy)) {
      const err: any = new Error("Invalid team join policy");
      err.status = 400;
      throw err;
    }

    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: {
        id: true,
        companyId: true,
        isPersonal: true,
        createdByUserId: true,
        joinPolicy: true,
        isDefaultForCompany: true,
      },
    });

    if (!team) {
      const err: any = new Error("Team not found");
      err.status = 404;
      throw err;
    }

    if (team.isPersonal) {
      const err: any = new Error(
        "Cannot change join settings for personal teams"
      );
      err.status = 400;
      throw err;
    }

    const membership = await prisma.teamMembership.findUnique({
      where: { teamId_userId: { teamId, userId } },
      select: { role: true },
    });

    let isAuthorized = false;
    if (membership) {
      const allowedTeamRoles: TeamRole[] = [TeamRole.OWNER, TeamRole.ADMIN];
      if (allowedTeamRoles.includes(membership.role as TeamRole)) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized && team.createdByUserId === userId) {
      isAuthorized = true;
    }

    if (!isAuthorized && team.companyId) {
      const companyMembership = await prisma.companyMembership.findUnique({
        where: {
          companyId_userId: { companyId: team.companyId, userId },
        },
        select: {
          role: true,
          status: true,
          deactivatedAt: true,
          user: { select: { status: true } },
        },
      });
      const allowedCompanyRoles: CompanyRole[] = [
        CompanyRole.OWNER,
        CompanyRole.ADMIN,
      ];
      if (
        companyMembership &&
        companyMembership.status === CompanyMembershipStatus.ACTIVE &&
        companyMembership.deactivatedAt === null &&
        companyMembership.user?.status === UserStatus.ACTIVE &&
        allowedCompanyRoles.includes(companyMembership.role as CompanyRole)
      ) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      const err: any = new Error("Not authorized to update team join settings");
      err.status = 403;
      throw err;
    }

    if (joinPolicy === TeamJoinPolicy.AUTO_JOIN && !team.companyId) {
      const err: any = new Error(
        "Auto-join policy requires the team to belong to a company"
      );
      err.status = 400;
      throw err;
    }

    if (team.isDefaultForCompany && team.joinPolicy !== joinPolicy) {
      const err: any = new Error(
        "Cannot change join policy for a company's default team"
      );
      err.status = 400;
      throw err;
    }

    if (team.joinPolicy === joinPolicy) {
      logger.info("Team join policy unchanged", { teamId, userId });
      return team;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const updatedTeam = await tx.team.update({
        where: { id: teamId },
        data: { joinPolicy },
        select: { id: true, joinPolicy: true, companyId: true },
      });

      if (joinPolicy === TeamJoinPolicy.AUTO_JOIN) {
        // Delete all pending team join requests when changing to AUTO_JOIN
        const deletedRequests = await tx.teamMembership.deleteMany({
          where: {
            teamId,
            status: "PENDING",
          },
        });

        if (deletedRequests.count > 0) {
          logger.info("Deleted pending team join requests for AUTO_JOIN team", {
            teamId,
            count: deletedRequests.count,
          });
        }

        if (updatedTeam.companyId) {
          await addUsersToAutoJoinTeams(tx, updatedTeam.companyId);
        }
      }

      return updatedTeam;
    });

    logger.info("Updated team join policy", { teamId, userId, joinPolicy });
    return updated;
  } catch (error) {
    if ((error as any)?.status) {
      logger.warn("Failed to update team join policy", {
        teamId,
        userId,
        error,
      });
    } else {
      logger.error("Failed to update team join policy", {
        teamId,
        userId,
        error,
      });
    }
    throw error;
  }
}

export async function dbUpdateTeamDescription(params: {
  teamId: string;
  userId: string;
  description: string | null;
}) {
  const { teamId, userId, description } = params;
  try {
    const trimmedDescription = description?.trim() || null;

    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: {
        id: true,
        description: true,
        companyId: true,
        isPersonal: true,
        createdByUserId: true,
      },
    });

    if (!team) {
      const err: any = new Error("Team not found");
      err.status = 404;
      throw err;
    }

    const membership = await prisma.teamMembership.findUnique({
      where: { teamId_userId: { teamId, userId } },
      select: { role: true },
    });

    let isAuthorized = false;
    if (membership) {
      const allowedTeamRoles: TeamRole[] = [TeamRole.OWNER, TeamRole.ADMIN];
      if (allowedTeamRoles.includes(membership.role as TeamRole)) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized && team.createdByUserId === userId) {
      isAuthorized = true;
    }

    if (!isAuthorized && team.companyId) {
      const companyMembership = await prisma.companyMembership.findUnique({
        where: {
          companyId_userId: { companyId: team.companyId, userId },
        },
        select: {
          role: true,
          status: true,
          deactivatedAt: true,
          user: { select: { status: true } },
        },
      });
      const allowedCompanyRoles: CompanyRole[] = [
        CompanyRole.OWNER,
        CompanyRole.ADMIN,
      ];
      if (
        companyMembership &&
        companyMembership.status === CompanyMembershipStatus.ACTIVE &&
        companyMembership.deactivatedAt === null &&
        companyMembership.user?.status === UserStatus.ACTIVE &&
        allowedCompanyRoles.includes(companyMembership.role as CompanyRole)
      ) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      const err: any = new Error(
        "Not authorized to update this team description"
      );
      err.status = 403;
      throw err;
    }

    if (team.description === trimmedDescription) {
      logger.info("Team description unchanged", { teamId, userId });
      return team;
    }

    const updated = await prisma.team.update({
      where: { id: teamId },
      data: { description: trimmedDescription },
      select: {
        id: true,
        description: true,
        companyId: true,
        isPersonal: true,
      },
    });

    logger.info("Updated team description", { teamId, userId });
    return updated;
  } catch (error) {
    if ((error as any)?.status) {
      logger.warn("Failed to update team description", {
        teamId,
        userId,
        error,
      });
    } else {
      logger.error("Failed to update team description", {
        teamId,
        userId,
        error,
      });
    }
    throw error;
  }
}

export async function dbListCompanyTeams(companyId: string) {
  try {
    // First, get the company's disablePersonalTeams setting
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { disablePersonalTeams: true },
    });

    const teams = await prisma.team.findMany({
      where: {
        companyId,
        // Filter out personal teams if disabled for the company
        ...(company?.disablePersonalTeams ? { isPersonal: false } : {}),
      },
      include: {
        _count: {
          select: {
            memberships: {
              where: { status: "ACTIVE" },
            },
          },
        },
        memberships: {
          include: {
            user: {
              include: {
                sessions: {
                  select: { updatedAt: true },
                  orderBy: { updatedAt: "desc" },
                  take: 1,
                },
              },
            },
          },
          orderBy: { joinedAt: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    logger.info("Listed company teams", {
      companyId,
      count: teams.length,
      disablePersonalTeams: company?.disablePersonalTeams,
    });
    return teams.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      isPersonal: t.isPersonal,
      isDefaultForCompany: t.isDefaultForCompany,
      joinPolicy: t.joinPolicy,
      credits: t.credits,
      createdAt: t.createdAt,
      memberCount: t._count.memberships,
      members: t.memberships.map((membership) => {
        const { sessions, ...user } = membership.user as any;
        return {
          id: membership.id,
          teamId: membership.teamId,
          userId: membership.userId,
          role: membership.role,
          status: membership.status,
          joinedAt: membership.joinedAt,
          user: {
            ...user,
            lastAccessedAt: sessions?.[0]?.updatedAt ?? null,
          },
        };
      }),
    }));
  } catch (error) {
    logger.error("Failed to list company teams", { companyId, error });
    throw error;
  }
}

export async function dbUpdateStudyAttempts(studyId: string) {
  try {
    await prisma.study.update({
      where: { id: studyId },
      data: {
        attempts: { increment: 1 },
      },
    });

    logger.info("Successfully updated study attempts", { studyId });
  } catch (error) {
    logger.error("Failed to update study attempts", { studyId, error });
    throw error;
  }
}

export async function dbUpdateStudyStatus(
  studyId: string,
  status: StudyStatus
) {
  try {
    await prisma.study.update({
      where: { id: studyId },
      data: { status: status },
    });

    logger.info("Successfully updated study status", { studyId, status });
  } catch (error) {
    logger.error("Failed to update study status", { studyId, status, error });
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
    // Check authorization if userId is provided
    if (userId) {
      const studyId = await getStudyIdFromCWIssue(id);
      if (studyId) {
        const { isOwner, isTeamAdmin, isCompanyAdmin } =
          await getStudyManagementContext(studyId, userId);
        if (!isOwner && !isTeamAdmin && !isCompanyAdmin) {
          const error: any = new Error("User not authorized to update issue");
          error.status = 403;
          throw error;
        }
      }
    }

    // Fetch the current issue to check its source
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
      updateData.rating = null; // Clear rating when human edits content
    }

    if (severity !== undefined) {
      updateData.severity = severity;
      // Update source to AI_HUMAN if it was AI generated
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
      where: {
        id: id,
      },
      data: updateData,
    });

    // Update parent study modification tracking
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

export async function dbUpdateCWRecommendation(
  id: string,
  recommendation?: string,
  rating?: ContentRating | null,
  userId?: string
) {
  try {
    // Check authorization if userId is provided
    if (userId) {
      const studyId = await getStudyIdFromCWRecommendation(id);
      if (studyId) {
        const { isOwner, isTeamAdmin, isCompanyAdmin } =
          await getStudyManagementContext(studyId, userId);
        if (!isOwner && !isTeamAdmin && !isCompanyAdmin) {
          const error: any = new Error(
            "User not authorized to update recommendation"
          );
          error.status = 403;
          throw error;
        }
      }
    }

    // Fetch the current recommendation to check its source
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
      updateData.rating = null; // Clear rating when human edits content
    }

    if (rating !== undefined && recommendation === undefined) {
      updateData.rating = rating;
    }

    if (userId) {
      updateData.lastModifiedByUserId = userId;
    }
    const result = await prisma.cWRecommendation.update({
      where: {
        id: id,
      },
      data: updateData,
    });

    // Update parent issue modification tracking
    if (userId && current) {
      await prisma.cWIssue.update({
        where: { id: current.issueId },
        data: {
          lastModifiedByUserId: userId,
          // updatedAt will auto-update due to @updatedAt in schema
        },
      });
    }

    // Update parent study modification tracking
    if (userId && current) {
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

export async function dbUpdateHEResult(
  id: string,
  reason?: string,
  severity?: number | null,
  rating?: ContentRating | null,
  userId?: string
) {
  try {
    // Check authorization if userId is provided
    if (userId) {
      const studyId = await getStudyIdFromHEResult(id);
      if (studyId) {
        const { isOwner, isTeamAdmin, isCompanyAdmin } =
          await getStudyManagementContext(studyId, userId);
        if (!isOwner && !isTeamAdmin && !isCompanyAdmin) {
          const error: any = new Error("User not authorized to update issue");
          error.status = 403;
          throw error;
        }
      }
    }

    // Fetch the current result to check its source
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
      updateData.rating = null; // Clear rating when human edits content
    }

    if (severity !== undefined) {
      updateData.severity = severity;
      // Update source to AI_HUMAN if it was AI generated
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
      where: {
        id: id,
      },
      data: updateData,
    });

    // Update parent study modification tracking
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

export async function dbUpdateHERecommendation(
  id: string,
  recommendation?: string,
  rating?: ContentRating | null,
  userId?: string
) {
  try {
    // Check authorization if userId is provided
    if (userId) {
      const studyId = await getStudyIdFromHERecommendation(id);
      if (studyId) {
        const { isOwner, isTeamAdmin, isCompanyAdmin } =
          await getStudyManagementContext(studyId, userId);
        if (!isOwner && !isTeamAdmin && !isCompanyAdmin) {
          const error: any = new Error(
            "User not authorized to update recommendation"
          );
          error.status = 403;
          throw error;
        }
      }
    }

    // Fetch the current recommendation to check its source
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
      updateData.rating = null; // Clear rating when human edits content
    }

    if (rating !== undefined && recommendation === undefined) {
      updateData.rating = rating;
    }

    if (userId) {
      updateData.lastModifiedByUserId = userId;
    }

    const result = await prisma.hERecommendation.update({
      where: {
        id: id,
      },
      data: updateData,
    });

    // Update parent result modification tracking
    if (userId && current) {
      await prisma.hEResult.update({
        where: { id: current.resultId },
        data: {
          lastModifiedByUserId: userId,
          // updatedAt will auto-update due to @updatedAt in schema
        },
      });
    }

    // Update parent study modification tracking
    if (userId && current) {
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

export async function dbDeleteCWIssue(id: string, userId?: string) {
  // Delete a cognitive walkthrough issue and its recommendations
  try {
    // Check authorization if userId is provided
    if (userId) {
      const studyId = await getStudyIdFromCWIssue(id);
      if (studyId) {
        const { isOwner, isTeamAdmin, isCompanyAdmin } =
          await getStudyManagementContext(studyId, userId);
        if (!isOwner && !isTeamAdmin && !isCompanyAdmin) {
          const error: any = new Error("User not authorized to delete issue");
          error.status = 403;
          throw error;
        }
      }
    }

    // Get stepId before deletion for study update
    const issue = await prisma.cWIssue.findUnique({
      where: { id },
      select: { stepId: true },
    });

    const result = await prisma.cWIssue.delete({
      where: {
        id: id,
      },
      include: {
        recommendations: true,
      },
    });

    // Update parent study modification tracking
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

export async function dbDeleteCWRecommendation(id: string, userId?: string) {
  try {
    // Check authorization if userId is provided
    if (userId) {
      const studyId = await getStudyIdFromCWRecommendation(id);
      if (studyId) {
        const { isOwner, isTeamAdmin, isCompanyAdmin } =
          await getStudyManagementContext(studyId, userId);
        if (!isOwner && !isTeamAdmin && !isCompanyAdmin) {
          const error: any = new Error(
            "User not authorized to delete recommendation"
          );
          error.status = 403;
          throw error;
        }
      }
    }

    // Get issueId before deletion for study update
    const recommendation = await prisma.cWRecommendation.findUnique({
      where: { id },
      select: { issueId: true },
    });

    const result = await prisma.cWRecommendation.delete({
      where: {
        id: id,
      },
    });

    // Update parent issue modification tracking
    if (userId && recommendation) {
      await prisma.cWIssue.update({
        where: { id: recommendation.issueId },
        data: {
          lastModifiedByUserId: userId,
          // updatedAt will auto-update due to @updatedAt in schema
        },
      });
    }

    // Update parent study modification tracking
    if (userId && recommendation) {
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

export async function dbDeleteHEResult(id: string, userId?: string) {
  try {
    // Check authorization if userId is provided
    if (userId) {
      const studyId = await getStudyIdFromHEResult(id);
      if (studyId) {
        const { isOwner, isTeamAdmin, isCompanyAdmin } =
          await getStudyManagementContext(studyId, userId);
        if (!isOwner && !isTeamAdmin && !isCompanyAdmin) {
          const error: any = new Error("User not authorized to delete issue");
          error.status = 403;
          throw error;
        }
      }
    }

    // Get heuristicEvaluationId before deletion for study update
    const heResult = await prisma.hEResult.findUnique({
      where: { id },
      select: { heuristicEvaluationId: true },
    });

    const result = await prisma.hEResult.delete({
      where: {
        id: id,
      },
      include: {
        recommendations: true,
      },
    });

    // Update parent study modification tracking
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

export async function dbDeleteHERecommendation(id: string, userId?: string) {
  try {
    // Check authorization if userId is provided
    if (userId) {
      const studyId = await getStudyIdFromHERecommendation(id);
      if (studyId) {
        const { isOwner, isTeamAdmin, isCompanyAdmin } =
          await getStudyManagementContext(studyId, userId);
        if (!isOwner && !isTeamAdmin && !isCompanyAdmin) {
          const error: any = new Error(
            "User not authorized to delete recommendation"
          );
          error.status = 403;
          throw error;
        }
      }
    }

    // Get resultId before deletion for study update
    const recommendation = await prisma.hERecommendation.findUnique({
      where: { id },
      select: { resultId: true },
    });

    const result = await prisma.hERecommendation.delete({
      where: {
        id: id,
      },
    });

    // Update parent result modification tracking
    if (userId && recommendation) {
      await prisma.hEResult.update({
        where: { id: recommendation.resultId },
        data: {
          lastModifiedByUserId: userId,
          // updatedAt will auto-update due to @updatedAt in schema
        },
      });
    }

    // Update parent study modification tracking
    if (userId && recommendation) {
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

export async function dbCreateCWRecommendation(
  issueId: string,
  recommendation: string,
  source: SourceType,
  userId?: string
) {
  try {
    // Check authorization if userId is provided
    if (userId) {
      const studyId = await getStudyIdFromCWIssue(issueId);
      if (studyId) {
        const { isOwner, isTeamAdmin, isCompanyAdmin } =
          await getStudyManagementContext(studyId, userId);
        if (!isOwner && !isTeamAdmin && !isCompanyAdmin) {
          const error: any = new Error(
            "User not authorized to add recommendation"
          );
          error.status = 403;
          throw error;
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

    // Update parent issue modification tracking
    if (userId) {
      await prisma.cWIssue.update({
        where: { id: issueId },
        data: {
          lastModifiedByUserId: userId,
          // updatedAt will auto-update due to @updatedAt in schema
        },
      });
    }

    // Update parent study modification tracking
    if (userId) {
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

export async function dbCreateHERecommendation(
  resultId: string,
  recommendation: string,
  source: SourceType,
  userId?: string
) {
  try {
    // Check authorization if userId is provided
    if (userId) {
      const studyId = await getStudyIdFromHEResult(resultId);
      if (studyId) {
        const { isOwner, isTeamAdmin, isCompanyAdmin } =
          await getStudyManagementContext(studyId, userId);
        if (!isOwner && !isTeamAdmin && !isCompanyAdmin) {
          const error: any = new Error(
            "User not authorized to add recommendation"
          );
          error.status = 403;
          throw error;
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

    // Update parent result modification tracking
    if (userId) {
      await prisma.hEResult.update({
        where: { id: resultId },
        data: {
          lastModifiedByUserId: userId,
          // updatedAt will auto-update due to @updatedAt in schema
        },
      });
    }

    // Update parent study modification tracking
    if (userId) {
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

export async function dbCreateHEResult({
  heuristicEvaluationId,
  heuristicId,
  step,
  fileId,
  reason,
  severity,
  source,
  userId,
}: {
  heuristicEvaluationId: string;
  heuristicId: string;
  step: number;
  fileId: string;
  reason: string;
  severity: number;
  source: string;
  userId?: string;
}) {
  try {
    // Check authorization if userId is provided
    if (userId) {
      const studyId = await getStudyIdFromHEEvaluation(heuristicEvaluationId);
      if (studyId) {
        const { isOwner, isTeamAdmin, isCompanyAdmin } =
          await getStudyManagementContext(studyId, userId);
        if (!isOwner && !isTeamAdmin && !isCompanyAdmin) {
          const error: any = new Error("User not authorized to add issue");
          error.status = 403;
          throw error;
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

    // Update parent study modification tracking
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
    console.error(error);
    logger.error("Failed to create HE result", {
      heuristicEvaluationId,
      error,
    });
    throw error;
  }
}

export async function dbCreateCWIssue({
  stepId,
  issueType,
  issue,
  source,
  userId,
}: {
  stepId: string;
  issueType: string;
  issue: string;
  source: string;
  userId?: string;
}) {
  try {
    // Check authorization if userId is provided
    if (userId) {
      const studyId = await getStudyIdFromCWStep(stepId);
      if (studyId) {
        const { isOwner, isTeamAdmin, isCompanyAdmin } =
          await getStudyManagementContext(studyId, userId);
        if (!isOwner && !isTeamAdmin && !isCompanyAdmin) {
          const error: any = new Error("User not authorized to add issue");
          error.status = 403;
          throw error;
        }
      }
    }

    const createData: any = {
      step: { connect: { id: stepId } },
      issueType: issueType as CWIssueType,
      issue,
      severity: 0, // Default severity to "None" (0 = not a problem)
      source: source === "HUMAN" ? SourceType.HUMAN : SourceType.AI_HUMAN,
    };

    if (userId) {
      createData.createdByUser = { connect: { id: userId } };
      createData.lastModifiedByUser = { connect: { id: userId } };
    }

    const result = await prisma.cWIssue.create({
      data: createData,
      include: {
        recommendations: true,
      },
    });

    // Update parent study modification tracking
    if (userId) {
      const studyId = await getStudyIdFromCWStep(stepId);
      if (studyId) {
        await updateStudyModification(studyId, userId);
      }
    }

    logger.info("Successfully created CW issue", {
      stepId,
      issueId: result.id,
    });
    return result;
  } catch (error) {
    logger.error("Failed to create CW issue", { stepId, error });
    throw error;
  }
}

export async function dbGetCognitiveWalkthrough(
  studyId: string,
  userId: string
) {
  try {
    let cognitiveWalkthrough = await prisma.study.findFirst({
      where: {
        id: studyId,
        OR: [
          { createdByUserId: userId },
          {
            team: {
              memberships: {
                some: {
                  userId,
                  status: TeamMembershipStatus.ACTIVE,
                },
              },
            },
          },
        ],
      },
      include: {
        files: true,
        createdByUser: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            status: true,
          },
        },
        lastModifiedByUser: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            status: true,
          },
        },
        cognitiveWalkthrough: {
          include: {
            persona: true,
            steps: {
              include: {
                issues: {
                  include: {
                    recommendations: true,
                  },
                },
                results: {
                  include: {
                    question: true,
                  },
                  orderBy: {
                    question: {
                      questionNumber: "asc", // Order by questionNumber in the CWQuestion model
                    },
                  },
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
    logger.error("Failed to fetch cognitive walkthrough", {
      studyId,
      userId,
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
    let heuristicEvaluation = await prisma.study.findFirst({
      where: {
        id: studyId,
        OR: [
          { createdByUserId: userId },
          {
            team: {
              memberships: {
                some: {
                  userId,
                  status: TeamMembershipStatus.ACTIVE,
                },
              },
            },
          },
        ],
      },
      include: {
        files: true,
        createdByUser: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            status: true,
          },
        },
        lastModifiedByUser: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            status: true,
          },
        },
        heuristicEvaluation: {
          include: {
            persona: true,
            heuristicFamily: {
              include: {
                heuristics: true,
              },
            },
            results: {
              include: {
                heuristic: true,
                recommendations: true,
              },
              orderBy: [
                { step: "asc" },
                {
                  heuristic: {
                    heuristic: "asc", // Order alphabetically (ascending)
                  },
                },
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

export async function dbGetPersona(studyId: string, userId: string) {
  try {
    const personaStudy = await prisma.study.findFirst({
      where: {
        id: studyId,
        OR: [
          { createdByUserId: userId },
          {
            team: {
              memberships: {
                some: {
                  userId,
                  status: TeamMembershipStatus.ACTIVE,
                },
              },
            },
          },
        ],
      },
      include: {
        files: true,
        createdByUser: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            status: true,
          },
        },
        lastModifiedByUser: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
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

    // If this persona has a personaGroupId, fetch all studies that use ANY version in this group
    const personaGroupId = personaStudy.persona.personaGroupId;
    if (personaGroupId) {
      // Get all persona IDs in this group
      const personaVersions = await prisma.persona.findMany({
        where: { personaGroupId },
        select: { id: true },
      });
      const personaIds = personaVersions.map((p) => p.id);

      // Fetch heuristic evaluations that use any version of this persona
      const heuristicEvaluations = await prisma.heuristicEvaluation.findMany({
        where: {
          personaId: { in: personaIds },
          study: {
            OR: [
              { createdByUserId: userId },
              {
                team: {
                  memberships: {
                    some: {
                      userId,
                      status: TeamMembershipStatus.ACTIVE,
                    },
                  },
                },
              },
            ],
          },
        },
        include: {
          persona: {
            select: {
              id: true,
              version: true,
              personaGroupId: true,
              name: true,
            },
          },
          study: {
            include: {
              files: true,
            },
          },
        },
      });

      // Fetch cognitive walkthroughs that use any version of this persona
      const cognitiveWalkthroughs = await prisma.cognitiveWalkthrough.findMany({
        where: {
          personaId: { in: personaIds },
          study: {
            OR: [
              { createdByUserId: userId },
              {
                team: {
                  memberships: {
                    some: {
                      userId,
                      status: TeamMembershipStatus.ACTIVE,
                    },
                  },
                },
              },
            ],
          },
        },
        include: {
          persona: {
            select: {
              id: true,
              version: true,
              personaGroupId: true,
              name: true,
            },
          },
          study: {
            include: {
              files: true,
            },
          },
        },
      });

      // Attach the related studies to the persona
      (personaStudy.persona as any).heuristicEvaluations = heuristicEvaluations;
      (personaStudy.persona as any).cognitiveWalkthroughs =
        cognitiveWalkthroughs;
    } else {
      // Fallback for personas without personaGroupId (old data or incomplete migration)
      const heuristicEvaluations = await prisma.heuristicEvaluation.findMany({
        where: {
          personaId: personaStudy.persona.id,
          study: {
            OR: [
              { createdByUserId: userId },
              {
                team: {
                  memberships: {
                    some: {
                      userId,
                      status: TeamMembershipStatus.ACTIVE,
                    },
                  },
                },
              },
            ],
          },
        },
        include: {
          persona: {
            select: {
              id: true,
              version: true,
              personaGroupId: true,
              name: true,
            },
          },
          study: {
            include: {
              files: true,
            },
          },
        },
      });

      const cognitiveWalkthroughs = await prisma.cognitiveWalkthrough.findMany({
        where: {
          personaId: personaStudy.persona.id,
          study: {
            OR: [
              { createdByUserId: userId },
              {
                team: {
                  memberships: {
                    some: {
                      userId,
                      status: TeamMembershipStatus.ACTIVE,
                    },
                  },
                },
              },
            ],
          },
        },
        include: {
          persona: {
            select: {
              id: true,
              version: true,
              personaGroupId: true,
              name: true,
            },
          },
          study: {
            include: {
              files: true,
            },
          },
        },
      });

      (personaStudy.persona as any).heuristicEvaluations = heuristicEvaluations;
      (personaStudy.persona as any).cognitiveWalkthroughs =
        cognitiveWalkthroughs;
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

export async function dbListPersonas(userId: string, teamId: string) {
  try {
    const membership = await prisma.teamMembership.findUnique({
      where: { teamId_userId: { teamId, userId } },
      select: { id: true },
    });

    if (!membership) {
      logger.warn(
        "User attempted to list personas for team without membership",
        {
          userId,
          teamId,
        }
      );
      return [];
    }

    const studies = await prisma.study.findMany({
      where: {
        teamId,
        type: StudyType.PERSONA,
        team: {
          memberships: {
            some: {
              userId,
              status: TeamMembershipStatus.ACTIVE,
            },
          },
        },
        // Only show latest versions
        persona: {
          isLatest: true,
        },
      },
      orderBy: { createdAt: "desc" },
      include: {
        files: true,
        persona: {
          include: {
            photoFile: true,
            coverFile: true,
          },
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

export async function dbGetPersonaVersions(
  personaGroupId: string,
  userId: string
) {
  try {
    // Get all versions of this persona group that the user has access to
    const versions = await prisma.persona.findMany({
      where: {
        personaGroupId,
        study: {
          OR: [
            { createdByUserId: userId },
            {
              team: {
                memberships: {
                  some: {
                    userId,
                    status: TeamMembershipStatus.ACTIVE,
                  },
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
            createdByUser: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
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

export async function dbUpdateStudyName(
  studyId: string,
  name: string,
  userId?: string
) {
  try {
    if (userId) {
      const { isOwner, isTeamAdmin, isCompanyAdmin } =
        await getStudyManagementContext(studyId, userId);

      if (!isOwner && !isTeamAdmin && !isCompanyAdmin) {
        const error: any = new Error("User not authorized to update study");
        error.status = 403;
        throw error;
      }
    }

    const updatedStudy = await prisma.study.update({
      where: { id: studyId },
      data: {
        name: name,
        lastModifiedByUserId: userId,
      },
    });
    logger.info("Successfully updated study name", {
      studyId,
      name,
      userId,
    });
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
    logger.warn("Attempt to assign study to team without membership", {
      studyId,
      teamId,
      userId,
    });
    const err: any = new Error("User is not a member of the requested team");
    err.code = "NOT_MEMBER";
    throw err;
  }

  const study = await prisma.study.findUnique({
    where: { id: studyId },
    select: { id: true, teamId: true },
  });

  if (!study) {
    logger.warn("Attempt to update team for missing study", {
      studyId,
      teamId,
      userId,
    });
    const err: any = new Error("Study not found");
    err.code = "NOT_FOUND";
    throw err;
  }

  if (study.teamId === teamId) {
    logger.info("Study already assigned to requested team", {
      studyId,
      teamId,
      userId,
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

export async function dbUpdateUserName(userId: string, name: string) {
  try {
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { name },
    });

    logger.info("Successfully updated user name", { userId, name });
    return updatedUser;
  } catch (error) {
    logger.error("Failed to update user name", { userId, name, error });
    throw error;
  }
}

export async function dbUpdateUserImage(
  userId: string,
  imageKey: string | null
) {
  try {
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        imageKey: imageKey || null,
        imageUpdatedAt: new Date(),
      },
    });
    logger.info("Successfully updated user image", { userId, imageKey });
    return updatedUser;
  } catch (error) {
    logger.error("Failed to update user image", { userId, imageKey, error });
    throw error;
  }
}

export async function dbInitStudy(data: {
  userId: string;
  teamId: string;
  name: string;
  type: string;
}) {
  try {
    const study = await prisma.study.create({
      data: {
        createdByUserId: data.userId,
        teamId: data.teamId,
        name: data.name,
        type: (() => {
          const studyType = convertToStudyType(data.type);
          if (!studyType) throw new Error(`Invalid study type: ${data.type}`);
          return studyType;
        })(),
        jobData: { init: true },
      },
    });
    logger.info("Successfully initialized study (no files)", {
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
  files: Array<{
    name: string;
    key: string;
    size: number;
    type: string;
    // Optional Figma metadata fields
    figmaFileKey?: string;
    figmaNodeId?: string;
    figmaFrameName?: string;
    figmaUrl?: string;
  }>;
  jobData: V2JobData;
}) {
  try {
    const existing = await prisma.study.findUnique({
      where: { id: data.studyId },
      select: { id: true, jobData: true },
    });
    if (!existing) throw new Error("Study not found");

    const updated = await prisma.study.update({
      where: { id: data.studyId },
      data: {
        files: {
          create: data.files.map((f) => ({
            bucket: process.env.AWS_BUCKET || "",
            key: f.key,
            originalName: f.name,
            size: f.size,
            fileType: convertToFileType(f.type),
            imageType: convertToImageType(f.type),
            // Include Figma metadata if available
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
    logger.info("Successfully finalized study (files attached)", {
      studyId: updated.id,
      fileCount: updated.files?.length ?? 0,
    });
    return updated;
  } catch (error) {
    logger.error("Failed to finalize study", { studyId: data.studyId, error });
    throw error;
  }
}

export async function dbPostPersona(data: {
  studyData: JobEnvelopeV2_PE;
  persona: {
    name?: string | null;
    description?: string | null;
    photoKey?: string | null;
    coverKey?: string | null;
    payload?: any; // arbitrary structured persona data
  };
}) {
  const { studyData, persona } = data;
  const studyId = studyData.studyId;

  try {
    let photoFileId: string | undefined;
    let coverFileId: string | undefined;

    // Optionally find or create File records for generated images within this study
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
            bucket: process.env.AWS_BUCKET || "",
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
            bucket: process.env.AWS_BUCKET || "",
            key: persona.coverKey,
            size: null,
            fileType: FileType.IMAGE,
            imageType: guessImageTypeFromKey(persona.coverKey),
          },
        });
        coverFileId = file.id;
      }
    }

    // Upsert Persona record by studyId
    await prisma.persona.upsert({
      where: { studyId },
      create: {
        studyId,
        personaGroupId: studyId, // For new personas, use studyId as the group identifier
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

    // If persona has a name, update the study name to match the persona
    if (
      persona.name &&
      typeof persona.name === "string" &&
      persona.name.trim().length > 0
    ) {
      await dbUpdateStudyName(studyId, persona.name);
    }

    // Mark study completed
    await dbUpdateStudyStatus(studyId, StudyStatus.COMPLETED);

    logger.info("Successfully added persona to database", { studyId });
  } catch (error) {
    logger.error("Failed to add persona to database", { studyId, error });
    throw error;
  }
}

export async function dbUpdatePersona(
  studyId: string,
  userId: string,
  data: any
) {
  try {
    // Verify user has access to this study
    const studyWithPersona = await prisma.study.findFirst({
      where: {
        id: studyId,
        OR: [
          { createdByUserId: userId },
          {
            team: {
              memberships: {
                some: {
                  userId,
                  status: TeamMembershipStatus.ACTIVE,
                },
              },
            },
          },
        ],
      },
      select: {
        id: true,
        teamId: true,
        createdByUserId: true,
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
        jobData: { init: true },
      },
    });

    // Handle image file records for the new study
    let photoFileId: string | undefined;
    let coverFileId: string | undefined;

    if (data.images?.photoKey) {
      const file = await prisma.file.create({
        data: {
          studyId: newStudy.id,
          bucket: process.env.AWS_BUCKET || "",
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
          bucket: process.env.AWS_BUCKET || "",
          key: data.images.coverKey,
          size: null,
          fileType: FileType.IMAGE,
          imageType: guessImageTypeFromKey(data.images.coverKey),
        },
      });
      coverFileId = file.id;
    }

    // Create the new persona version
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
        data: {
          data,
        } as unknown as Prisma.InputJsonValue,
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

export async function dbGetCommunicationPreferences(userId: string) {
  try {
    const prefs = await prisma.communicationPreferences.findUnique({
      where: { userId },
      select: {
        digest: true,
        productUpdates: true,
        promotions: true,
        educational: true,
        feedback: true,
        security: true,
        billing: true,
        policy: true,
        updatedAt: true,
      },
    });
    logger.info("Successfully fetched communication preferences", {
      userId,
      found: !!prefs,
    });
    return prefs;
  } catch (error) {
    logger.error("Failed to fetch communication preferences", {
      userId,
      error,
    });
    throw error;
  }
}

const OPTIONAL_COMM_PREF_KEYS_INTERNAL = [
  "digest",
  "productUpdates",
  "promotions",
  "educational",
  "feedback",
] as const;

type OptionalCommPrefKeyInternal =
  (typeof OPTIONAL_COMM_PREF_KEYS_INTERNAL)[number];

export async function dbUpdateCommunicationPreferences(
  userId: string,
  updates: Partial<Record<OptionalCommPrefKeyInternal, boolean>>
) {
  try {
    const data: Record<string, boolean> = {};
    for (const key of Object.keys(updates)) {
      if (
        OPTIONAL_COMM_PREF_KEYS_INTERNAL.includes(
          key as OptionalCommPrefKeyInternal
        ) &&
        typeof updates[key as OptionalCommPrefKeyInternal] === "boolean"
      ) {
        data[key] = updates[key as OptionalCommPrefKeyInternal] as boolean;
      }
    }
    if (!Object.keys(data).length) {
      throw new Error("No valid communication preference fields provided");
    }
    const prefs = await prisma.communicationPreferences.upsert({
      where: { userId },
      update: data,
      create: { userId, ...data },
      select: {
        digest: true,
        productUpdates: true,
        promotions: true,
        educational: true,
        feedback: true,
        security: true,
        billing: true,
        policy: true,
        updatedAt: true,
      },
    });
    logger.info("Successfully updated communication preferences", {
      userId,
      keys: Object.keys(data),
    });
    return prefs;
  } catch (error) {
    logger.error("Failed to update communication preferences", {
      userId,
      error,
    });
    throw error;
  }
}

// ==================== Heuristic Family Management ====================

/**
 * Create a custom heuristic family for a company
 */
export async function dbCreateHeuristicFamily(data: {
  name: string;
  key: string;
  description?: string;
  companyId: string;
  createdById?: string;
}) {
  try {
    const family = await prisma.heuristicFamily.create({
      data: {
        name: data.name,
        key: data.key,
        description: data.description,
        companyId: data.companyId,
        createdById: data.createdById,
      },
    });

    logger.info("Successfully created heuristic family", {
      familyId: family.id,
      companyId: data.companyId,
    });

    return family;
  } catch (error) {
    logger.error("Failed to create heuristic family", { data, error });
    throw error;
  }
}

/**
 * Update a heuristic family
 */
export async function dbUpdateHeuristicFamily(
  familyId: string,
  data: {
    name?: string;
    description?: string;
  }
) {
  try {
    const family = await prisma.heuristicFamily.update({
      where: { id: familyId },
      data,
    });

    logger.info("Successfully updated heuristic family", { familyId });
    return family;
  } catch (error) {
    logger.error("Failed to update heuristic family", { familyId, error });
    throw error;
  }
}

/**
 * Delete a custom heuristic family (only company-owned)
 */
export async function dbDeleteHeuristicFamily(
  familyId: string,
  companyId: string
) {
  try {
    // Verify the family belongs to the company
    const family = await prisma.heuristicFamily.findFirst({
      where: {
        id: familyId,
        companyId,
      },
    });

    if (!family) {
      throw new Error("Heuristic family not found or access denied");
    }

    await prisma.heuristicFamily.delete({
      where: { id: familyId },
    });

    logger.info("Successfully deleted heuristic family", {
      familyId,
      companyId,
    });
  } catch (error) {
    logger.error("Failed to delete heuristic family", { familyId, error });
    throw error;
  }
}

/**
 * Toggle visibility of a global heuristic family for a company
 */
export async function dbToggleHeuristicFamilyVisibility(
  familyId: string,
  companyId: string,
  isHidden: boolean
) {
  try {
    // Verify the family is global (not company-owned)
    const family = await prisma.heuristicFamily.findFirst({
      where: {
        id: familyId,
        companyId: null, // Must be global
      },
    });

    if (!family) {
      throw new Error(
        "Can only toggle visibility for global heuristic families"
      );
    }

    const visibility = await prisma.companyHeuristicVisibility.upsert({
      where: {
        companyId_heuristicFamilyId: {
          companyId,
          heuristicFamilyId: familyId,
        },
      },
      create: {
        companyId,
        heuristicFamilyId: familyId,
        isHidden,
      },
      update: {
        isHidden,
      },
    });

    logger.info("Successfully toggled heuristic family visibility", {
      familyId,
      companyId,
      isHidden,
    });

    return visibility;
  } catch (error) {
    logger.error("Failed to toggle heuristic family visibility", {
      familyId,
      companyId,
      error,
    });
    throw error;
  }
}

/**
 * Create a heuristic within a family
 */
export async function dbCreateHeuristic(data: {
  heuristicFamilyId: string;
  category?: string;
  label?: string;
  heuristic: string;
  description?: string;
  companyId?: string; // For permission check
  createdById?: string;
}) {
  try {
    // Verify the family exists and user has permission
    const family = await prisma.heuristicFamily.findUnique({
      where: { id: data.heuristicFamilyId },
    });

    if (!family) {
      throw new Error("Heuristic family not found");
    }

    // If it's a company-owned family, verify the company matches
    if (family.companyId && family.companyId !== data.companyId) {
      throw new Error("Access denied to this heuristic family");
    }

    // Global families can't be modified
    if (!family.companyId) {
      throw new Error("Cannot add heuristics to global families");
    }

    const heuristic = await prisma.heuristic.create({
      data: {
        heuristicFamilyId: data.heuristicFamilyId,
        category: data.category,
        label: data.label,
        heuristic: data.heuristic,
        createdById: data.createdById,
      },
    });

    logger.info("Successfully created heuristic", {
      heuristicId: heuristic.id,
      familyId: data.heuristicFamilyId,
    });

    return heuristic;
  } catch (error) {
    logger.error("Failed to create heuristic", { data, error });
    throw error;
  }
}

/**
 * Update a heuristic
 */
export async function dbUpdateHeuristic(
  heuristicId: string,
  data: {
    category?: string;
    label?: string;
    heuristic?: string;
    description?: string;
    companyId?: string; // For permission check
  }
) {
  try {
    // Verify the heuristic exists and belongs to a company-owned family
    const existing = await prisma.heuristic.findUnique({
      where: { id: heuristicId },
      include: { family: true },
    });

    if (!existing) {
      throw new Error("Heuristic not found");
    }

    const family = existing.family;
    if (!family || !family.companyId) {
      throw new Error("Cannot modify global heuristics");
    }

    if (data.companyId && family.companyId !== data.companyId) {
      throw new Error("Access denied");
    }

    const { companyId, ...updateData } = data;

    const heuristic = await prisma.heuristic.update({
      where: { id: heuristicId },
      data: updateData,
    });

    logger.info("Successfully updated heuristic", { heuristicId });
    return heuristic;
  } catch (error) {
    logger.error("Failed to update heuristic", { heuristicId, error });
    throw error;
  }
}

/**
 * Delete a heuristic
 */
export async function dbDeleteHeuristic(
  heuristicId: string,
  companyId?: string
) {
  try {
    // Verify the heuristic exists and belongs to a company-owned family
    const existing = await prisma.heuristic.findUnique({
      where: { id: heuristicId },
      include: { family: true },
    });

    if (!existing) {
      throw new Error("Heuristic not found");
    }

    const family = existing.family;
    if (!family || !family.companyId) {
      throw new Error("Cannot delete global heuristics");
    }

    if (companyId && family.companyId !== companyId) {
      throw new Error("Access denied");
    }

    await prisma.heuristic.delete({
      where: { id: heuristicId },
    });

    logger.info("Successfully deleted heuristic", { heuristicId });
  } catch (error) {
    logger.error("Failed to delete heuristic", { heuristicId, error });
    throw error;
  }
}

/**
 * Add an example to a heuristic
 */
export async function dbCreateHeuristicExample(data: {
  heuristicId: string;
  title?: string;
  description: string;
  companyId?: string; // For permission check
  createdById?: string; // User who created this example
}) {
  try {
    // Verify the heuristic exists and belongs to a company-owned family
    const heuristic = await prisma.heuristic.findUnique({
      where: { id: data.heuristicId },
      include: { family: true },
    });

    if (!heuristic) {
      throw new Error("Heuristic not found");
    }

    const family = heuristic.family;
    if (!family || !family.companyId) {
      throw new Error("Cannot add examples to global heuristics");
    }

    if (data.companyId && family.companyId !== data.companyId) {
      throw new Error("Access denied");
    }

    const example = await prisma.heuristicExample.create({
      data: {
        heuristicId: data.heuristicId,
        title: data.title,
        example: data.description,
        createdById: data.createdById,
      },
    });

    logger.info("Successfully created heuristic example", {
      exampleId: example.id,
      heuristicId: data.heuristicId,
    });

    return example;
  } catch (error) {
    logger.error("Failed to create heuristic example", { data, error });
    throw error;
  }
}

/**
 * Update a heuristic example
 */
export async function dbUpdateHeuristicExample(
  exampleId: string,
  data: {
    title?: string;
    description?: string;
    companyId?: string; // For permission check
  }
) {
  try {
    // Verify the example exists and belongs to a company-owned family
    const existing = await prisma.heuristicExample.findUnique({
      where: { id: exampleId },
      include: {
        heuristic: {
          include: { family: true },
        },
      },
    });

    if (!existing) {
      throw new Error("Heuristic example not found");
    }

    const family = existing.heuristic?.family;
    if (!family || !family.companyId) {
      throw new Error("Cannot delete examples of global heuristics");
    }

    if (data.companyId && family.companyId !== data.companyId) {
      throw new Error("Access denied");
    }

    const { companyId, ...updateData } = data;

    const example = await prisma.heuristicExample.update({
      where: { id: exampleId },
      data: updateData,
    });

    logger.info("Successfully updated heuristic example", { exampleId });
    return example;
  } catch (error) {
    logger.error("Failed to update heuristic example", { exampleId, error });
    throw error;
  }
}

/**
 * Delete a heuristic example
 */
export async function dbDeleteHeuristicExample(
  exampleId: string,
  companyId?: string
) {
  try {
    // Verify the example exists and belongs to a company-owned family
    const existing = await prisma.heuristicExample.findUnique({
      where: { id: exampleId },
      include: {
        heuristic: {
          include: { family: true },
        },
      },
    });

    if (!existing) {
      throw new Error("Heuristic example not found");
    }

    const family = existing.heuristic?.family;
    if (!family || !family.companyId) {
      throw new Error("Cannot delete examples of global heuristics");
    }

    if (companyId && family.companyId !== companyId) {
      throw new Error("Access denied");
    }

    await prisma.heuristicExample.delete({
      where: { id: exampleId },
    });

    logger.info("Successfully deleted heuristic example", { exampleId });
  } catch (error) {
    logger.error("Failed to delete heuristic example", { exampleId, error });
    throw error;
  }
}

/**
 * Request to join a team (creates pending membership)
 */
export async function dbRequestTeamJoin(params: {
  teamId: string;
  userId: string;
  requestNote?: string;
}) {
  const { teamId, userId, requestNote } = params;

  try {
    // Get team and verify it allows requests
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: { id: true, companyId: true, joinPolicy: true, isPersonal: true },
    });

    if (!team) {
      const err: any = new Error("Team not found");
      err.status = 404;
      throw err;
    }

    if (team.isPersonal) {
      const err: any = new Error("Cannot request to join personal teams");
      err.status = 400;
      throw err;
    }

    if (team.joinPolicy !== TeamJoinPolicy.REQUEST_TO_JOIN) {
      const err: any = new Error("This team does not allow join requests");
      err.status = 400;
      throw err;
    }

    // Verify user is a company member
    if (team.companyId) {
      const companyMembership = await prisma.companyMembership.findFirst({
        where: {
          companyId: team.companyId,
          userId,
          status: CompanyMembershipStatus.ACTIVE,
          deactivatedAt: null,
        },
      });

      if (!companyMembership) {
        const err: any = new Error(
          "You must be a company member to request to join this team"
        );
        err.status = 403;
        throw err;
      }
    }

    // Check if already a member or has pending request
    const existing = await prisma.teamMembership.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });

    if (existing) {
      if (existing.status === "ACTIVE") {
        const err: any = new Error("You are already a member of this team");
        err.status = 400;
        throw err;
      } else {
        const err: any = new Error(
          "You already have a pending request for this team"
        );
        err.status = 400;
        throw err;
      }
    }

    // Create pending membership
    const membership = await prisma.teamMembership.create({
      data: {
        teamId,
        userId,
        role: TeamRole.MEMBER,
        status: "PENDING",
        requestNote: requestNote || null,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        team: {
          select: {
            id: true,
            name: true,
            memberships: {
              where: {
                status: TeamMembershipStatus.ACTIVE,
                role: { in: [TeamRole.ADMIN, TeamRole.OWNER] },
              },
              select: {
                userId: true,
                role: true,
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    logger.info("Created pending team membership request", { teamId, userId });
    return membership;
  } catch (error) {
    logger.error("Failed to create team join request", {
      teamId,
      userId,
      error,
    });
    throw error;
  }
}

/**
 * Get pending team join requests for a team
 */
export async function dbGetTeamJoinRequests(teamId: string) {
  try {
    const requests = await prisma.teamMembership.findMany({
      where: {
        teamId,
        status: "PENDING",
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            createdAt: true,
          },
        },
      },
      orderBy: {
        joinedAt: "desc",
      },
    });

    logger.info("Retrieved pending team join requests", {
      teamId,
      count: requests.length,
    });
    return requests;
  } catch (error) {
    logger.error("Failed to get team join requests", { teamId, error });
    throw error;
  }
}

/**
 * Accept a team join request
 */
export async function dbAcceptTeamJoinRequest(params: {
  teamId: string;
  userId: string;
  acceptedById: string;
}) {
  const { teamId, userId, acceptedById } = params;

  try {
    // Verify the requester is a team admin
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: { id: true, companyId: true, isPersonal: true },
    });

    if (!team) {
      const err: any = new Error("Team not found");
      err.status = 404;
      throw err;
    }

    // Check if acceptedBy user is team admin or owner
    const adminMembership = await prisma.teamMembership.findUnique({
      where: { teamId_userId: { teamId, userId: acceptedById } },
    });

    const allowedRoles = [TeamRole.ADMIN, TeamRole.OWNER];
    let isAuthorized =
      adminMembership &&
      adminMembership.status === "ACTIVE" &&
      allowedRoles.includes(adminMembership.role as "OWNER" | "ADMIN");

    // If not team admin, check if company admin
    if (!isAuthorized && team.companyId) {
      const companyMembership = await prisma.companyMembership.findFirst({
        where: {
          companyId: team.companyId,
          userId: acceptedById,
          status: CompanyMembershipStatus.ACTIVE,
        },
      });
      const allowedCompanyRoles = [CompanyRole.OWNER, CompanyRole.ADMIN];
      isAuthorized =
        !!companyMembership &&
        allowedCompanyRoles.includes(
          companyMembership.role as "OWNER" | "ADMIN"
        );
    }

    if (!isAuthorized) {
      const err: any = new Error("Not authorized to accept team join requests");
      err.status = 403;
      throw err;
    }

    // Update the membership status to ACTIVE
    const membership = await prisma.teamMembership.update({
      where: { teamId_userId: { teamId, userId } },
      data: { status: "ACTIVE" },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        team: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    logger.info("Accepted team join request", { teamId, userId, acceptedById });
    return membership;
  } catch (error) {
    logger.error("Failed to accept team join request", {
      teamId,
      userId,
      error,
    });
    throw error;
  }
}

/**
 * Reject a team join request (delete pending membership)
 */
export async function dbRejectTeamJoinRequest(params: {
  teamId: string;
  userId: string;
  rejectedById: string;
  rejectReason?: string;
}) {
  const { teamId, userId, rejectedById } = params;

  try {
    // Verify the requester is a team admin
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: { id: true, companyId: true, isPersonal: true },
    });

    if (!team) {
      const err: any = new Error("Team not found");
      err.status = 404;
      throw err;
    }

    // Check if rejectedBy user is team admin or owner
    const adminMembership = await prisma.teamMembership.findUnique({
      where: { teamId_userId: { teamId, userId: rejectedById } },
    });

    const allowedRoles = [TeamRole.ADMIN, TeamRole.OWNER];
    let isAuthorized =
      adminMembership &&
      adminMembership.status === "ACTIVE" &&
      allowedRoles.includes(adminMembership.role as "OWNER" | "ADMIN");

    // If not team admin, check if company admin
    if (!isAuthorized && team.companyId) {
      const companyMembership = await prisma.companyMembership.findFirst({
        where: {
          companyId: team.companyId,
          userId: rejectedById,
          status: CompanyMembershipStatus.ACTIVE,
        },
      });
      const allowedCompanyRoles = [CompanyRole.OWNER, CompanyRole.ADMIN];
      isAuthorized =
        !!companyMembership &&
        allowedCompanyRoles.includes(
          companyMembership.role as "OWNER" | "ADMIN"
        );
    }

    if (!isAuthorized) {
      const err: any = new Error("Not authorized to reject team join requests");
      err.status = 403;
      throw err;
    }

    const membership = await prisma.teamMembership.findUnique({
      where: { teamId_userId: { teamId, userId } },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        team: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!membership) {
      const err: any = new Error("Join request not found");
      err.status = 404;
      throw err;
    }

    // Delete the pending membership
    await prisma.teamMembership.delete({
      where: { teamId_userId: { teamId, userId } },
    });

    logger.info("Rejected team join request", { teamId, userId, rejectedById });
    return membership;
  } catch (error) {
    logger.error("Failed to reject team join request", {
      teamId,
      userId,
      error,
    });
    throw error;
  }
}

// Credit Ledger Functions

interface GetCreditLedgerParams {
  userId: string;
  companyId?: string;
  isCompanyAdmin: boolean;
  teamIds: string[];
  page: number;
  pageSize: number;
  sortBy: "createdAt" | "delta" | "teamName" | "reason" | "byUserName";
  sortOrder: "asc" | "desc";
}

export async function dbGetCreditLedger({
  userId,
  companyId,
  isCompanyAdmin,
  teamIds,
  page,
  pageSize,
  sortBy,
  sortOrder,
}: GetCreditLedgerParams) {
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
