import prisma from "../db.ts";
import { logger } from "@/apps/shared/logger.ts";
import { CompanyMembershipStatus } from "@prisma/client";
import { deleteS3Objects } from "../storage/s3Service.ts";

// ============================================================================
// User CRUD
// ============================================================================

export async function dbGetUser(userId: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
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

// ============================================================================
// Communication Preferences
// ============================================================================

const OPTIONAL_COMM_PREF_KEYS = [
  "digest",
  "productUpdates",
  "promotions",
  "educational",
  "feedback",
] as const;

type OptionalCommPrefKey = (typeof OPTIONAL_COMM_PREF_KEYS)[number];

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

export async function dbUpdateCommunicationPreferences(
  userId: string,
  updates: Partial<Record<OptionalCommPrefKey, boolean>>
) {
  try {
    const data: Record<string, boolean> = {};
    for (const key of Object.keys(updates)) {
      if (
        OPTIONAL_COMM_PREF_KEYS.includes(key as OptionalCommPrefKey) &&
        typeof updates[key as OptionalCommPrefKey] === "boolean"
      ) {
        data[key] = updates[key as OptionalCommPrefKey] as boolean;
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

// ============================================================================
// User Account Deletion
// ============================================================================

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
      (err as any).companies = user.companyMemberships.map((m) => m.companyId);
      throw err;
    }

    const teamIds = user.teamsCreated.map((team) => team.id);
    const studyIds = user.teamsCreated.flatMap((team) =>
      team.studies.map((study) => study.id)
    );
    const fileKeys = user.teamsCreated.flatMap((team) =>
      team.studies.flatMap((study) =>
        study.files.map((file) => file.key).filter((key): key is string => !!key)
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
