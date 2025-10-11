// Prisma imports
import prisma from "@/apps/db-worker/src/services/db.ts";
import type { Prisma } from "@prisma/client";
import { logger } from "@/apps/shared/logger.ts";
import type {
  JobEnvelopeV2,
  JobEnvelopeV2_HE,
  JobEnvelopeV2_CW,
  JobEnvelopeV2_PE,
} from "@/apps/shared/jobSchema.ts";
import {
  CWIssueType,
  FileType,
  HeuristicType,
  ImageType,
  SourceType,
  StudyStatus,
  StudyType,
  CompanyRole,
  CompanyMembershipStatus,
  TeamRole,
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
  recommendations: HERecommendation[];
  fileId: string;
  step: number;
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

// V2-only: use the envelope directly

export async function dbDeleteStudy(studyId: string, userId: string) {
  try {
    await prisma.study.delete({
      where: {
        id: studyId,
        createdByUserId: userId,
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
  familyKey: string,
  companyId?: string | null
) {
  try {
    // Check if this family is hidden for the company
    if (companyId) {
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

    // Get the family and its heuristics
    const family = await prisma.heuristicFamily.findUnique({
      where: { key: familyKey },
      include: {
        heuristics: {
          include: {
            examples: true,
          },
        },
      },
    });

    if (!family) {
      logger.error("Heuristic family not found", { familyKey });
      throw new Error(`Heuristic family not found: ${familyKey}`);
    }

    // Check if this is a custom family that doesn't belong to the company
    if (family.companyId && family.companyId !== companyId) {
      logger.warn("Access denied to custom heuristic family", {
        familyKey,
        ownerId: family.companyId,
        requesterId: companyId,
      });
      return [];
    }

    logger.info("Successfully fetched heuristics", {
      familyKey,
      companyId,
      heuristicCount: family.heuristics.length,
    });

    return family.heuristics;
  } catch (error) {
    logger.error("Failed to fetch heuristics", { familyKey, companyId, error });
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

export async function dbGetStudy(studyId: string, userId: string) {
  try {
    let study = await prisma.study.findUnique({
      where: {
        id: studyId,
        createdByUserId: userId,
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
              some: { userId },
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
      },
    });

    logger.info("Successfully fetched studies", {
      userId,
      teamId,
      studyCount: studies.length,
    });
    return studies;
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
    heuristic: studyData.payload.heuristic || null,
    personaStudyId: (studyData.payload as any)?.persona?.studyId ?? null,
  };

  try {
    // Resolve selected personaId (optional) from personaStudyId
    let resolvedPersonaId: string | undefined;
    if (core.personaStudyId) {
      const persona = await prisma.persona.findUnique({
        where: { studyId: core.personaStudyId },
        select: { id: true },
      });
      resolvedPersonaId = persona?.id || undefined;
    }

    // Create a heuristic evaluation
    await prisma.heuristicEvaluation.create({
      data: {
        studyId: core.studyId,
        goal: core.goal || "",
        user: core.user,
        context: core.context,
        personaId: resolvedPersonaId,
        heuristicFamilyKey: core.heuristic,
        results: {
          create: results.map((result) => ({
            violated: result.violated,
            reason: result.reason,
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
      include: { memberships: true },
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
      where: { userId },
      include: {
        team: {
          select: {
            id: true,
            name: true,
            isPersonal: true,
            companyId: true,
            credits: true,
            company: { select: { id: true, name: true } },
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
      credits: membership.team.credits,
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
      select: { id: true },
    });

    if (!membership) {
      logger.warn("Attempt to set selected team without membership", {
        userId,
        teamId,
      });
      const err: any = new Error("User is not a member of the requested team");
      err.code = "NOT_MEMBER";
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
    }
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
}) {
  const { companyId, userId, role, invitedById } = params;
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
      },
      update: {
        role: role,
        status: CompanyMembershipStatus.ACTIVE,
        deactivatedAt: null,
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

      await tx.team.updateMany({
        where: {
          isPersonal: true,
          companyId,
          memberships: { some: { userId } },
        },
        data: { companyId: null },
      });

      await tx.teamMembership.deleteMany({
        where: {
          userId,
          team: { companyId },
        },
      });

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
      } as const;
    });

    if (result.deactivated) {
      logger.info("Company member deactivated", {
        companyId,
        userId,
        requestedById,
        deactivatedAt: result.deactivatedAt,
      });
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

      const existing = await tx.teamMembership.findMany({
        where: { teamId, userId: { in: memberIds } },
        select: { userId: true },
      });
      if (existing.length) {
        const err: any = new Error("Some users are already on this team");
        err.status = 400;
        err.details = existing.map((m) => m.userId);
        throw err;
      }

      const validCompanyMembers = await tx.companyMembership.findMany({
        where: {
          companyId: team.companyId,
          userId: { in: memberIds },
          status: CompanyMembershipStatus.ACTIVE,
          deactivatedAt: null,
          user: { status: UserStatus.ACTIVE },
        },
        select: { userId: true },
      });
      const validSet = new Set(validCompanyMembers.map((m) => m.userId));
      const invalid = uniqueMembers.filter((m) => !validSet.has(m.userId));
      if (invalid.length) {
        const err: any = new Error(
          "All members must belong to the same company"
        );
        err.status = 400;
        err.details = invalid.map((m) => m.userId);
        throw err;
      }

      const created = [] as Array<{ id: string; userId: string }>;
      for (const member of uniqueMembers) {
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

export async function dbListCompanyTeams(companyId: string) {
  try {
    const teams = await prisma.team.findMany({
      where: { companyId },
      include: {
        _count: { select: { memberships: true } },
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
    });
    return teams.map((t) => ({
      id: t.id,
      name: t.name,
      isPersonal: t.isPersonal,
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

export async function dbUpdateCWIssue(id: string, issue: string) {
  try {
    const result = await prisma.cWIssue.update({
      where: {
        id: id,
      },
      data: {
        issue: issue,
        source: SourceType.AI_HUMAN,
      },
    });

    logger.info("Successfully updated CW issue", { id });
    return result;
  } catch (error) {
    logger.error("Failed to update CW issue", { id, error });
    throw error;
  }
}

export async function dbUpdateCWRecommendation(
  id: string,
  recommendation: string
) {
  try {
    // Fetch the current recommendation to check its source
    const current = await prisma.cWRecommendation.findUnique({
      where: { id },
      select: { source: true },
    });
    let newSource: SourceType = SourceType.AI_HUMAN;
    if (current?.source === SourceType.HUMAN) {
      newSource = SourceType.HUMAN;
    }
    const result = await prisma.cWRecommendation.update({
      where: {
        id: id,
      },
      data: {
        recommendation: recommendation,
        source: newSource,
      },
    });

    logger.info("Successfully updated CW recommendation", { id });
    return result;
  } catch (error) {
    logger.error("Failed to update CW recommendation", { id, error });
    throw error;
  }
}

export async function dbUpdateHEResult(id: string, reason: string) {
  try {
    const result = await prisma.hEResult.update({
      where: {
        id: id,
      },
      data: {
        reason: reason,
        source: SourceType.AI_HUMAN,
      },
    });

    logger.info("Successfully updated HE result", { id });
    return result;
  } catch (error) {
    logger.error("Failed to update HE result", { id, error });
    throw error;
  }
}

export async function dbUpdateHERecommendation(
  id: string,
  recommendation: string
) {
  try {
    // Fetch the current recommendation to check its source
    const current = await prisma.hERecommendation.findUnique({
      where: { id },
      select: { source: true },
    });
    let newSource: SourceType = SourceType.AI_HUMAN;
    if (current?.source === SourceType.HUMAN) {
      newSource = SourceType.HUMAN;
    }
    const result = await prisma.hERecommendation.update({
      where: {
        id: id,
      },
      data: {
        recommendation: recommendation,
        source: newSource,
      },
    });

    logger.info("Successfully updated HE recommendation", { id });
    return result;
  } catch (error) {
    logger.error("Failed to update HE recommendation", { id, error });
    throw error;
  }
}

export async function dbDeleteCWIssue(id: string) {
  // Delete a cognitive walkthrough issue and its recommendations
  try {
    const result = await prisma.cWIssue.delete({
      where: {
        id: id,
      },
      include: {
        recommendations: true,
      },
    });

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

export async function dbDeleteCWRecommendation(id: string) {
  try {
    const result = await prisma.cWRecommendation.delete({
      where: {
        id: id,
      },
    });

    logger.info("Successfully deleted CW recommendation", { id });
    return result;
  } catch (error) {
    logger.error("Failed to delete CW recommendation", { id, error });
    throw error;
  }
}

export async function dbDeleteHEResult(id: string) {
  try {
    const result = await prisma.hEResult.delete({
      where: {
        id: id,
      },
      include: {
        recommendations: true,
      },
    });

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

export async function dbDeleteHERecommendation(id: string) {
  try {
    const result = await prisma.hERecommendation.delete({
      where: {
        id: id,
      },
    });

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
  source: SourceType
) {
  try {
    const result = await prisma.cWRecommendation.create({
      data: {
        issueId,
        recommendation,
        source,
      },
    });

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
  source: SourceType
) {
  try {
    const result = await prisma.hERecommendation.create({
      data: {
        resultId,
        recommendation,
        source,
      },
    });

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
  source,
}: {
  heuristicEvaluationId: string;
  heuristicId: string;
  step: number;
  fileId: string;
  reason: string;
  source: string;
}) {
  try {
    const result = await prisma.hEResult.create({
      data: {
        heuristicEvaluation: { connect: { id: heuristicEvaluationId } },
        heuristic: { connect: { id: heuristicId } },
        step,
        file: { connect: { id: fileId } },
        reason,
        violated: true,
        source: source === "HUMAN" ? SourceType.HUMAN : SourceType.AI_HUMAN,
      },
    });

    logger.info("Successfully created HE result", {
      heuristicEvaluationId,
      resultId: result.id,
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

export async function dbCreateCWIssue({
  stepId,
  issueType,
  issue,
  source,
}: {
  stepId: string;
  issueType: string;
  issue: string;
  source: string;
}) {
  try {
    const result = await prisma.cWIssue.create({
      data: {
        step: { connect: { id: stepId } },
        issueType: issueType as CWIssueType,
        issue,
        source: source === "HUMAN" ? SourceType.HUMAN : SourceType.AI_HUMAN,
      },
      include: {
        recommendations: true,
      },
    });

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
          { team: { memberships: { some: { userId } } } },
        ],
      },
      include: {
        files: true,
        createdByUser: {
          select: {
            id: true,
            name: true,
            email: true,
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
          { team: { memberships: { some: { userId } } } },
        ],
      },
      include: {
        files: true,
        createdByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        heuristicEvaluation: {
          include: {
            persona: true,
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
          { team: { memberships: { some: { userId } } } },
        ],
      },
      include: {
        files: true,
        createdByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        persona: {
          include: {
            photoFile: true,
            coverFile: true,
            heuristicEvaluations: {
              include: {
                study: {
                  include: {
                    files: true,
                  },
                },
              },
            },
            cognitiveWalkthroughs: {
              include: {
                study: {
                  include: {
                    files: true,
                  },
                },
              },
            },
          },
        },
      },
    });
    logger.info("Successfully fetched persona", {
      studyId,
      userId,
      found: !!personaStudy,
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
          memberships: { some: { userId } },
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

export async function dbUpdateStudyName(studyId: string, name: string) {
  try {
    const updatedStudy = await prisma.study.update({
      where: { id: studyId },
      data: {
        name: name,
      },
    });
    logger.info("Successfully updated study name", {
      studyId,
      name,
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
  files: Array<{ name: string; key: string; size: number; type: string }>;
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
}) {
  try {
    const family = await prisma.heuristicFamily.create({
      data: {
        name: data.name,
        key: data.key,
        description: data.description,
        companyId: data.companyId,
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
        description: data.description,
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

    if (!existing.family.companyId) {
      throw new Error("Cannot modify global heuristics");
    }

    if (data.companyId && existing.family.companyId !== data.companyId) {
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

    if (!existing.family.companyId) {
      throw new Error("Cannot delete global heuristics");
    }

    if (companyId && existing.family.companyId !== companyId) {
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

    if (!heuristic.family.companyId) {
      throw new Error("Cannot add examples to global heuristics");
    }

    if (data.companyId && heuristic.family.companyId !== data.companyId) {
      throw new Error("Access denied");
    }

    const example = await prisma.heuristicExample.create({
      data: {
        heuristicId: data.heuristicId,
        title: data.title,
        description: data.description,
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

    if (!existing.heuristic.family.companyId) {
      throw new Error("Cannot modify examples of global heuristics");
    }

    if (
      data.companyId &&
      existing.heuristic.family.companyId !== data.companyId
    ) {
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

    if (!existing.heuristic.family.companyId) {
      throw new Error("Cannot delete examples of global heuristics");
    }

    if (companyId && existing.heuristic.family.companyId !== companyId) {
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
