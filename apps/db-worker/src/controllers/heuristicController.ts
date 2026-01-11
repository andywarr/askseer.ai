/**
 * Heuristic Evaluation and Cognitive Walkthrough controller handlers.
 */

import { logger } from "@/apps/shared/logger.ts";
import {
  JobEnvelopeV2Schema,
  JobEnvelopeV2_HE,
  JobEnvelopeV2_CW,
} from "@/apps/shared/jobSchema.ts";
import {
  getParam,
  requireParam,
  sendSuccess,
  sendError,
  requireBodyFields,
  normalizeRating,
  validateRating,
  requireCompanyAdmin,
  withErrorHandler,
} from "./utils.ts";
import {
  dbGetCognitiveWalkthrough,
  dbGetCWQuestion,
  dbGetHeuristics,
  dbGetHeuristicEvaluation,
  dbPostCognitiveWalkthrough,
  dbPostHeuristicEvaluation,
  dbUpdateCWIssue,
  dbUpdateCWRecommendation,
  dbUpdateHEResult,
  dbUpdateHERecommendation,
  dbDeleteCWIssue,
  dbDeleteCWRecommendation,
  dbDeleteHEResult,
  dbDeleteHERecommendation,
  dbCreateCWRecommendation,
  dbCreateHERecommendation,
  dbCreateHEResult,
  dbCreateCWIssue,
  dbGetHeuristicFamilies,
  dbGetHeuristicFamily,
  dbCreateHeuristicFamily,
  dbUpdateHeuristicFamily,
  dbDeleteHeuristicFamily,
  dbToggleHeuristicFamilyVisibility,
  dbGetHeuristic,
  dbCreateHeuristic,
  dbUpdateHeuristic,
  dbDeleteHeuristic,
  dbCreateHeuristicExample,
  dbUpdateHeuristicExample,
  dbDeleteHeuristicExample,
} from "@/apps/db-worker/src/services/index.ts";

// Type definitions
interface HERecommendation {
  recommendation: string;
}

interface ResultData {
  id: string;
  heuristic: string;
  violated: boolean;
  reason: string;
  recommendations: HERecommendation[];
  fileId: string;
  step: number;
}

interface HeuristicEvaluationData {
  studyData: JobEnvelopeV2_HE;
  results: ResultData[];
}

interface CWResultData {
  questionId: string;
  answer: string;
}

interface CWIssueData {
  issueType: string;
  issue: string;
  recommendations: Array<{ recommendation: string }>;
}

interface CWStepData {
  step: number;
  expected: boolean;
  results: Array<CWResultData>;
  issues: Array<CWIssueData>;
}

interface CognitiveWalkthroughData {
  studyData: JobEnvelopeV2_CW;
  results: CWStepData[];
}

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

// ==================== Heuristic Family Management ====================

export const getHeuristicFamilies = withErrorHandler(async (req, res) => {
  const companyId = getParam<string>(req, "companyId", "company-id");
  const families = await dbGetHeuristicFamilies(companyId || null);
  return sendSuccess(res, families);
}, "GET /heuristic-families");

export const getHeuristicFamily = withErrorHandler(async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return sendError(res, "Family ID is required");
  }

  const family = await dbGetHeuristicFamily(id);

  if (!family) {
    return sendError(res, "Heuristic family not found", 404);
  }

  return sendSuccess(res, family);
}, "GET /heuristic-families/:id");

export const createHeuristicFamily = withErrorHandler(async (req, res) => {
  const { name, key, description, companyId, userId } = req.body;

  if (!requireBodyFields(req.body || {}, ["name", "key", "companyId", "userId"], res)) {
    return;
  }

  if (!(await requireCompanyAdmin(companyId, userId, res, "create heuristic families"))) {
    return;
  }

  const family = await dbCreateHeuristicFamily({
    name,
    key,
    description,
    companyId,
    createdById: userId,
  });

  return sendSuccess(res, family, 201);
}, "POST /heuristic-families");

export const updateHeuristicFamily = withErrorHandler(async (req, res) => {
  const { id } = req.params;
  const { name, description, userId, companyId } = req.body;

  if (!requireBodyFields(req.body || {}, ["userId", "companyId"], res)) {
    return;
  }

  if (!(await requireCompanyAdmin(companyId, userId, res, "update heuristic families"))) {
    return;
  }

  const family = await dbUpdateHeuristicFamily(id, { name, description });
  return sendSuccess(res, family);
}, "PATCH /heuristic-families/:id");

export const deleteHeuristicFamily = withErrorHandler(async (req, res) => {
  const { id } = req.params;
  const { userId, companyId } = req.body;

  if (!requireBodyFields(req.body || {}, ["userId", "companyId"], res)) {
    return;
  }

  if (!(await requireCompanyAdmin(companyId, userId, res, "delete heuristic families"))) {
    return;
  }

  await dbDeleteHeuristicFamily(id, companyId);
  return sendSuccess(res);
}, "DELETE /heuristic-families/:id");

