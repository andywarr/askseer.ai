/**
 * Heuristic Evaluation and Cognitive Walkthrough controller handlers.
 */
import type { NextFunction, Request, Response } from "express";
import { logger } from "@/apps/shared/logger.ts";
import {
  JobEnvelopeV2Schema,
  JobEnvelopeV2_HE,
  JobEnvelopeV2_CW,
} from "@/apps/shared/jobSchema.ts";
import {
  getParam,
  requireParam,
  handleServiceError,
  sendSuccess,
  sendError,
  requireBodyFields,
  normalizeRating,
  validateRating,
  requireCompanyAdmin,
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
} from "@/apps/db-worker/src/services/databaseService.ts";

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

export const getCWQuestion = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const versionRaw = getParam(req, "version");
    const version = Number(versionRaw);

    if (!versionRaw) {
      logger.warn("GET /cw-questions request rejected: missing version");
      return sendError(
        res,
        "Cognitive walkthrough question version is required"
      );
    }

    if (isNaN(version)) {
      logger.warn("GET /cw-questions request rejected: invalid version", {
        version: versionRaw,
      });
      return sendError(
        res,
        "Cognitive walkthrough question version must be a number"
      );
    }

    logger.debug("GET /cw-questions request received", { version });
    const data = await dbGetCWQuestion(version);
    logger.debug("GET /cw-questions request completed", {
      version,
      questionCount: data.length,
    });
    return sendSuccess(res, data);
  } catch (error) {
    handleServiceError(error, res, next, "GET /cw-questions request");
    return;
  }
};

export const getCognitiveWalkthrough = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const studyId = requireParam(req, res, "studyId", "Study ID", "study-id");
    if (!studyId) return;

    const userId = requireParam(req, res, "userId", "User ID", "user-id");
    if (!userId) return;

    const data = await dbGetCognitiveWalkthrough(studyId, userId);
    logger.debug("GET /cognitiveWalkthrough request completed", {
      studyId,
      userId,
      found: !!data,
    });
    sendSuccess(res, data);
  } catch (error) {
    handleServiceError(error, res, next, "GET /cognitiveWalkthrough request");
  }
};

export const postCognitiveWalkthrough = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const data: CognitiveWalkthroughData = req.body;
    // Require v2 envelope and validate
    const parsed = JobEnvelopeV2Schema.safeParse(data?.studyData);
    if (!parsed.success) {
      logger.warn("POST /cognitive-walkthrough invalid v2 jobData", {
        issues: parsed.error.issues,
      });
      return sendError(res, "Invalid jobData");
    }

    if (!data) {
      logger.warn(
        "POST /cognitive-walkthrough request rejected: no data provided"
      );
      return sendError(res, "There is no data to process");
    }

    logger.debug("POST /cognitive-walkthrough request received", {
      studyId: data.studyData?.studyId,
      resultCount: data.results?.length,
    });
    await dbPostCognitiveWalkthrough(data);
    logger.debug("POST /cognitive-walkthrough request completed", {
      studyId: data.studyData?.studyId,
    });
    return sendSuccess(res);
  } catch (error) {
    handleServiceError(error, res, next, "POST /cognitive-walkthrough request");
    return;
  }
};

// ==================== Heuristic Evaluation Endpoints ====================

export const getHeuristics = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const familyKey = getParam<string>(req, "type");
    const familyId = getParam<string>(req, "familyId", "family-id");
    const companyId = getParam<string>(req, "companyId", "company-id");

    if (!familyKey && !familyId) {
      logger.warn("GET /heuristics request rejected: missing family key or id");
      return sendError(res, "Heuristic family key or id is required");
    }

    logger.debug("GET /heuristics request received", {
      familyKey,
      familyId,
      companyId,
    });

    const data = await dbGetHeuristics(familyKey, familyId, companyId);

    logger.debug("GET /heuristics request completed", {
      familyKey,
      familyId,
      heuristicCount: data.length,
    });
    return sendSuccess(res, data);
  } catch (error) {
    handleServiceError(error, res, next, "GET /heuristics request");
    return;
  }
};

