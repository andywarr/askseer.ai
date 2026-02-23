/**
 * Qualitative Analysis controller handlers.
 */

import { logger } from "@/apps/shared/logger.ts";
import { JobEnvelopeV2Schema } from "@/apps/shared/jobSchema.ts";
import {
  requireParam,
  requireBodyFields,
  sendSuccess,
  sendError,
  withErrorHandler,
} from "./utils.ts";

import {
  dbPostQualitativeAnalysis,
  dbGetQualitativeAnalysis,
  dbUpdateQualitativeAnalysisSummary,
  dbUpdateAnalysisInsight,
  dbDeleteAnalysisQuote,
  dbAddAnalysisTag,
  dbDeleteAnalysisTag,
  dbDeleteAnalysisInsight,
  dbAddAnalysisQuote,
  dbAddAnalysisInsight,
} from "@/apps/db-worker/src/services/index.ts";

import type { QualitativeAnalysisData } from "@/apps/db-worker/src/services/shared/types.ts";

// ==================== Qualitative Analysis Endpoints ====================

export const getQualitativeAnalysis = withErrorHandler(async (req, res) => {
  const studyId = requireParam(req, res, "studyId", "Study ID", "study-id");
  if (!studyId) return;

  const userId = requireParam(req, res, "userId", "User ID", "user-id");
  if (!userId) return;

  const data = await dbGetQualitativeAnalysis(studyId, userId);
  sendSuccess(res, data);
}, "GET /qualitative-analysis");

export const postQualitativeAnalysis = withErrorHandler(async (req, res) => {
  const data: QualitativeAnalysisData = req.body;
  const parsed = JobEnvelopeV2Schema.safeParse(data?.studyData);
  if (!parsed.success) {
    logger.warn("POST /qualitative-analysis invalid v2 jobData", {
      issues: parsed.error.issues,
    });
    return sendError(res, "Invalid jobData");
  }

  if (!data || !data.result) {
    return sendError(res, "There is no data to process");
  }

  await dbPostQualitativeAnalysis(data);
  return sendSuccess(res);
}, "POST /qualitative-analysis");

export const patchQualitativeAnalysisSummary = withErrorHandler(
  async (req, res) => {
    const { qualitativeAnalysisId, summary, userId } = req.body || {};

    if (
      !requireBodyFields(
        req.body || {},
        ["qualitativeAnalysisId", "userId"],
        res,
      )
    ) {
      return;
    }

    const data = await dbUpdateQualitativeAnalysisSummary(
      qualitativeAnalysisId,
      summary ?? "",
      userId,
    );
    sendSuccess(res, data);
  },
  "PATCH /qualitative-analysis/summary",
);

export const patchAnalysisInsight = withErrorHandler(async (req, res) => {
  const { insightId, fields, userId } = req.body || {};

  if (
    !requireBodyFields(req.body || {}, ["insightId", "fields", "userId"], res)
  ) {
    return;
  }

  const data = await dbUpdateAnalysisInsight(insightId, fields, userId);
  sendSuccess(res, data);
}, "PATCH /qualitative-analysis/insight");

export const deleteAnalysisQuote = withErrorHandler(async (req, res) => {
  const { quoteId, userId } = req.body || {};

  if (!requireBodyFields(req.body || {}, ["quoteId", "userId"], res)) {
    return;
  }

  const data = await dbDeleteAnalysisQuote(quoteId, userId);
  sendSuccess(res, data);
}, "DELETE /qualitative-analysis/quote");

export const postAnalysisTag = withErrorHandler(async (req, res) => {
  const { insightId, tag, userId } = req.body || {};

  if (!requireBodyFields(req.body || {}, ["insightId", "tag", "userId"], res)) {
    return;
  }

  const data = await dbAddAnalysisTag(insightId, tag, userId);
  sendSuccess(res, data);
}, "POST /qualitative-analysis/tag");

export const deleteAnalysisTag = withErrorHandler(async (req, res) => {
  const { tagId, userId } = req.body || {};

  if (!requireBodyFields(req.body || {}, ["tagId", "userId"], res)) {
    return;
  }

  const data = await dbDeleteAnalysisTag(tagId, userId);
  sendSuccess(res, data);
}, "DELETE /qualitative-analysis/tag");

export const deleteAnalysisInsight = withErrorHandler(async (req, res) => {
  const { insightId, userId } = req.body || {};

  if (!requireBodyFields(req.body || {}, ["insightId", "userId"], res)) {
    return;
  }

  const data = await dbDeleteAnalysisInsight(insightId, userId);
  sendSuccess(res, data);
}, "DELETE /qualitative-analysis/insight");

export const postAnalysisQuote = withErrorHandler(async (req, res) => {
  const { insightId, quote, userId, participant, sourceFileId, timestamp } =
    req.body || {};

  if (
    !requireBodyFields(req.body || {}, ["insightId", "quote", "userId"], res)
  ) {
    return;
  }

  const data = await dbAddAnalysisQuote(
    insightId,
    quote,
    userId,
    participant,
    sourceFileId,
    timestamp,
  );
  sendSuccess(res, data);
}, "POST /qualitative-analysis/quote");

export const postAnalysisInsight = withErrorHandler(async (req, res) => {
  const { qualitativeAnalysisId, fields, userId, quotes } = req.body || {};

  if (
    !requireBodyFields(
      req.body || {},
      ["qualitativeAnalysisId", "fields", "userId"],
      res,
    )
  ) {
    return;
  }

  const data = await dbAddAnalysisInsight(
    qualitativeAnalysisId,
    fields,
    userId,
    quotes,
  );
  sendSuccess(res, data);
}, "POST /qualitative-analysis/insight");
