"use server";

import { revalidatePath } from "next/cache";
import { StudyVisibility } from "@prisma/client";
import {
  updateStudyVisibility,
  regenerateStudyShareToken,
  getStudyShareInfo,
} from "@/apps/nextjs-app/lib/data";
import { isAuthenticated } from "@/apps/nextjs-app/lib/dal";
import { logger } from "@/apps/shared/logger";

export async function handleUpdateStudyVisibility(
  studyId: string,
  visibility: StudyVisibility,
): Promise<{
  success: boolean;
  visibility?: StudyVisibility;
  shareToken?: string | null;
  error?: string;
}> {
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

    revalidatePath("/studies");
    revalidatePath(`/walkthrough/${studyId}`);
    revalidatePath(`/evaluation/${studyId}`);
    revalidatePath(`/persona/${studyId}`);

    return {
      success: true,
      visibility: result.visibility,
      shareToken: result.shareToken,
    };
  } catch (error) {
    logger.error("Failed to update study visibility", {
      studyId,
      visibility,
      error,
    });
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to update visibility",
    };
  }
}

export async function handleRegenerateShareToken(
  studyId: string,
): Promise<{ success: boolean; shareToken?: string; error?: string }> {
  try {
    const session = await isAuthenticated();

    logger.debug("Regenerating study share token", {
      studyId,
      userId: session.userId,
    });

    const result = await regenerateStudyShareToken(studyId, session.userId);

    return {
      success: true,
      shareToken: result.shareToken,
    };
  } catch (error) {
    logger.error("Failed to regenerate study share token", {
      studyId,
      error,
    });
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to regenerate share token",
    };
  }
}

export async function handleGetStudyShareInfo(studyId: string): Promise<{
  success: boolean;
  data?: {
    id: string;
    visibility: StudyVisibility;
    shareToken: string | null;
    team: { id: string; name: string; companyId: string | null } | null;
  };
  error?: string;
}> {
  try {
    const session = await isAuthenticated();

    logger.debug("Getting study share info", {
      studyId,
      userId: session.userId,
    });

    const result = await getStudyShareInfo(studyId, session.userId);

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    logger.error("Failed to get study share info", {
      studyId,
      error,
    });
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to get share info",
    };
  }
}