export const getHeuristicEvaluation = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const studyId = requireParam(req, res, "studyId", "Study ID", "study-id");
    if (!studyId) return;

    const userId = requireParam(req, res, "userId", "User ID", "user-id");
    if (!userId) return;

    const data = await dbGetHeuristicEvaluation(studyId, userId);
    logger.debug("GET /heuristicEvaluation request completed", {
      studyId,
      userId,
      found: !!data,
    });
    sendSuccess(res, data);
  } catch (error) {
    handleServiceError(error, res, next, "GET /heuristicEvaluation request");
  }
};

export const postHeuristicEvaluation = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const data: HeuristicEvaluationData = req.body;
    // Require v2 envelope and validate
    const parsed = JobEnvelopeV2Schema.safeParse(data?.studyData);
    if (!parsed.success) {
      logger.warn("POST /heuristic-evaluation invalid v2 jobData", {
        issues: parsed.error.issues,
      });
      return sendError(res, "Invalid jobData");
    }

    if (!data) {
      logger.warn(
        "POST /heuristic-evaluation request rejected: no data provided"
      );
      return sendError(res, "There is no data to process");
    }

    logger.debug("POST /heuristic-evaluation request received", {
      studyId: data.studyData?.studyId,
      resultCount: data.results?.length,
    });
    await dbPostHeuristicEvaluation(data);
    logger.debug("POST /heuristic-evaluation request completed", {
      studyId: data.studyData?.studyId,
    });
    return sendSuccess(res);
  } catch (error) {
    handleServiceError(error, res, next, "POST /heuristic-evaluation request");
    return;
  }
};

// ==================== CW Issue/Recommendation CRUD ====================

export const updateCWIssue = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { issue, severity, rating, userId } = req.body;
    const normalizedRating = normalizeRating(rating);

    if (!validateRating(normalizedRating, res)) return;

    if (!id) {
      logger.warn("PUT /cw-issue request rejected: missing id");
      return sendError(res, "Issue ID is required");
    }

    if (issue === undefined && severity === undefined && rating === undefined) {
      logger.warn("PUT /cw-issue request rejected: no update data", { id });
      return sendError(res, "Issue, severity, or rating is required");
    }

    logger.debug("PUT /cw-issue request received", {
      id,
      hasIssue: !!issue,
      hasSeverity: severity !== undefined,
      hasRating: rating !== undefined,
      userId,
    });
    const data = await dbUpdateCWIssue(
      id,
      issue,
      severity,
      normalizedRating,
      userId
    );
    logger.debug("PUT /cw-issue request completed", { id });
    return sendSuccess(res, data);
  } catch (error) {
    handleServiceError(error, res, next, "PUT /cw-issue request");
    return;
  }
};

export const updateCWRecommendation = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { recommendation, rating, userId } = req.body;
    const normalizedRating = normalizeRating(rating);

    if (!validateRating(normalizedRating, res)) return;

    if (!id) {
      logger.warn("PUT /cw-recommendation request rejected: missing id");
      return sendError(res, "Recommendation ID is required");
    }

    if (recommendation === undefined && rating === undefined) {
      logger.warn(
        "PUT /cw-recommendation request rejected: missing update payload",
        { id }
      );
      return sendError(res, "Recommendation or rating is required");
    }

    logger.debug("PUT /cw-recommendation request received", {
      id,
      userId,
      hasRecommendation: recommendation !== undefined,
      hasRating: rating !== undefined,
    });
    const data = await dbUpdateCWRecommendation(
      id,
      recommendation,
      normalizedRating,
      userId
    );
    logger.debug("PUT /cw-recommendation request completed", { id });
    return sendSuccess(res, data);
  } catch (error) {
    handleServiceError(error, res, next, "PUT /cw-recommendation request");
    return;
  }
};

export const deleteCWIssue = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    if (!id) {
      logger.warn("DELETE /cw-issue request rejected: missing id");
      return sendError(res, "Issue ID is required");
    }

    logger.debug("DELETE /cw-issue request received", { id, userId });
    const data = await dbDeleteCWIssue(id, userId);
    logger.debug("DELETE /cw-issue request completed", { id });
    return sendSuccess(res, data);
  } catch (error) {
    handleServiceError(error, res, next, "DELETE /cw-issue request");
    return;
  }
};

