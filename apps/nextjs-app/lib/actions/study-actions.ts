"use server";

import { revalidatePath } from "next/cache";
import { StudyVisibility } from "@prisma/client";
import {
  updateStudyVisibility,
  regenerateStudyShareToken,
  getStudyShareInfo,
  toggleStudyShareLink,
} from "@/apps/nextjs-app/lib/data";
import { isAuthenticated } from "@/apps/nextjs-app/lib/dal";
import { logger } from "@/apps/shared/logger";
import {
  ActionResult,
  actionSuccess,
  actionError,
} from "@/apps/nextjs-app/lib/actions/shared";

const revalidateStudyPaths = (studyId: string) => {
  revalidatePath("/studies");
  revalidatePath(`/walkthrough/${studyId}`);
  revalidatePath(`/evaluation/${studyId}`);
  revalidatePath(`/persona/${studyId}`);
};

export async function handleUpdateStudyVisibility(
  studyId: string,
  visibility: StudyVisibility,
): Promise<
  ActionResult<{ visibility: StudyVisibility; shareToken: string | null }>
> {
  try {
    const session = await isAuthenticated();

    logger.debug("Updating study visibility", {
      studyId,
      visibility,
      userId: session.userId,
    });

    const result = await updateStudyVisibility(
      studyId,
      visibility,
      session.userId,
    );

    revalidateStudyPaths(studyId);

    return actionSuccess({
      visibility: result.visibility,
      shareToken: result.shareToken,
    });
  } catch (error) {
    logger.error("Failed to update study visibility", {
      studyId,
      visibility,
      error,
    });
    return actionError(
      error instanceof Error ? error.message : "Failed to update visibility",
    );
  }
}

export async function handleRegenerateShareToken(
  studyId: string,
): Promise<ActionResult<{ shareToken: string }>> {
  try {
    const session = await isAuthenticated();

    logger.debug("Regenerating study share token", {
      studyId,
      userId: session.userId,
    });

    const result = await regenerateStudyShareToken(studyId, session.userId);

    return actionSuccess({ shareToken: result.shareToken });
  } catch (error) {
    logger.error("Failed to regenerate study share token", {
      studyId,
      error,
    });
    return actionError(
      error instanceof Error
        ? error.message
        : "Failed to regenerate share token",
    );
  }
}

export async function handleToggleShareLink(
  studyId: string,
  enabled: boolean,
): Promise<ActionResult<{ shareToken: string | null }>> {
  try {
    const session = await isAuthenticated();

    logger.debug("Toggling study share link", {
      studyId,
      userId: session.userId,
      enabled,
    });

    const result = await toggleStudyShareLink(studyId, session.userId, enabled);

    revalidateStudyPaths(studyId);

    return actionSuccess({ shareToken: result.shareToken ?? null });
  } catch (error) {
    logger.error("Failed to toggle study share link", {
      studyId,
      enabled,
      error,
    });
    return actionError(
      error instanceof Error ? error.message : "Failed to toggle share link",
    );
  }
}

interface StudyShareInfo {
  id: string;
  visibility: StudyVisibility;
  shareToken: string | null;
  team: { id: string; name: string; companyId: string | null } | null;
}

export async function handleGetStudyShareInfo(
  studyId: string,
): Promise<ActionResult<StudyShareInfo>> {
  try {
    const session = await isAuthenticated();

    logger.debug("Getting study share info", {
      studyId,
      userId: session.userId,
    });

    const result = await getStudyShareInfo(studyId, session.userId);

    return actionSuccess(result);
  } catch (error) {
    logger.error("Failed to get study share info", {
      studyId,
      error,
    });
    return actionError(
      error instanceof Error ? error.message : "Failed to get share info",
    );
  }
}
