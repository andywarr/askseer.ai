/**
 * Cognitive Walkthrough controller handlers.
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
  dbGetCognitiveWalkthrough,
  dbGetCWQuestion,
  dbPostCognitiveWalkthrough,
  dbUpdateCWIssue,
  dbUpdateCWRecommendation,
  dbDeleteCWIssue,
  dbDeleteCWRecommendation,
  dbCreateCWRecommendation,
  dbCreateCWIssue,
} from "@/apps/db-worker/src/services/index.ts";

import type { CognitiveWalkthroughData } from "@/apps/db-worker/src/services/shared/types.ts";

// ==================== Cognitive Walkthrough Endpoints ====================

export const getCWQuestion = withErrorHandler(async (req, res) => {
  const versionRaw = getParam(req, "version");
  const version = Number(versionRaw);

  if (!versionRaw) {
    return sendError(res, "Cognitive walkthrough question version is required");
  }

  if (isNaN(version)) {
    return sendError(res, "Cognitive walkthrough question version must be a number");
  }

  const data = await dbGetCWQuestion(version);
  return sendSuccess(res, data);
}, "GET /cw-questions");

export const getCognitiveWalkthrough = withErrorHandler(async (req, res) => {
  const studyId = requireParam(req, res, "studyId", "Study ID", "study-id");
  if (!studyId) return;

  const userId = requireParam(req, res, "userId", "User ID", "user-id");
  if (!userId) return;

  const data = await dbGetCognitiveWalkthrough(studyId, userId);
  sendSuccess(res, data);
}, "GET /cognitiveWalkthrough");

export const postCognitiveWalkthrough = withErrorHandler(async (req, res) => {
  const data: CognitiveWalkthroughData = req.body;
  const parsed = JobEnvelopeV2Schema.safeParse(data?.studyData);
  if (!parsed.success) {
    logger.warn("POST /cognitive-walkthrough invalid v2 jobData", {
      issues: parsed.error.issues,
    });
    return sendError(res, "Invalid jobData");
  }

  if (!data) {
    return sendError(res, "There is no data to process");
  }

  await dbPostCognitiveWalkthrough(data);
  return sendSuccess(res);
}, "POST /cognitive-walkthrough");

// ==================== CW Issue/Recommendation CRUD ====================

export const updateCWIssue = withErrorHandler(async (req, res) => {
  const { id } = req.params;
  const { issue, severity, rating, userId } = req.body;
  const normalizedRating = normalizeRating(rating);

  if (!validateRating(normalizedRating, res)) return;

  if (!id) {
    return sendError(res, "Issue ID is required");
  }

  if (issue === undefined && severity === undefined && rating === undefined) {
    return sendError(res, "Issue, severity, or rating is required");
  }

  const data = await dbUpdateCWIssue(id, issue, severity, normalizedRating, userId);
  return sendSuccess(res, data);
}, "PUT /cw-issue");

export const updateCWRecommendation = withErrorHandler(async (req, res) => {
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

  const data = await dbUpdateCWRecommendation(id, recommendation, normalizedRating, userId);
  return sendSuccess(res, data);
}, "PUT /cw-recommendation");

export const deleteCWIssue = withErrorHandler(async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  if (!id) {
    return sendError(res, "Issue ID is required");
  }

  const data = await dbDeleteCWIssue(id, userId);
  return sendSuccess(res, data);
}, "DELETE /cw-issue");

export const deleteCWRecommendation = withErrorHandler(async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  if (!id) {
    return sendError(res, "Recommendation ID is required");
  }

  const data = await dbDeleteCWRecommendation(id, userId);
  return sendSuccess(res, data);
}, "DELETE /cw-recommendation");

export const createCWRecommendation = withErrorHandler(async (req, res) => {
  const { issueId, recommendation, source, userId } = req.body;

  if (!requireBodyFields(req.body || {}, ["issueId", "recommendation", "source"], res)) {
    return;
  }

  const data = await dbCreateCWRecommendation(issueId, recommendation, source, userId);
  return sendSuccess(res, data, 201);
}, "POST /cw-recommendation");

export const createCWIssue = withErrorHandler(async (req, res) => {
  const { stepId, issueType, issue, source, userId } = req.body;

  if (!requireBodyFields(req.body || {}, ["stepId", "issueType", "issue", "source"], res)) {
    return;
  }

  const result = await dbCreateCWIssue({ stepId, issueType, issue, source, userId });
  return sendSuccess(res, result);
}, "POST /cw-issue");