export const deleteCWRecommendation = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    if (!id) {
      logger.warn("DELETE /cw-recommendation request rejected: missing id");
      return sendError(res, "Recommendation ID is required");
    }

    logger.debug("DELETE /cw-recommendation request received", { id, userId });
    const data = await dbDeleteCWRecommendation(id, userId);
    logger.debug("DELETE /cw-recommendation request completed", { id });
    return sendSuccess(res, data);
  } catch (error) {
    handleServiceError(error, res, next, "DELETE /cw-recommendation request");
    return;
  }
};

export const createCWRecommendation = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { issueId, recommendation, source, userId } = req.body;
    if (!issueId || !recommendation || !source) {
      logger.warn("POST /cw-recommendation request rejected: missing fields", {
        hasIssueId: !!issueId,
        hasRecommendation: !!recommendation,
        hasSource: !!source,
      });
      return sendError(res, "issueId, recommendation, and source are required");
    }

    logger.debug("POST /cw-recommendation request received", {
      issueId,
      source,
      userId,
    });
    const data = await dbCreateCWRecommendation(
      issueId,
      recommendation,
      source,
      userId
    );
    logger.debug("POST /cw-recommendation request completed", {
      issueId,
      recommendationId: data.id,
    });
    return sendSuccess(res, data, 201);
  } catch (error) {
    handleServiceError(error, res, next, "POST /cw-recommendation request");
    return;
  }
};

export const createCWIssue = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { stepId, issueType, issue, source, userId } = req.body;
    if (!stepId || !issueType || !issue || !source) {
      logger.warn("POST /cw-issue request rejected: missing fields", {
        hasStepId: !!stepId,
        hasIssueType: !!issueType,
        hasIssue: !!issue,
        hasSource: !!source,
      });
      return sendError(res, "Missing required fields");
    }

    logger.debug("POST /cw-issue request received", {
      stepId,
      issueType,
      source,
      userId,
    });
    const result = await dbCreateCWIssue({
      stepId,
      issueType,
      issue,
      source,
      userId,
    });
    logger.debug("POST /cw-issue request completed", {
      stepId,
      issueId: result.id,
    });
    return sendSuccess(res, result);
  } catch (error) {
    handleServiceError(error, res, next, "POST /cw-issue request");
    return;
  }
};

// ==================== HE Result/Recommendation CRUD ====================

export const updateHEResult = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { issue, severity, rating, userId } = req.body;
    const normalizedRating = normalizeRating(rating);

    if (!validateRating(normalizedRating, res)) return;

    if (!id) {
      logger.warn("PUT /he-result request rejected: missing id");
      return sendError(res, "Result ID is required");
    }

    if (issue === undefined && severity === undefined && rating === undefined) {
      logger.warn("PUT /he-result request rejected: no update data", { id });
      return sendError(res, "Result reason, severity, or rating is required");
    }

    logger.debug("PUT /he-result request received", {
      id,
      hasIssue: !!issue,
      hasSeverity: severity !== undefined,
      hasRating: rating !== undefined,
      userId,
    });
    const data = await dbUpdateHEResult(
      id,
      issue,
      severity,
      normalizedRating,
      userId
    );
    logger.debug("PUT /he-result request completed", { id });
    return sendSuccess(res, data);
  } catch (error) {
    handleServiceError(error, res, next, "PUT /he-result request");
    return;
  }
};

export const updateHERecommendation = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { recommendation, rating, userId } = req.body;
    const normalizedRating = normalizeRating(rating);

    if (!validateRating(normalizedRating, res)) return;

    if (!id) {
      logger.warn("PUT /he-recommendation request rejected: missing id");
      return sendError(res, "Recommendation ID is required");
    }

    if (recommendation === undefined && rating === undefined) {
      logger.warn(
        "PUT /he-recommendation request rejected: missing update payload",
        { id }
      );
      return sendError(res, "Recommendation or rating is required");
    }

    logger.debug("PUT /he-recommendation request received", {
      id,
      userId,
      hasRecommendation: recommendation !== undefined,
      hasRating: rating !== undefined,
    });
    const data = await dbUpdateHERecommendation(
      id,
      recommendation,
      normalizedRating,
      userId
    );
    logger.debug("PUT /he-recommendation request completed", { id });
    return sendSuccess(res, data);
  } catch (error) {
    handleServiceError(error, res, next, "PUT /he-recommendation request");
    return;
  }
};

