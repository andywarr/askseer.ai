/**
 * Heuristic Evaluation controller handlers.
 */

import { logger } from "@/apps/shared/logger.ts";
import { JobEnvelopeV2Schema } from "@/apps/shared/jobSchema.ts";
import {
  getParam,
  requireParam,
  sendSuccess,
  sendError,
  requireBodyFields,
  normalizeRating,
  validateRating,
  withErrorHandler,
} from "./utils.ts";
import {
  dbGetHeuristics,
  dbGetHeuristicEvaluation,
  dbPostHeuristicEvaluation,
  dbUpdateHEResult,
  dbUpdateHERecommendation,
  dbDeleteHEResult,
  dbDeleteHERecommendation,
  dbCreateHERecommendation,
  dbCreateHEResult,
} from "@/apps/db-worker/src/services/index.ts";

import type { HeuristicEvaluationData } from "@/apps/db-worker/src/services/shared/types.ts";

// ==================== Heuristic Evaluation Endpoints ====================

export const getHeuristics = withErrorHandler(async (req, res) => {
  const familyKey = getParam<string>(req, "type");
  const familyId = getParam<string>(req, "familyId", "family-id");
  const companyId = getParam<string>(req, "companyId", "company-id");

  if (!familyKey && !familyId) {
    return sendError(res, "Heuristic family key or id is required");
  }

  const data = await dbGetHeuristics(familyKey, familyId, companyId);
  return sendSuccess(res, data);
}, "GET /heuristics");

export const getHeuristicEvaluation = withErrorHandler(async (req, res) => {
  const studyId = requireParam(req, res, "studyId", "Study ID", "study-id");
  if (!studyId) return;

  const userId = requireParam(req, res, "userId", "User ID", "user-id");
  if (!userId) return;

  const data = await dbGetHeuristicEvaluation(studyId, userId);
  sendSuccess(res, data);
}, "GET /heuristicEvaluation");

export const postHeuristicEvaluation = withErrorHandler(async (req, res) => {
  const data: HeuristicEvaluationData = req.body;
  const parsed = JobEnvelopeV2Schema.safeParse(data?.studyData);
  if (!parsed.success) {
    logger.warn("POST /heuristic-evaluation invalid v2 jobData", {
      issues: parsed.error.issues,
    });
    return sendError(res, "Invalid jobData");
  }

  if (!data) {
    return sendError(res, "There is no data to process");
  }

  await dbPostHeuristicEvaluation(data);
  return sendSuccess(res);
}, "POST /heuristic-evaluation");

// ==================== HE Result/Recommendation CRUD ====================

export const updateHEResult = withErrorHandler(async (req, res) => {
  const { id } = req.params;
  const { issue, severity, rating, userId } = req.body;
  const normalizedRating = normalizeRating(rating);

  if (!validateRating(normalizedRating, res)) return;

  if (!id) {
    return sendError(res, "Result ID is required");
  }

  if (issue === undefined && severity === undefined && rating === undefined) {
    return sendError(res, "Result reason, severity, or rating is required");
  }

  const data = await dbUpdateHEResult(id, issue, severity, normalizedRating, userId);
  return sendSuccess(res, data);
}, "PUT /he-result");

export const updateHERecommendation = withErrorHandler(async (req, res) => {
  const { id } = req.params;
  const { recommendation, rating, userId } = req.body;
  const normalizedRating = normalizeRating(rating);

  if (!validateRating(normalizedRating, res)) return;

  if (!id) {
    return sendError(res, "Recommendation ID is required");
  }

  if (recommendation === undefined && rating === undefined) {
    return sendError(res, "Recommendation or rating is required");
  }

  const data = await dbUpdateHERecommendation(id, recommendation, normalizedRating, userId);
  return sendSuccess(res, data);
}, "PUT /he-recommendation");

export const deleteHEResult = withErrorHandler(async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  if (!id) {
    return sendError(res, "Result ID is required");
  }

  const data = await dbDeleteHEResult(id, userId);
  return sendSuccess(res, data);
}, "DELETE /he-result");

export const deleteHERecommendation = withErrorHandler(async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  if (!id) {
    return sendError(res, "Recommendation ID is required");
  }

  const data = await dbDeleteHERecommendation(id, userId);
  return sendSuccess(res, data);
}, "DELETE /he-recommendation");

export const createHERecommendation = withErrorHandler(async (req, res) => {
  const { resultId, recommendation, source, userId } = req.body;

  if (!requireBodyFields(req.body || {}, ["resultId", "recommendation", "source"], res)) {
    return;
  }

  const data = await dbCreateHERecommendation(resultId, recommendation, source, userId);
  return sendSuccess(res, data, 201);
}, "POST /he-recommendation");

export const createHEResult = withErrorHandler(async (req, res) => {
  const {
    heuristicEvaluationId,
    heuristicId,
    step,
    fileId,
    reason,
    severity,
    source,
    userId,
  } = req.body;

  if (
    !heuristicEvaluationId ||
    !heuristicId ||
    !step ||
    !fileId ||
    !reason ||
    severity === undefined ||
    severity === null ||
    !source
  ) {
    return sendError(res, "Missing required fields");
  }

  const result = await dbCreateHEResult({
    heuristicEvaluationId,
    heuristicId,
    step,
    fileId,
    reason,
    severity,
    source,
    userId,
  });
  return sendSuccess(res, result);
}, "POST /he-result");
