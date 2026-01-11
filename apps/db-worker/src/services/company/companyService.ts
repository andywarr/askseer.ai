import prisma from "../db.ts";
import {
  CompanyMembershipStatus,
  CompanyRole,
  InviteStatus,
  TeamJoinPolicy,
  TeamMembershipStatus,
  TeamRole,
  UserStatus,
} from "@prisma/client";
import { logger } from "@/apps/shared/logger.ts";
import { ForbiddenError, NotFoundError } from "../shared/errors.ts";
import { deleteS3Objects } from "../storage/s3Service.ts";
import { addUsersToAutoJoinTeams } from "../team/teamService.ts";

// ============================================================================
// Authorization Helpers
// ============================================================================

function canDeleteCompany(
  membership: {
    role: CompanyRole;
    status: string;
    deactivatedAt: Date | null;
    user: { status: string } | null;
  } | null
): boolean {
  if (!membership) return false;
  return (
    membership.status === CompanyMembershipStatus.ACTIVE &&
    membership.deactivatedAt === null &&
    membership.user?.status === UserStatus.ACTIVE &&
    membership.role === "OWNER"
  );
}

async function attachPersonalTeamIfSameDomain(
  companyId: string,
  userId: string
) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { domains: { select: { domain: true } } },
  });
  if (!company) return;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  if (!user?.email) return;

  const userDomain = user.email.split("@").pop()?.toLowerCase();
  const companyDomains = new Set(
    company.domains.map((d) => d.domain.toLowerCase())
  );
  if (!userDomain || !companyDomains.has(userDomain)) return;

  const personalTeam = await prisma.team.findFirst({
    where: {
      createdByUserId: userId,
      isPersonal: true,
      companyId: null,
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

async function removeInitialGrantCredits(userId: string) {
  const personalTeam = await prisma.team.findFirst({
    where: { createdByUserId: userId, isPersonal: true },
    select: { id: true },
  });
  if (!personalTeam) return;

  await prisma.creditLedger.deleteMany({
    where: {
      teamId: personalTeam.id,
      reason: { startsWith: "initial_grant" },
    },
  });
  await prisma.team.update({
    where: { id: personalTeam.id },
    data: { credits: 0 },
  });
  logger.debug("Removed initial grant credits for enrolled user", { userId });
}

// ============================================================================
// Company CRUD
// ============================================================================

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
      membership.role !== "OWNER"
    ) {
      throw ForbiddenError("Only owners can update company name");
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
      membership.role !== "OWNER"
    ) {
      throw ForbiddenError("Only owners can update company image");
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
      membership.role !== "OWNER"
    ) {
      throw ForbiddenError("Only owners can update join settings");
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
      membership.role !== "OWNER"
    ) {
      throw ForbiddenError("Only owners can update personal team settings");
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
            role: "MEMBER",
            invitedById: invitedById || null,
            status: CompanyMembershipStatus.ACTIVE,
            deactivatedAt: null,
          },
          update: {
            role: "MEMBER",
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
      throw ForbiddenError("Not authorized to delete company");
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
      throw NotFoundError("Company not found");
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
        throw ForbiddenError("Not authorized to delete company");
      }

      const existingCompany = await tx.company.findUnique({
        where: { id: companyId },
        select: { id: true },
      });

      if (!existingCompany) {
        throw NotFoundError("Company not found");
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
      // Create company with PENDING status (will be activated by admin)
      const company = await tx.company.create({
        data: {
          name: name.trim(),
          createdByUserId: userId as string,
        },
      });

      // Create domain with PENDING status
      await tx.companyDomain.create({
        data: {
          companyId: company.id,
          domain,
          requestedByUserId: userId as string,
        },
      });

      // Create PENDING membership for claiming user
      if (userId) {
        await tx.companyMembership.upsert({
          where: { companyId_userId: { companyId: company.id, userId } },
          create: {
            companyId: company.id,
            userId,
            role: "OWNER",
            status: CompanyMembershipStatus.PENDING,
            deactivatedAt: null,
          },
          update: {
            role: "OWNER",
            status: CompanyMembershipStatus.PENDING,
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

// ============================================================================
// Company Activation & Rejection
// ============================================================================

export async function dbActivateCompany(params: {
  companyId: string;
  reviewedByUserId?: string;
}): Promise<{
  success: boolean;
  company?: { id: string; name: string; status: string };
  defaultTeamId?: string;
  claimingUserId?: string;
}> {
  const { companyId, reviewedByUserId } = params;

  try {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      include: {
        domains: true,
        memberships: {
          where: { role: CompanyRole.OWNER },
          include: { user: { select: { id: true, email: true } } },
        },
      },
    });

    if (!company) {
      const err: any = new Error("Company not found");
      err.status = 404;
      throw err;
    }

    if (company.status !== "PENDING") {
      const err: any = new Error(
        `Company is already ${company.status.toLowerCase()}, cannot activate`
      );
      err.status = 400;
      throw err;
    }

    const claimingMembership = company.memberships.find(
      (m) => m.status === CompanyMembershipStatus.PENDING
    );
    if (!claimingMembership) {
      const err: any = new Error("No pending owner found for this company");
      err.status = 400;
      throw err;
    }
    const claimingUserId = claimingMembership.userId;
    const claimingUserEmail = claimingMembership.user?.email;

    const result = await prisma.$transaction(async (tx) => {
      await tx.company.update({
        where: { id: companyId },
        data: {
          status: "ACTIVE",
          reviewedByUserId: reviewedByUserId || null,
          reviewedAt: new Date(),
        },
      });

      await tx.companyDomain.updateMany({
        where: { companyId, status: "PENDING" },
        data: {
          status: "ACTIVE",
          reviewedByUserId: reviewedByUserId || null,
          reviewedAt: new Date(),
        },
      });

      await tx.companyMembership.update({
        where: { companyId_userId: { companyId, userId: claimingUserId } },
        data: {
          status: CompanyMembershipStatus.ACTIVE,
          deactivatedAt: null,
        },
      });

      const emailDomain = claimingUserEmail?.split("@")[1]?.toLowerCase();
      const companyDomain = company.domains[0]?.domain?.toLowerCase();
      if (emailDomain && companyDomain && emailDomain === companyDomain) {
        const personalTeam = await tx.team.findFirst({
          where: {
            isPersonal: true,
            companyId: null,
            memberships: { some: { userId: claimingUserId } },
          },
          select: { id: true },
        });
        if (personalTeam) {
          await tx.team.update({
            where: { id: personalTeam.id },
            data: { companyId },
          });
        }
      }

      const defaultTeamName = `${company.name} Team`;
      const defaultTeam = await tx.team.create({
        data: {
          companyId,
          name: defaultTeamName,
          createdByUserId: claimingUserId,
          joinPolicy: TeamJoinPolicy.AUTO_JOIN,
          isDefaultForCompany: true,
        },
      });

      await tx.teamMembership.create({
        data: {
          teamId: defaultTeam.id,
          userId: claimingUserId,
          role: TeamRole.OWNER,
          status: TeamMembershipStatus.ACTIVE,
        },
      });

      await tx.user.update({
        where: { id: claimingUserId },
        data: { selectedTeamId: defaultTeam.id },
      });

      const personalTeam = await tx.team.findFirst({
        where: {
          isPersonal: true,
          memberships: { some: { userId: claimingUserId } },
        },
        select: { id: true, credits: true },
      });
      if (personalTeam) {
        const initialGrant = await tx.creditLedger.findFirst({
          where: {
            teamId: personalTeam.id,
            reason: "initial_personal_team_grant",
          },
        });
        if (initialGrant && personalTeam.credits >= initialGrant.delta) {
          await tx.team.update({
            where: { id: personalTeam.id },
            data: { credits: { decrement: initialGrant.delta } },
          });
          await tx.creditLedger.create({
            data: {
              teamId: personalTeam.id,
              byUserId: reviewedByUserId || claimingUserId,
              delta: -initialGrant.delta,
              reason: "company_activation_credit_removal",
            },
          });
        }
      }

      return { defaultTeamId: defaultTeam.id };
    });

    if (company.autoEnroll) {
      try {
        await addUsersToAutoJoinTeams(prisma, companyId);
      } catch (autoEnrollErr) {
        logger.warn("Failed to auto-enroll users during company activation", {
          companyId,
          error: autoEnrollErr,
        });
      }
    }

    logger.info("Company activated successfully", {
      companyId,
      companyName: company.name,
      claimingUserId,
      defaultTeamId: result.defaultTeamId,
      reviewedByUserId,
    });

    return {
      success: true,
      company: { id: companyId, name: company.name, status: "ACTIVE" },
      defaultTeamId: result.defaultTeamId,
      claimingUserId,
    };
  } catch (error) {
    logger.error("Failed to activate company", {
      companyId,
      reviewedByUserId,
      error,
    });
    throw error;
  }
}

export async function dbRejectCompany(params: {
  companyId: string;
  reviewedByUserId?: string;
}): Promise<{
  success: boolean;
  company?: { id: string; name: string; status: string };
}> {
  const { companyId, reviewedByUserId } = params;

  try {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, name: true, status: true },
    });

    if (!company) {
      const err: any = new Error("Company not found");
      err.status = 404;
      throw err;
    }

    if (company.status !== "PENDING") {
      const err: any = new Error(
        `Company is already ${company.status.toLowerCase()}, cannot reject`
      );
      err.status = 400;
      throw err;
    }

    await prisma.$transaction(async (tx) => {
      await tx.company.update({
        where: { id: companyId },
        data: {
          status: "REJECTED",
          reviewedByUserId: reviewedByUserId || null,
          reviewedAt: new Date(),
        },
      });

      await tx.companyDomain.updateMany({
        where: { companyId, status: "PENDING" },
        data: {
          status: "REJECTED",
          reviewedByUserId: reviewedByUserId || null,
          reviewedAt: new Date(),
        },
      });

      await tx.companyMembership.updateMany({
        where: { companyId, status: CompanyMembershipStatus.PENDING },
        data: {
          status: CompanyMembershipStatus.DEACTIVATED,
          deactivatedAt: new Date(),
        },
      });
    });

    logger.info("Company claim rejected", {
      companyId,
      companyName: company.name,
      reviewedByUserId,
    });

    return {
      success: true,
      company: { id: companyId, name: company.name, status: "REJECTED" },
    };
  } catch (error) {
    logger.error("Failed to reject company", {
      companyId,
      reviewedByUserId,
      error,
    });
    throw error;
  }
}

// ============================================================================
// Company Membership Management
// ============================================================================

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

    try {
      await attachPersonalTeamIfSameDomain(companyId, userId);
    } catch (innerErr) {
      logger.warn("Failed to attach personal team after membership upsert", {
        companyId,
        userId,
        error: innerErr,
      });
    }

    try {
      await removeInitialGrantCredits(userId);
    } catch (innerErr) {
      logger.warn(
        "Failed to remove initial grant credits on membership upsert",
        { companyId, userId, error: innerErr }
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
        where: { id: { in: personalTeams.map((t) => t.id) } },
        data: { companyId: null },
      });

      const companyTeams = await tx.teamMembership.findMany({
        where: {
          userId,
          team: { companyId, isPersonal: false },
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
          team: { companyId, isPersonal: false },
        },
      });

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

// ============================================================================
// Company Invites
// ============================================================================

export async function dbCreateCompanyInvite(params: {
  companyId: string;
  email: string;
  role: CompanyRole;
  token: string;
  invitedById: string;
  teamIds?: string[];
}) {
  const { companyId, email, role, token, invitedById, teamIds } = params;
  try {
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const invite = await prisma.companyInvite.create({
      data: {
        companyId,
        email,
        role,
        token,
        expiresAt,
        invitedById,
        teamIds: teamIds || [],
      },
    });
    logger.info("Company invite created", {
      companyId,
      email,
      invitedById,
      teamIds,
    });
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

// ============================================================================
// User Erasure (GDPR)
// ============================================================================

export async function dbEraseUser(params: {
  userId: string;
  requestedById: string;
  companyId: string;
  reason?: string;
}) {
  const { userId, requestedById, companyId, reason } = params;

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
        const err: any = new Error("Not authorized to erase users");
        err.status = 403;
        throw err;
      }

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
        (err as any).companies = companiesWhereLastOwner.map((cm) => ({
          id: cm.company.id,
          name: cm.company.name,
        }));
        throw err;
      }

      const timestamp = Date.now();
      const anonymizedEmail = `erased-${userId}-${timestamp}@erased.local`;

      await tx.account.deleteMany({ where: { userId } });
      await tx.session.deleteMany({ where: { userId } });
      await tx.communicationPreferences.deleteMany({ where: { userId } });
      await tx.teamMembership.deleteMany({ where: { userId } });

      await tx.companyMembership.updateMany({
        where: { userId },
        data: {
          status: CompanyMembershipStatus.ERASED,
          deactivatedAt: new Date(),
        },
      });

      await tx.companyInvite.updateMany({
        where: { invitedById: userId },
        data: { status: InviteStatus.REVOKED },
      });

      await tx.teamInvite.deleteMany({ where: { invitedById: userId } });

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

      if (personalTeamsWithStudies.length > 0) {
        await tx.team.updateMany({
          where: { id: { in: personalTeamsWithStudies.map((t) => t.id) } },
          data: { companyId: null },
        });
      }

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