export const deleteHEResult = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    if (!id) {
      logger.warn("DELETE /he-result request rejected: missing id");
      return sendError(res, "Result ID is required");
    }

    logger.debug("DELETE /he-result request received", { id, userId });
    const data = await dbDeleteHEResult(id, userId);
    logger.debug("DELETE /he-result request completed", { id });
    return sendSuccess(res, data);
  } catch (error) {
    handleServiceError(error, res, next, "DELETE /he-result request");
    return;
  }
};

export const deleteHERecommendation = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    if (!id) {
      logger.warn("DELETE /he-recommendation request rejected: missing id");
      return sendError(res, "Recommendation ID is required");
    }

    logger.debug("DELETE /he-recommendation request received", { id, userId });
    const data = await dbDeleteHERecommendation(id, userId);
    logger.debug("DELETE /he-recommendation request completed", { id });
    return sendSuccess(res, data);
  } catch (error) {
    handleServiceError(error, res, next, "DELETE /he-recommendation request");
    return;
  }
};

export const createHERecommendation = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { resultId, recommendation, source, userId } = req.body;
    if (!resultId || !recommendation || !source) {
      logger.warn(
        "POST /he-recommendation request rejected: missing required fields",
        {
          hasResultId: !!resultId,
          hasRecommendation: !!recommendation,
          hasSource: !!source,
        }
      );
      return sendError(
        res,
        "resultId, recommendation, and source are required"
      );
    }

    logger.debug("POST /he-recommendation request received", {
      resultId,
      source,
      userId,
    });
    const data = await dbCreateHERecommendation(
      resultId,
      recommendation,
      source,
      userId
    );
    logger.debug("POST /he-recommendation request completed", {
      resultId,
      source,
      recommendationId: data.id,
    });
    return sendSuccess(res, data, 201);
  } catch (error) {
    handleServiceError(error, res, next, "POST /he-recommendation request");
    return;
  }
};

export const createHEResult = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
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
      logger.warn("POST /he-result request rejected: missing required fields", {
        hasHeuristicEvaluationId: !!heuristicEvaluationId,
        hasHeuristicId: !!heuristicId,
        hasStep: !!step,
        hasFileId: !!fileId,
        hasReason: !!reason,
        hasSeverity: severity !== undefined && severity !== null,
        hasSource: !!source,
      });
      return sendError(res, "Missing required fields");
    }

    logger.debug("POST /he-result request received", {
      heuristicEvaluationId,
      heuristicId,
      step,
      severity,
      userId,
    });
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
    logger.debug("POST /he-result request completed", {
      heuristicEvaluationId,
      heuristicId,
      step,
      severity,
      resultId: result.id,
    });
    return sendSuccess(res, result);
  } catch (error) {
    handleServiceError(error, res, next, "POST /he-result request");
    return;
  }
};

// ==================== Heuristic Family Management ====================

export const getHeuristicFamilies = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const companyId = getParam<string>(req, "companyId", "company-id");

    logger.debug("GET /heuristic-families request received", { companyId });

    const { dbGetHeuristicFamilies } =
      await import("@/apps/db-worker/src/services/databaseService.ts");
    const families = await dbGetHeuristicFamilies(companyId || null);

    logger.debug("GET /heuristic-families request completed", {
      familyCount: families.length,
    });
    return sendSuccess(res, families);
  } catch (error) {
    handleServiceError(error, res, next, "GET /heuristic-families request");
    return;
  }
};

export const getHeuristicFamily = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    if (!id) {
      logger.warn("GET /heuristic-families/:id missing id");
      return sendError(res, "Family ID is required");
    }

    logger.debug("GET /heuristic-families/:id request received", { id });

    const { dbGetHeuristicFamily } =
      await import("@/apps/db-worker/src/services/databaseService.ts");
    const family = await dbGetHeuristicFamily(id);

    if (!family) {
      logger.warn("GET /heuristic-families/:id family not found", { id });
      return sendError(res, "Heuristic family not found", 404);
    }

    logger.debug("GET /heuristic-families/:id request completed", {
      id,
      heuristicCount: family.heuristics.length,
    });
    return sendSuccess(res, family);
  } catch (error) {
    handleServiceError(error, res, next, "GET /heuristic-families/:id request");
    return;
  }
};

