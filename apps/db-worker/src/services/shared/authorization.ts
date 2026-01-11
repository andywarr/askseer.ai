import prisma from "@/apps/db-worker/src/services/db.ts";
import {
  CompanyMembershipStatus,
  CompanyRole,
  TeamMembershipStatus,
  TeamRole,
  UserStatus,
  StudyVisibility,
} from "@prisma/client";
import { logger } from "@/apps/shared/logger.ts";
import { ForbiddenError, NotFoundError } from "./errors.ts";
import type { UserMembershipIds, StudyManagementContext } from "./types.ts";

/**
 * Get the user's team and company memberships for visibility checks
 */
export async function getUserMembershipIds(
  userId: string
): Promise<UserMembershipIds> {
  const userMemberships = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      teamMemberships: {
        where: { status: TeamMembershipStatus.ACTIVE },
        select: { teamId: true, role: true },
      },
      companyMemberships: {
        where: { status: CompanyMembershipStatus.ACTIVE },
        select: { companyId: true, role: true },
      },
    },
  });

  const teamMemberships = userMemberships?.teamMemberships || [];
  const companyMemberships = userMemberships?.companyMemberships || [];

  // Teams where user is admin or owner
  const adminTeamIds = teamMemberships
    .filter((m) => m.role === TeamRole.ADMIN || m.role === TeamRole.OWNER)
    .map((m) => m.teamId);

  // Companies where user is admin or owner
  const adminCompanyIds = companyMemberships
    .filter((m) => m.role === CompanyRole.ADMIN || m.role === CompanyRole.OWNER)
    .map((m) => m.companyId);

  return {
    teamIds: teamMemberships.map((m) => m.teamId),
    companyIds: companyMemberships.map((m) => m.companyId),
    adminTeamIds,
    adminCompanyIds,
  };
}

/**
 * Build visibility-aware where clause for studies
 *
 * Visibility rules:
 * - PRIVATE: Creator (if team member) OR team admin/owner OR company admin/owner
 * - TEAM: Team members OR company admin/owner
 * - COMPANY: Company members
 */
export function buildStudyVisibilityConditions(
  userId: string,
  userTeamIds: string[],
  userCompanyIds: string[],
  adminTeamIds: string[] = [],
  adminCompanyIds: string[] = []
): any[] {
  const conditions: any[] = [];

  // PRIVATE visibility conditions
  const privateConditions: any[] = [];
  // Creator who is still a team member can view their private studies
  if (userTeamIds.length > 0) {
    privateConditions.push({
      createdByUserId: userId,
      teamId: { in: userTeamIds },
    });
  }
  // Team admins/owners can view private studies in their teams
  if (adminTeamIds.length > 0) {
    privateConditions.push({
      teamId: { in: adminTeamIds },
    });
  }
  // Company admins/owners can view private studies in their company's teams
  if (adminCompanyIds.length > 0) {
    privateConditions.push({
      team: { companyId: { in: adminCompanyIds } },
    });
  }
  if (privateConditions.length > 0) {
    conditions.push({
      visibility: StudyVisibility.PRIVATE,
      OR: privateConditions,
    });
  }

  // TEAM visibility conditions
  const teamConditions: any[] = [];
  // Team members can view team studies
  if (userTeamIds.length > 0) {
    teamConditions.push({
      teamId: { in: userTeamIds },
    });
  }
  // Company admins/owners can view team studies in their company's teams
  if (adminCompanyIds.length > 0) {
    teamConditions.push({
      team: { companyId: { in: adminCompanyIds } },
    });
  }
  if (teamConditions.length > 0) {
    conditions.push({
      visibility: StudyVisibility.TEAM,
      OR: teamConditions,
    });
  }

  // COMPANY visibility - any company member can view
  if (userCompanyIds.length > 0) {
    conditions.push({
      visibility: StudyVisibility.COMPANY,
      team: { companyId: { in: userCompanyIds } },
    });
  }

  return conditions;
}

/**
 * Get study management context with authorization info
 */
