"use server";

import {
  updateQualitativeAnalysisSummary,
  updateAnalysisInsight,
  deleteAnalysisQuote,
  addAnalysisTag,
  removeAnalysisTag,
  deleteAnalysisInsight,
  addAnalysisQuote,
  addAnalysisInsight,
} from "@/apps/nextjs-app/lib/db/data";
import { logger } from "@/apps/shared/logger";
import { actionSuccess, actionError, ActionResult } from "./shared";
import { revalidatePath } from "next/cache";

/**
 * Updates the summary of a qualitative analysis.
 */
export async function handleUpdateAnalysisSummary(
  qualitativeAnalysisId: string,
  summary: string,
  userId: string,
  studyId: string,
): Promise<ActionResult> {
  try {
    logger.debug("Updating analysis summary", {
      qualitativeAnalysisId,
      userId,
      summaryLength: summary.length,
    });

    await updateQualitativeAnalysisSummary(
      qualitativeAnalysisId,
      summary,
      userId,
    );

    revalidatePath(`/analysis/${studyId}`);

    logger.info("Successfully updated analysis summary", {
      qualitativeAnalysisId,
      userId,
    });
    return actionSuccess();
  } catch (error) {
    logger.error("Failed to update analysis summary", {
      qualitativeAnalysisId,
      userId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return actionError("Failed to update summary");
  }
}

/**
 * Updates fields of an analysis insight.
 */
export async function handleUpdateAnalysisInsight(
  insightId: string,
  fields: {
    title?: string;
    observation?: string;
    motivation?: string;
    implication?: string;
    insightStatement?: string;
    severity?: number;
  },
  userId: string,
  studyId: string,
): Promise<ActionResult> {
  try {
    logger.debug("Updating analysis insight", {
      insightId,
      userId,
      fields: Object.keys(fields),
    });

    await updateAnalysisInsight(insightId, fields, userId);

    revalidatePath(`/analysis/${studyId}`);

    logger.info("Successfully updated analysis insight", {
      insightId,
      userId,
    });
    return actionSuccess();
  } catch (error) {
    logger.error("Failed to update analysis insight", {
      insightId,
      userId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return actionError("Failed to update insight");
  }
}

/**
 * Deletes a quote from an analysis insight.
 */
export async function handleDeleteAnalysisQuote(
  quoteId: string,
  userId: string,
  studyId: string,
): Promise<ActionResult> {
  try {
    logger.debug("Deleting analysis quote", {
      quoteId,
      userId,
    });

    await deleteAnalysisQuote(quoteId, userId);

    revalidatePath(`/analysis/${studyId}`);

    logger.info("Successfully deleted analysis quote", {
      quoteId,
      userId,
    });
    return actionSuccess();
  } catch (error) {
    logger.error("Failed to delete analysis quote", {
      quoteId,
      userId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return actionError("Failed to delete quote");
  }
}

/**
 * Adds a tag to an analysis insight.
 */
export async function handleAddAnalysisTag(
  insightId: string,
  tag: string,
  userId: string,
  studyId: string,
): Promise<ActionResult<{ id: string; tag: string }>> {
  try {
    logger.debug("Adding analysis tag", {
      insightId,
      tag,
      userId,
    });

    const data = await addAnalysisTag(insightId, tag, userId);

    revalidatePath(`/analysis/${studyId}`);

    logger.info("Successfully added analysis tag", {
      insightId,
      tag,
      userId,
    });
    return actionSuccess(data);
  } catch (error) {
    logger.error("Failed to add analysis tag", {
      insightId,
      tag,
      userId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return actionError("Failed to add tag");
  }
}

/**
 * Removes a tag from an analysis insight.
 */
export async function handleRemoveAnalysisTag(
  tagId: string,
  userId: string,
  studyId: string,
): Promise<ActionResult> {
  try {
    logger.debug("Removing analysis tag", {
      tagId,
      userId,
    });

    await removeAnalysisTag(tagId, userId);

    revalidatePath(`/analysis/${studyId}`);

    logger.info("Successfully removed analysis tag", {
      tagId,
      userId,
    });
    return actionSuccess();
  } catch (error) {
    logger.error("Failed to remove analysis tag", {
      tagId,
      userId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return actionError("Failed to remove tag");
  }
}

/**
 * Deletes an analysis insight and all its related data.
 */
export async function handleDeleteAnalysisInsight(
  insightId: string,
  userId: string,
  studyId: string,
): Promise<ActionResult> {
  try {
    logger.debug("Deleting analysis insight", {
      insightId,
      userId,
    });

    await deleteAnalysisInsight(insightId, userId);

    revalidatePath(`/analysis/${studyId}`);

    logger.info("Successfully deleted analysis insight", {
      insightId,
      userId,
    });
    return actionSuccess();
  } catch (error) {
    logger.error("Failed to delete analysis insight", {
      insightId,
      userId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return actionError("Failed to delete insight");
  }
}

/**
 * Adds a quote to an analysis insight.
 */
export async function handleAddAnalysisQuote(
  insightId: string,
  quote: string,
  userId: string,
  studyId: string,
  participant?: string,
  sourceFileId?: string,
  timestamp?: string,
): Promise<
  ActionResult<{
    id: string;
    quote: string;
    participant?: string | null;
    sourceFileId?: string | null;
    timestamp?: string | null;
  }>
> {
  try {
    logger.debug("Adding analysis quote", {
      insightId,
      userId,
      quoteLength: quote.length,
    });

    const data = await addAnalysisQuote(
      insightId,
      quote,
      userId,
      participant,
      sourceFileId,
      timestamp,
    );

    revalidatePath(`/analysis/${studyId}`);

    logger.info("Successfully added analysis quote", {
      insightId,
      quoteId: data?.id,
      userId,
    });
    return actionSuccess(data);
  } catch (error) {
    logger.error("Failed to add analysis quote", {
      insightId,
      userId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return actionError("Failed to add quote");
  }
}

/**
 * Creates a new analysis insight with optional quotes.
 */
export async function handleAddAnalysisInsight(
  qualitativeAnalysisId: string,
  fields: {
    title: string;
    insightStatement: string;
    observation: string;
    motivation: string;
    implication: string;
    severity?: number;
  },
  userId: string,
  studyId: string,
  quotes?: { quote: string; participant?: string; sourceFileId?: string }[],
): Promise<
  ActionResult<{
    id: string;
    title: string;
    observation: string;
    motivation: string;
    implication: string;
    insightStatement: string;
    source: string;
    quotes: {
      id: string;
      quote: string;
      participant?: string | null;
      sourceFileId?: string | null;
      timestamp?: string | null;
    }[];
    tags: { id: string; tag: string }[];
    createdAt: string;
  }>
> {
  try {
    logger.debug("Creating analysis insight", {
      qualitativeAnalysisId,
      userId,
      title: fields.title,
      quoteCount: quotes?.length || 0,
    });

    const data = await addAnalysisInsight(
      qualitativeAnalysisId,
      fields,
      userId,
      quotes,
    );

    revalidatePath(`/analysis/${studyId}`);

    logger.info("Successfully created analysis insight", {
      qualitativeAnalysisId,
      insightId: data?.id,
      userId,
    });
    return actionSuccess(data);
  } catch (error) {
    logger.error("Failed to create analysis insight", {
      qualitativeAnalysisId,
      userId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return actionError("Failed to create insight");
  }
}