export const createHeuristicFamily = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { name, key, description, companyId, userId } = req.body;

    if (
      !requireBodyFields(
        req.body || {},
        ["name", "key", "companyId", "userId"],
        res
      )
    ) {
      return;
    }

    // Verify user is an admin of the company
    if (
      !(await requireCompanyAdmin(
        companyId,
        userId,
        res,
        "create heuristic families"
      ))
    ) {
      return;
    }

    logger.debug("POST /heuristic-families request received", {
      companyId,
      name,
    });

    const { dbCreateHeuristicFamily } =
      await import("@/apps/db-worker/src/services/databaseService.ts");
    const family = await dbCreateHeuristicFamily({
      name,
      key,
      description,
      companyId,
      createdById: userId,
    });

    logger.debug("POST /heuristic-families request completed", {
      familyId: family.id,
    });
    return sendSuccess(res, family, 201);
  } catch (error) {
    handleServiceError(error, res, next, "POST /heuristic-families request");
    return;
  }
};

export const updateHeuristicFamily = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { name, description, userId, companyId } = req.body;

    if (!requireBodyFields(req.body || {}, ["userId", "companyId"], res)) {
      return;
    }

    // Verify user is an admin
    if (
      !(await requireCompanyAdmin(
        companyId,
        userId,
        res,
        "update heuristic families"
      ))
    ) {
      return;
    }

    const { dbUpdateHeuristicFamily } =
      await import("@/apps/db-worker/src/services/databaseService.ts");
    const family = await dbUpdateHeuristicFamily(id, { name, description });

    return sendSuccess(res, family);
  } catch (error) {
    handleServiceError(
      error,
      res,
      next,
      "PATCH /heuristic-families/:id request"
    );
    return;
  }
};

export const deleteHeuristicFamily = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { userId, companyId } = req.body;

    if (!requireBodyFields(req.body || {}, ["userId", "companyId"], res)) {
      return;
    }

    // Verify user is an admin
    if (
      !(await requireCompanyAdmin(
        companyId,
        userId,
        res,
        "delete heuristic families"
      ))
    ) {
      return;
    }

    const { dbDeleteHeuristicFamily } =
      await import("@/apps/db-worker/src/services/databaseService.ts");
    await dbDeleteHeuristicFamily(id, companyId);

    return sendSuccess(res);
  } catch (error) {
    handleServiceError(
      error,
      res,
      next,
      "DELETE /heuristic-families/:id request"
    );
    return;
  }
};

export const toggleHeuristicFamilyVisibility = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { isHidden, userId, companyId } = req.body;

    if (!userId || !companyId || typeof isHidden !== "boolean") {
      return sendError(res, "userId, companyId, and isHidden are required");
    }

    // Verify user is an admin
    if (
      !(await requireCompanyAdmin(companyId, userId, res, "toggle visibility"))
    ) {
      return;
    }

    const { dbToggleHeuristicFamilyVisibility } =
      await import("@/apps/db-worker/src/services/databaseService.ts");
    const visibility = await dbToggleHeuristicFamilyVisibility(
      id,
      companyId,
      isHidden
    );

    return sendSuccess(res, visibility);
  } catch (error) {
    handleServiceError(
      error,
      res,
      next,
      "POST /heuristic-families/:id/visibility request"
    );
    return;
  }
};

// ==================== Individual Heuristic CRUD ====================

export const getHeuristic = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const companyId = getParam<string>(req, "companyId", "company-id");

    if (!id) {
      logger.warn("GET /heuristics/:id missing id");
      return sendError(res, "Heuristic ID is required");
    }

    logger.debug("GET /heuristics/:id request received", { id, companyId });

    const { dbGetHeuristic } =
      await import("@/apps/db-worker/src/services/databaseService.ts");
    const heuristic = await dbGetHeuristic(id, companyId || null);

    if (!heuristic) {
      logger.warn("GET /heuristics/:id heuristic not found", { id });
      return sendError(res, "Heuristic not found", 404);
    }

    logger.debug("GET /heuristics/:id request completed", {
      id,
      exampleCount: heuristic.examples.length,
    });
    return sendSuccess(res, heuristic);
  } catch (error) {
    handleServiceError(error, res, next, "GET /heuristics/:id request");
    return;
  }
};

