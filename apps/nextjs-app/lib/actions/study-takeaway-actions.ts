"use server";

import { revalidatePath } from "next/cache";

import {
  updateTakeaway,
  deleteTakeaway,
  updateTakeawayRecommendation,
  deleteTakeawayRecommendation,
  createTakeawayRecommendation,
  createTakeaway,
  reorderTakeaways,
} from "@/apps/nextjs-app/lib/db/data";
import { actionError, actionSuccess, ActionResult, requireAuth } from "./shared";

export async function updateStudyTakeawayAction(
  takeawayId: string,
  data: { title?: string; description?: string },
  studyId: string,
): Promise<ActionResult> {
  try {
    const session = await requireAuth();
    await updateTakeaway(takeawayId, data, session.id);
    // revalidatePath(`/study/${studyId}`); // Disabled to prevent image flickering
    return actionSuccess();
  } catch (error) {
    return actionError(
      error instanceof Error ? error.message : "Failed to update takeaway",
    );
  }
}

export async function deleteStudyTakeawayAction(
  takeawayId: string,
  studyId: string,
): Promise<ActionResult> {
  try {
    const session = await requireAuth();
    await deleteTakeaway(takeawayId, session.id);
    // revalidatePath(`/study/${studyId}`); // Disabled to prevent image flickering
    return actionSuccess();
  } catch (error) {
    return actionError(
      error instanceof Error ? error.message : "Failed to delete takeaway",
    );
  }
}

export async function updateTakeawayRecommendationAction(
  recommendationId: string,
  text: string,
  studyId: string,
): Promise<ActionResult> {
  try {
    const session = await requireAuth();
    await updateTakeawayRecommendation(recommendationId, { text }, session.id);
    // revalidatePath(`/study/${studyId}`); // Disabled to prevent image flickering
    return actionSuccess();
  } catch (error) {
    return actionError(
      error instanceof Error
        ? error.message
        : "Failed to update recommendation",
    );
  }
}

export async function deleteTakeawayRecommendationAction(
  recommendationId: string,
  studyId: string,
): Promise<ActionResult> {
  try {
    const session = await requireAuth();
    await deleteTakeawayRecommendation(recommendationId, session.id);
    // revalidatePath(`/study/${studyId}`); // Disabled to prevent image flickering
    return actionSuccess();
  } catch (error) {
    return actionError(
      error instanceof Error
        ? error.message
        : "Failed to delete recommendation",
    );
  }
}

export async function createTakeawayRecommendationAction(
  takeawayId: string,
  text: string,
  studyId: string,
): Promise<ActionResult<{ id: string; sortOrder: number; text: string; source: string }>> {
  try {
    const session = await requireAuth();
    const result = await createTakeawayRecommendation(takeawayId, text, session.id);
    // revalidatePath(`/study/${studyId}`); // Disabled to prevent image flickering
    return actionSuccess(result.data);
  } catch (error) {
    return actionError(
      error instanceof Error
        ? error.message
        : "Failed to create recommendation",
    );
  }
}

interface CreatedTakeaway {
  id: string;
  sortOrder: number;
  title: string;
  description: string;
  source: string;
  recommendations: Array<{ id: string; sortOrder: number; text: string; source: string }>;
}

export async function createStudyTakeawayAction(
  studyId: string,
  data: { title: string; description: string },
): Promise<ActionResult<CreatedTakeaway>> {
  try {
    const session = await requireAuth();
    const result = await createTakeaway(studyId, data, session.id);
    return actionSuccess(result.data);
  } catch (error) {
    return actionError(
      error instanceof Error
        ? error.message
        : "Failed to create takeaway",
    );
  }
}

export async function reorderStudyTakeawaysAction(
  studyId: string,
  orderedIds: string[],
): Promise<ActionResult> {
  try {
    const session = await requireAuth();
    await reorderTakeaways(studyId, orderedIds, session.id);
    return actionSuccess();
  } catch (error) {
    return actionError(
      error instanceof Error
        ? error.message
        : "Failed to reorder takeaways",
    );
  }
}
