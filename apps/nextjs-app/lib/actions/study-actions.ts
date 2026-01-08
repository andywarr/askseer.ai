"use server";

import { StudyVisibility } from "@prisma/client";
import {
  updateStudyVisibility,
  regenerateStudyShareToken,
  getStudyShareInfo,
  toggleStudyShareLink,
} from "@/apps/nextjs-app/lib/data";
import { logger } from "@/apps/shared/logger";
import {
  ActionResult,
  actionSuccess,
  actionError,
  requireAuth,
  studyIdSchema,
  revalidateStudyPaths,
} from "@/apps/nextjs-app/lib/actions/shared";

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
    const validatedStudyId = studyIdSchema.parse(studyId);
    const user = await requireAuth();

    logger.debug("Getting study share info", {
      studyId: validatedStudyId,
      userId: user.id,
    });

    const result = await getStudyShareInfo(validatedStudyId, user.id);

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

export async function handleUpdateStudyVisibility(
  studyId: string,
  visibility: StudyVisibility,
): Promise<
  ActionResult<{ visibility: StudyVisibility; shareToken: string | null }>
> {
  try {
    const validatedStudyId = studyIdSchema.parse(studyId);
    const user = await requireAuth();

    logger.debug("Updating study visibility", {
      studyId: validatedStudyId,
      visibility,
      userId: user.id,
    });

    const result = await updateStudyVisibility(
      validatedStudyId,
      visibility,
      user.id,
    );

    revalidateStudyPaths(validatedStudyId);

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
    const validatedStudyId = studyIdSchema.parse(studyId);
    const user = await requireAuth();

    logger.debug("Regenerating study share token", {
      studyId: validatedStudyId,
      userId: user.id,
    });

    const result = await regenerateStudyShareToken(validatedStudyId, user.id);

    revalidateStudyPaths(validatedStudyId);

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
    const validatedStudyId = studyIdSchema.parse(studyId);
    const user = await requireAuth();

    logger.debug("Toggling study share link", {
      studyId: validatedStudyId,
      userId: user.id,
      enabled,
    });

    const result = await toggleStudyShareLink(
      validatedStudyId,
      user.id,
      enabled,
    );

    revalidateStudyPaths(validatedStudyId);

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