export const createHeuristic = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const {
      heuristicFamilyId,
      category,
      label,
      heuristic,
      description,
      userId,
      companyId,
    } = req.body;

    if (
      !requireBodyFields(
        req.body || {},
        ["heuristicFamilyId", "heuristic", "userId", "companyId"],
        res
      )
    ) {
      return;
    }

    // Verify user is an admin
    if (
      !(await requireCompanyAdmin(companyId, userId, res, "create heuristics"))
    ) {
      return;
    }

    const { dbCreateHeuristic } =
      await import("@/apps/db-worker/src/services/databaseService.ts");
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
  } catch (error) {
    handleServiceError(error, res, next, "POST /heuristics request");
    return;
  }
};

export const updateHeuristic = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { category, label, heuristic, description, userId, companyId } =
      req.body;

    if (!requireBodyFields(req.body || {}, ["userId", "companyId"], res)) {
      return;
    }

    // Verify user is an admin
    if (
      !(await requireCompanyAdmin(companyId, userId, res, "update heuristics"))
    ) {
      return;
    }

    const { dbUpdateHeuristic } =
      await import("@/apps/db-worker/src/services/databaseService.ts");
    const updatedHeuristic = await dbUpdateHeuristic(id, {
      category,
      label,
      heuristic,
      description,
      companyId,
    });

    return sendSuccess(res, updatedHeuristic);
  } catch (error) {
    handleServiceError(error, res, next, "PATCH /heuristics/:id request");
    return;
  }
};

export const deleteHeuristic = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { userId, companyId } = req.body;

    if (!requireBodyFields(req.body || {}, ["userId", "companyId"], res)) {
      return;
    }

    // Verify user is an admin
    if (
      !(await requireCompanyAdmin(companyId, userId, res, "delete heuristics"))
    ) {
      return;
    }

    const { dbDeleteHeuristic } =
      await import("@/apps/db-worker/src/services/databaseService.ts");
    await dbDeleteHeuristic(id, companyId);

    return sendSuccess(res);
  } catch (error) {
    handleServiceError(error, res, next, "DELETE /heuristics/:id request");
    return;
  }
};

// ==================== Heuristic Examples CRUD ====================

export const createHeuristicExample = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { heuristicId, title, description, userId, companyId, createdById } =
      req.body;

    if (
      !requireBodyFields(
        req.body || {},
        ["heuristicId", "description", "userId", "companyId"],
        res
      )
    ) {
      return;
    }

    // Verify user is an admin
    if (
      !(await requireCompanyAdmin(
        companyId,
        userId,
        res,
        "create heuristic examples"
      ))
    ) {
      return;
    }

    const { dbCreateHeuristicExample } =
      await import("@/apps/db-worker/src/services/databaseService.ts");
    const example = await dbCreateHeuristicExample({
      heuristicId,
      title,
      description,
      companyId,
      createdById: createdById || userId,
    });

    return sendSuccess(res, example, 201);
  } catch (error) {
    handleServiceError(error, res, next, "POST /heuristic-examples request");
    return;
  }
};

export const updateHeuristicExample = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { title, description, userId, companyId } = req.body;

    if (!requireBodyFields(req.body || {}, ["userId", "companyId"], res)) {
      return;
    }

    // Verify user is an admin
    if (
      !(await requireCompanyAdmin(
        companyId,
        userId,
        res,
        "update heuristic examples"
      ))
    ) {
      return;
    }

    const { dbUpdateHeuristicExample } =
      await import("@/apps/db-worker/src/services/databaseService.ts");
    const example = await dbUpdateHeuristicExample(id, {
      title,
      description,
      companyId,
    });

    return sendSuccess(res, example);
  } catch (error) {
    handleServiceError(
      error,
      res,
      next,
      "PATCH /heuristic-examples/:id request"
    );
    return;
  }
};

export const deleteHeuristicExample = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { userId, companyId } = req.body;

    if (!requireBodyFields(req.body || {}, ["userId", "companyId"], res)) {
      return;
    }

    // Verify user is an admin
    if (
      !(await requireCompanyAdmin(
        companyId,
        userId,
        res,
        "delete heuristic examples"
      ))
    ) {
      return;
    }

    const { dbDeleteHeuristicExample } =
      await import("@/apps/db-worker/src/services/databaseService.ts");
    await dbDeleteHeuristicExample(id, companyId);

    return sendSuccess(res);
  } catch (error) {
    handleServiceError(
      error,
      res,
      next,
      "DELETE /heuristic-examples/:id request"
    );
    return;
  }
};