export const toggleHeuristicFamilyVisibility = withErrorHandler(async (req, res) => {
  const { id } = req.params;
  const { isHidden, userId, companyId } = req.body;

  if (!userId || !companyId || typeof isHidden !== "boolean") {
    return sendError(res, "userId, companyId, and isHidden are required");
  }

  if (!(await requireCompanyAdmin(companyId, userId, res, "toggle visibility"))) {
    return;
  }

  const visibility = await dbToggleHeuristicFamilyVisibility(id, companyId, isHidden);
  return sendSuccess(res, visibility);
}, "POST /heuristic-families/:id/visibility");

// ==================== Individual Heuristic CRUD ====================

export const getHeuristic = withErrorHandler(async (req, res) => {
  const { id } = req.params;
  const companyId = getParam<string>(req, "companyId", "company-id");

  if (!id) {
    return sendError(res, "Heuristic ID is required");
  }

  const heuristic = await dbGetHeuristic(id, companyId || null);

  if (!heuristic) {
    return sendError(res, "Heuristic not found", 404);
  }

  return sendSuccess(res, heuristic);
}, "GET /heuristics/:id");

export const createHeuristic = withErrorHandler(async (req, res) => {
  const {
    heuristicFamilyId,
    category,
    label,
    heuristic,
    description,
    userId,
    companyId,
  } = req.body;

  if (!requireBodyFields(req.body || {}, ["heuristicFamilyId", "heuristic", "userId", "companyId"], res)) {
    return;
  }

  if (!(await requireCompanyAdmin(companyId, userId, res, "create heuristics"))) {
    return;
  }

  const newHeuristic = await dbCreateHeuristic({
    heuristicFamilyId,
    category,
    label,
    heuristic,
    description,
    companyId,
    createdById: userId,
  });

  return sendSuccess(res, newHeuristic, 201);
}, "POST /heuristics");

export const updateHeuristic = withErrorHandler(async (req, res) => {
  const { id } = req.params;
  const { category, label, heuristic, description, userId, companyId } = req.body;

  if (!requireBodyFields(req.body || {}, ["userId", "companyId"], res)) {
    return;
  }

  if (!(await requireCompanyAdmin(companyId, userId, res, "update heuristics"))) {
    return;
  }

  const updatedHeuristic = await dbUpdateHeuristic(id, {
    category,
    label,
    heuristic,
    description,
    companyId,
  });

  return sendSuccess(res, updatedHeuristic);
}, "PATCH /heuristics/:id");

export const deleteHeuristic = withErrorHandler(async (req, res) => {
  const { id } = req.params;
  const { userId, companyId } = req.body;

  if (!requireBodyFields(req.body || {}, ["userId", "companyId"], res)) {
    return;
  }

  if (!(await requireCompanyAdmin(companyId, userId, res, "delete heuristics"))) {
    return;
  }

  await dbDeleteHeuristic(id, companyId);
  return sendSuccess(res);
}, "DELETE /heuristics/:id");

// ==================== Heuristic Examples CRUD ====================

export const createHeuristicExample = withErrorHandler(async (req, res) => {
  const { heuristicId, title, description, userId, companyId, createdById } = req.body;

  if (!requireBodyFields(req.body || {}, ["heuristicId", "description", "userId", "companyId"], res)) {
    return;
  }

  if (!(await requireCompanyAdmin(companyId, userId, res, "create heuristic examples"))) {
    return;
  }

  const example = await dbCreateHeuristicExample({
    heuristicId,
    title,
    description,
    companyId,
    createdById: createdById || userId,
  });

  return sendSuccess(res, example, 201);
}, "POST /heuristic-examples");

export const updateHeuristicExample = withErrorHandler(async (req, res) => {
  const { id } = req.params;
  const { title, description, userId, companyId } = req.body;

  if (!requireBodyFields(req.body || {}, ["userId", "companyId"], res)) {
    return;
  }

  if (!(await requireCompanyAdmin(companyId, userId, res, "update heuristic examples"))) {
    return;
  }

  const example = await dbUpdateHeuristicExample(id, {
    title,
    description,
    companyId,
  });

  return sendSuccess(res, example);
}, "PATCH /heuristic-examples/:id");

export const deleteHeuristicExample = withErrorHandler(async (req, res) => {
  const { id } = req.params;
  const { userId, companyId } = req.body;

  if (!requireBodyFields(req.body || {}, ["userId", "companyId"], res)) {
    return;
  }

  if (!(await requireCompanyAdmin(companyId, userId, res, "delete heuristic examples"))) {
    return;
  }

  await dbDeleteHeuristicExample(id, companyId);
  return sendSuccess(res);
}, "DELETE /heuristic-examples/:id");