export async function getStudyManagementContext(
  studyId: string,
  userId: string
): Promise<StudyManagementContext> {
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
    throw NotFoundError("Study not found");
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

/**
 * Require study access - throws if user cannot access
 */
export async function requireStudyAccess(
  studyId: string,
  userId: string
): Promise<StudyManagementContext> {
  const context = await getStudyManagementContext(studyId, userId);
  const { isOwner, isTeamAdmin, isCompanyAdmin } = context;

  if (!isOwner && !isTeamAdmin && !isCompanyAdmin) {
    throw ForbiddenError("User not authorized to access study");
  }

  return context;
}

/**
 * Helper function to update study modification tracking
 */
export async function updateStudyModification(
  studyId: string,
  userId: string
): Promise<void> {
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

/**
 * Check if user is team admin or owner
 */
export async function checkTeamAdminAuthorization(
  teamId: string,
  userId: string
): Promise<{
  isAuthorized: boolean;
  team: { id: string; companyId: string | null; isPersonal: boolean } | null;
}> {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { id: true, companyId: true, isPersonal: true },
  });

  if (!team) {
    return { isAuthorized: false, team: null };
  }

  // Check team membership
  const teamMembership = await prisma.teamMembership.findUnique({
    where: { teamId_userId: { teamId, userId } },
    select: { role: true },
  });

  const allowedTeamRoles: TeamRole[] = [TeamRole.OWNER, TeamRole.ADMIN];
  let isAuthorized =
    !!teamMembership &&
    allowedTeamRoles.includes(teamMembership.role as TeamRole);

  // If not authorized via team, check company membership
  if (!isAuthorized && team.companyId) {
    const companyMembership = await prisma.companyMembership.findUnique({
      where: {
        companyId_userId: {
          companyId: team.companyId,
          userId,
        },
      },
      select: {
        role: true,
        status: true,
        deactivatedAt: true,
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

  return { isAuthorized, team };
}

/**
 * Require team admin access - throws if user is not authorized
 */
export async function requireTeamAdmin(
  teamId: string,
  userId: string
): Promise<{ id: string; companyId: string | null; isPersonal: boolean }> {
  const { isAuthorized, team } = await checkTeamAdminAuthorization(
    teamId,
    userId
  );

  if (!team) {
    throw NotFoundError("Team not found");
  }

  if (!isAuthorized) {
    throw ForbiddenError("Not authorized");
  }

  return team;
}

/**
 * Check if user is company admin or owner
 */
export async function checkCompanyAdminAuthorization(
  companyId: string,
  userId: string
): Promise<boolean> {
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
  return (
    !!membership &&
    membership.status === CompanyMembershipStatus.ACTIVE &&
    membership.deactivatedAt === null &&
    membership.user?.status === UserStatus.ACTIVE &&
    allowedRoles.includes(membership.role as CompanyRole)
  );
}

/**
 * Require company admin access - throws if user is not authorized
 */
export async function requireCompanyAdmin(
  companyId: string,
  userId: string
): Promise<void> {
  const isAuthorized = await checkCompanyAdminAuthorization(companyId, userId);

  if (!isAuthorized) {
    throw ForbiddenError("Not authorized");
  }
}

/**
 * Check if a company membership can delete company
 */
export function canDeleteCompany(
  membership: {
    role: string;
    status: string;
    deactivatedAt: Date | null;
    user: { status: string } | null;
  } | null
): boolean {
  const allowedRoles: CompanyRole[] = [CompanyRole.OWNER, CompanyRole.ADMIN];
  return (
    !!membership &&
    membership.status === CompanyMembershipStatus.ACTIVE &&
    membership.deactivatedAt === null &&
    membership.user?.status === UserStatus.ACTIVE &&
    allowedRoles.includes(membership.role as CompanyRole)
  );
}

// Helper functions to get studyId from various entities (for modification tracking)

export async function getStudyIdFromHEEvaluation(
  heuristicEvaluationId: string
): Promise<string | null> {
  const evaluation = await prisma.heuristicEvaluation.findUnique({
    where: { id: heuristicEvaluationId },
    select: { studyId: true },
  });
  return evaluation?.studyId || null;
}

export async function getStudyIdFromCWStep(
  stepId: string
): Promise<string | null> {
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

export async function getStudyIdFromCWIssue(
  issueId: string
): Promise<string | null> {
  const issue = await prisma.cWIssue.findUnique({
    where: { id: issueId },
    select: { stepId: true },
  });
  if (!issue) return null;
  return getStudyIdFromCWStep(issue.stepId);
}

export async function getStudyIdFromCWRecommendation(
  recommendationId: string
): Promise<string | null> {
  const recommendation = await prisma.cWRecommendation.findUnique({
    where: { id: recommendationId },
    select: { issueId: true },
  });
  if (!recommendation) return null;
  return getStudyIdFromCWIssue(recommendation.issueId);
}

export async function getStudyIdFromHEResult(
  resultId: string
): Promise<string | null> {
  const result = await prisma.hEResult.findUnique({
    where: { id: resultId },
    select: { heuristicEvaluationId: true },
  });
  if (!result) return null;
  return getStudyIdFromHEEvaluation(result.heuristicEvaluationId);
}

export async function getStudyIdFromHERecommendation(
  recommendationId: string
): Promise<string | null> {
  const recommendation = await prisma.hERecommendation.findUnique({
    where: { id: recommendationId },
    select: { resultId: true },
  });
  if (!recommendation) return null;
  return getStudyIdFromHEResult(recommendation.resultId);
}
