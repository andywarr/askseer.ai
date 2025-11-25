"use server";

import { auth } from "@/apps/nextjs-app/auth";
import { logger } from "@/apps/shared/logger";
import { revalidatePath } from "next/cache";
import prisma from "@/apps/nextjs-app/lib/db";
import {
  getCompanyByMyDomain,
  getCompanyMembers,
  getCompanyTeams,
  getUserTeams,
} from "@/apps/nextjs-app/lib/data";

interface TransferCreditsParams {
  fromTeamId: string;
  toTeamId: string;
  credits: number;
}

interface TransferCreditsResult {
  success: boolean;
  error?: string;
}

const MAX_CREDITS_PER_TRANSFER = 10000;

export async function transferCredits(
  params: TransferCreditsParams,
): Promise<TransferCreditsResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  const userId = session.user.id;
  const { fromTeamId, toTeamId, credits } = params;

  // Validate inputs
  if (!fromTeamId || !toTeamId) {
    return { success: false, error: "Please select both teams." };
  }

  if (fromTeamId === toTeamId) {
    return {
      success: false,
      error: "Cannot transfer credits to the same team.",
    };
  }

  if (!Number.isFinite(credits) || credits < 1) {
    return { success: false, error: "Enter at least 1 credit to transfer." };
  }

  if (credits > MAX_CREDITS_PER_TRANSFER) {
    return {
      success: false,
      error: `Cannot transfer more than ${MAX_CREDITS_PER_TRANSFER} credits at once.`,
    };
  }

  try {
    // Gather allowed teams based on user permissions
    const allowedTeamIds = new Set<string>();
    let isCompanyAdmin = false;

    const domainInfo = await getCompanyByMyDomain();
    const userTeams = await getUserTeams(userId);

    if (domainInfo?.company) {
      // User is part of a company
      const members = await getCompanyMembers(domainInfo.company.id);
      const me = members.find((member) => member.userId === userId);

      if (!me || me.status === "DEACTIVATED") {
        return { success: false, error: "Access denied." };
      }

      const myRole = String(me.role || "").toUpperCase();
      isCompanyAdmin = myRole === "ADMIN" || myRole === "OWNER";

      const companyTeams = await getCompanyTeams(domainInfo.company.id);

      companyTeams.forEach((team: any) => {
        const membershipRole = String(
          team?.members?.find((m: any) => m.userId === userId)?.role || "",
        ).toUpperCase();

        // Company admins can transfer between any teams (including personal if enabled)
        if (isCompanyAdmin) {
          allowedTeamIds.add(team.id);
        } else if (
          !team.isPersonal &&
          (membershipRole === "ADMIN" || membershipRole === "OWNER")
        ) {
          // Team admins can only transfer between non-personal teams they admin
          allowedTeamIds.add(team.id);
        }
      });
    } else {
      // User not part of a company - cannot transfer
      return {
        success: false,
        error: "Credit transfers are only available for company members.",
      };
    }

    // Verify both teams are in the allowed set
    if (!allowedTeamIds.has(fromTeamId)) {
      return {
        success: false,
        error: "You do not have permission to transfer credits from this team.",
      };
    }

    if (!allowedTeamIds.has(toTeamId)) {
      return {
        success: false,
        error: "You do not have permission to transfer credits to this team.",
      };
    }

    // Check the source team has enough credits
    const fromTeam = await prisma.team.findUnique({
      where: { id: fromTeamId },
      select: { id: true, name: true, credits: true },
    });

    if (!fromTeam) {
      return { success: false, error: "Source team not found." };
    }

    if ((fromTeam.credits ?? 0) < credits) {
      return {
        success: false,
        error: `Insufficient credits. The source team only has ${fromTeam.credits ?? 0} credits.`,
      };
    }

    // Perform the transfer in a transaction
    await prisma.$transaction(async (tx) => {
      // Decrement source team
      await tx.team.update({
        where: { id: fromTeamId },
        data: { credits: { decrement: credits } },
      });

      // Increment destination team
      await tx.team.update({
        where: { id: toTeamId },
        data: { credits: { increment: credits } },
      });

      // Create ledger entry for source (negative)
      await tx.creditLedger.create({
        data: {
          teamId: fromTeamId,
          byUserId: userId,
          delta: -credits,
          reason: `transfer_to_team_${toTeamId}`,
        },
      });

      // Create ledger entry for destination (positive)
      await tx.creditLedger.create({
        data: {
          teamId: toTeamId,
          byUserId: userId,
          delta: credits,
          reason: `transfer_from_team_${fromTeamId}`,
        },
      });
    });

    logger.info("Credits transferred between teams", {
      userId,
      fromTeamId,
      toTeamId,
      credits,
    });

    revalidatePath("/credits");

    return { success: true };
  } catch (error) {
    logger.error("Error transferring credits", {
      error,
      userId,
      params,
    });
    return {
      success: false,
      error: "An error occurred while transferring credits.",
    };
  }
}
