// @ts-nocheck
"use server";

import { revalidatePath } from "next/cache";

import { logger } from "@/apps/shared/logger";
import { updateUserSelectedTeam } from "@/apps/nextjs-app/lib/data";
import {
  requireAuth,
  actionSuccess,
  actionError,
  ActionResult,
} from "@/apps/nextjs-app/lib/actions/shared";

export async function updateSelectedTeamAction(
  teamId: string,
): Promise<ActionResult> {
  const user = await requireAuth();

  if (!teamId) {
    return actionError("Team ID is required");
  }

  try {
    await updateUserSelectedTeam(user.id, teamId);
    logger.info("Updated selected team for user", {
      userId: user.id,
      teamId,
    });
    // Revalidate the studies page to ensure fresh data with new team context
    revalidatePath("/studies");
    return actionSuccess();
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
