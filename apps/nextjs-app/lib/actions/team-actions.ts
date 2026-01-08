"use server";

import { revalidatePath } from "next/cache";

import { logger } from "@/apps/shared/logger";
import {
  updateUserSelectedTeam,
  getUserTeams,
} from "@/apps/nextjs-app/lib/db/data";
import {
  requireAuth,
  actionSuccess,
  actionError,
  ActionResult,
  teamIdSchema,
} from "@/apps/nextjs-app/lib/actions/shared";

// ==========================================
// Actions
// ==========================================

/**
 * Updates the currently selected team for the authenticated user.
 * Validates that the user is a member of the specified team before updating.
 *
 * @param teamId - The ID of the team to select
 * @returns ActionResult with the selected teamId on success
 */
export async function updateSelectedTeamAction(
  teamId: string,
): Promise<ActionResult<{ teamId: string }>> {
  const user = await requireAuth();

  // Validate input
  const parseResult = teamIdSchema.safeParse(teamId);
  if (!parseResult.success) {
    return actionError(
      parseResult.error.errors[0]?.message ?? "Invalid team ID",
    );
  }

  try {
    // Verify user is a member of the team
    const userTeams = await getUserTeams(user.id);
    const isMember = userTeams.some((team) => team.id === teamId);
    if (!isMember) {
      logger.warn("User attempted to select a team they are not a member of", {
        userId: user.id,
        teamId,
      });
      return actionError("You are not a member of this team");
    }

    await updateUserSelectedTeam(user.id, teamId);
    logger.info("Updated selected team for user", {
      userId: user.id,
      teamId,
    });

    // Revalidate pages that depend on team context
    revalidatePath("/studies");
    revalidatePath("/dashboard");
    revalidatePath("/settings");

    return actionSuccess({ teamId });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update selected team";
    logger.error("Failed to update selected team", {
      userId: user.id,
      teamId,
      error: message,
    });
    return actionError(message);
  }
}
