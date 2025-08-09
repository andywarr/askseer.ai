// Function imports
import {
  dbDeleteStudy,
  dbGetCognitiveWalkthrough,
  dbGetCWQuestion,
  dbGetFiles,
  dbGetHeuristics,
  dbGetHeuristicEvaluation,
  dbGetStudies,
  dbGetStudy,
  dbGetUser,
  dbPostCognitiveWalkthrough,
  dbPostHeuristicEvaluation,
  dbPostStudy,
  dbUpdateStudyAttempts,
  dbUpdateStudyName,
  dbUpdateStudyStatus,
  dbPostUpdateCredits,
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
  dbUpdateUserName,
  dbUpdateUserImage,
  dbInitStudy,
  dbFinalizeStudy,
} from "@/apps/db-worker/src/services/databaseService.ts";
import { logger } from "@/apps/db-worker/src/logger.ts";

// Express imports
import type { NextFunction, Request, Response } from "express";

// Prisma imports
import { StudyStatus } from "@prisma/client";

interface JobData {
  data: {
    name: string;
    goal: string;
    user: string | null;
    files: {
      name: string;
      key: string;
      size: number;
      type: string;
    }[];
    heuristic: string | null;
    context: string | null;
    type: string;
    userId: string;
  };
  studyId: string;
  task: string;
}

interface HERecommendation {
  recommendation: string;
}

interface ResultData {
  id: string;
  heuristic: string;
  type: string;
  violated: string;
  reason: string;
  recommendations: HERecommendation[];
  fileId: string;
  step: number;
}

interface HeuristicEvaluationData {
  studyData: JobData;
  results: ResultData[];
}

interface CognitiveWalkthroughData {
  studyData: JobData;
  results: CWStepData[];
}

interface CWResultData {
  questionId: string;
  answer: string;
}

interface CWIssueData {
  issueType: string;
  issue: string;
  recommendations: Array<CWRecommendationData>;
}

interface CWRecommendationData {
  recommendation: string;
}

interface CWStepData {
  step: number;
  expected: boolean;
  results: Array<CWResultData>;
  issues: Array<CWIssueData>;
}

interface CreditUpdateData {
  userId: string;
  delta: number;
}

function convertToStudyStatus(status: string): StudyStatus | null {
  switch (status.toLowerCase()) {
    case "completed":
      return StudyStatus.COMPLETED;
    case "failed":
      return StudyStatus.FAILED;
    case "pending":
      return StudyStatus.PENDING;
    default:
      return null;
  }
}

export const deleteStudy = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const studyId =
      req.query.studyId ||
      req.body.studyId ||
      req.params.studyId ||
      req.headers["study-id"];

    if (!studyId) {
      logger.warn("DELETE /study request rejected: missing studyId");
      res.status(400).json({ success: false, message: "Study ID is required" });
      return;
    }

    const userId =
      req.query.userId ||
      req.body.userId ||
      req.params.userId ||
      req.headers["user-id"];

    if (!userId) {
      logger.warn("DELETE /study request rejected: missing userId");
      res.status(400).json({ success: false, message: "User ID is required" });
      return;
    }

    logger.debug("DELETE /study request received", { studyId, userId });
    const data = await dbDeleteStudy(studyId, userId);
    logger.debug("DELETE /study request completed successfully", {
      studyId,
      userId,
    });
    res.status(200).json({ success: true, data });
  } catch (error) {
    logger.error("DELETE /study request failed", { error });
    next(error);
  }
};

export const getCWQuestion = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const version =
      Number(req.query.version) ||
      Number(req.body.version) ||
      Number(req.params.version) ||
      Number(req.headers["version"]);

    if (!version) {
      logger.warn("GET /cw-questions request rejected: missing version");
      res.status(400).json({
        success: false,
        message: "Cognitive walkthrough question version is required",
      });
      return;
    }

    if (isNaN(version)) {
      logger.warn("GET /cw-questions request rejected: invalid version", {
        version,
      });
      res.status(400).json({
        success: false,
        message: "Cognitive walkthrough question version must be a number",
      });
      return;
    }

    logger.debug("GET /cw-questions request received", { version });
    const data = await dbGetCWQuestion(version);
    logger.debug("GET /cw-questions request completed", {
      version,
      questionCount: data.length,
    });
    res.status(200).json({ success: true, data });
  } catch (error) {
    logger.error("GET /cw-questions request failed", { error });
    next(error);
  }
};

export const getFiles = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const studyId =
      req.query.studyId ||
      req.body.studyId ||
      req.params.studyId ||
      req.headers["studyId"];

    if (!studyId) {
      logger.warn("GET /files request rejected: missing studyId");
      res.status(400).json({ success: false, message: "studyId is required" });
      return;
    }

    logger.debug("GET /files request received", { studyId });
    const data = await dbGetFiles(studyId);
    logger.debug("GET /files request completed", {
      studyId,
      fileCount: data.length,
    });
    res.status(200).json({ success: true, data });
  } catch (error) {
    logger.error("GET /files request failed", { error });
    next(error);
  }
};

export const getHeuristics = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const type =
      req.query.type || req.body.type || req.params.type || req.headers["type"];

    if (!type) {
      logger.warn("GET /heuristics request rejected: missing type");
      res
        .status(400)
        .json({ success: false, message: "Heuristic type is required" });
      return;
    }

    logger.debug("GET /heuristics request received", { type });
    const data = await dbGetHeuristics(type);
    logger.debug("GET /heuristics request completed", {
      type,
      heuristicCount: data.length,
    });
    res.status(200).json({ success: true, data });
  } catch (error) {
    logger.error("GET /heuristics request failed", { error });
    next(error);
  }
};

export const getStudies = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId =
      req.query.userId ||
      req.body.userId ||
      req.params.userId ||
      req.headers["user-id"];

    if (!userId) {
      logger.warn("GET /studies request rejected: missing userId");
      res.status(400).json({ success: false, message: "User ID is required" });
      return;
    }

    logger.debug("GET /studies request received", { userId });
    const data = await dbGetStudies(userId);
    logger.debug("GET /studies request completed", {
      userId,
      studyCount: data.length,
    });
    res.status(200).json({ success: true, data });
  } catch (error) {
    logger.error("GET /studies request failed", { error });
    next(error);
  }
};

export const getStudy = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const studyId =
      req.query.studyId ||
      req.body.studyId ||
      req.params.studyId ||
      req.headers["study-id"];

    if (!studyId) {
      logger.warn("GET /study request rejected: missing studyId");
      res.status(400).json({ success: false, message: "Study ID is required" });
      return;
    }

    const userId =
      req.query.userId ||
      req.body.userId ||
      req.params.userId ||
      req.headers["user-id"];

    if (!userId) {
      logger.warn("GET /study request rejected: missing userId");
      res.status(400).json({ success: false, message: "User ID is required" });
      return;
    }

    logger.debug("GET /study request received", { studyId, userId });
    const data = await dbGetStudy(studyId, userId);
    logger.debug("GET /study request completed", {
      studyId,
      userId,
      found: !!data,
    });
    res.status(200).json({ success: true, data });
  } catch (error) {
    logger.error("GET /study request failed", { error });
    next(error);
  }
};

export const getUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId =
      req.query.userId ||
      req.body.userId ||
      req.params.userId ||
      req.headers["user-id"];

    if (!userId) {
      logger.warn("GET /user request rejected: missing userId");
      res.status(400).json({ success: false, message: "User ID is required" });
      return;
    }

    logger.debug("GET /user request received", { userId });
    const data = await dbGetUser(userId);
    logger.debug("GET /user request completed", { userId, found: !!data });
    res.status(200).json({ success: true, data });
  } catch (error) {
    logger.error("GET /user request failed", { error });
    next(error);
  }
};

export const postStudy = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const data = req.body;
    logger.debug("POST /study request received", {
      userId: data?.data?.userId,
      studyName: data?.data?.name,
    });

    if (!data) {
      logger.warn("POST /study request rejected: no data provided");
      res
        .status(400)
        .json({ success: false, message: "There is no data to process" });
      return;
    }

    const study = await dbPostStudy(data);
    logger.debug("POST /study request completed successfully", {
      studyId: study.id,
    });
    res.status(200).json({ success: true, data: study });
  } catch (error) {
    logger.error("POST /study request failed", { error });
    next(error);
  }
};

export const postStudyAttempts = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const data = req.body;

    if (!data) {
      logger.warn("POST /study-attempts request rejected: no data provided");
      res
        .status(400)
        .json({ success: false, message: "There is no data to process" });
      return;
    }

    logger.debug("POST /study-attempts request received", {
      studyId: data.studyId,
    });
    const study = await dbUpdateStudyAttempts(data.studyId);
    logger.debug("POST /study-attempts request completed", {
      studyId: data.studyId,
    });
    res.status(200).json({ success: true, data: study });
  } catch (error) {
    logger.error("POST /study-attempts request failed", { error });
    next(error);
  }
};

export const postStudyStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const data = req.body;

    if (!data) {
      logger.warn("POST /study-status request rejected: no data provided");
      res
        .status(400)
        .json({ success: false, message: "There is no data to process" });
      return;
    }

    const status = convertToStudyStatus(data.status);

    if (!status) {
      logger.warn("POST /study-status request rejected: invalid status", {
        status: data.status,
      });
      res.status(400).json({ success: false, message: "Invalid study status" });
      return;
    }

    logger.debug("POST /study-status request received", {
      studyId: data.studyId,
      status,
    });
    const study = await dbUpdateStudyStatus(data.studyId, status);
    logger.debug("POST /study-status request completed", {
      studyId: data.studyId,
      status,
    });
    res.status(200).json({ success: true, data: study });
  } catch (error) {
    logger.error("POST /study-status request failed", { error });
    next(error);
  }
};

export const postHeuristicEvaluation = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const data: HeuristicEvaluationData = req.body;

    if (!data) {
      logger.warn(
        "POST /heuristic-evaluation request rejected: no data provided"
      );
      res
        .status(400)
        .json({ success: false, message: "There is no data to process" });
      return;
    }

    logger.debug("POST /heuristic-evaluation request received", {
      studyId: data.studyData?.studyId,
      resultCount: data.results?.length,
    });
    await dbPostHeuristicEvaluation(data);
    logger.debug("POST /heuristic-evaluation request completed", {
      studyId: data.studyData?.studyId,
    });
    res.status(200).json({ success: true });
  } catch (error) {
    logger.error("POST /heuristic-evaluation request failed", { error });
    next(error);
  }
};

export const postCognitiveWalkthrough = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const data: CognitiveWalkthroughData = req.body;

    if (!data) {
      logger.warn(
        "POST /cognitive-walkthrough request rejected: no data provided"
      );
      res
        .status(400)
        .json({ success: false, message: "There is no data to process" });
      return;
    }

    logger.debug("POST /cognitive-walkthrough request received", {
      studyId: data.studyData?.studyId,
      resultCount: data.results?.length,
    });
    await dbPostCognitiveWalkthrough(data);
    logger.debug("POST /cognitive-walkthrough request completed", {
      studyId: data.studyData?.studyId,
    });
    res.status(200).json({ success: true });
  } catch (error) {
    logger.error("POST /cognitive-walkthrough request failed", { error });
    next(error);
  }
};

export const postUpdateCredits = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const data: CreditUpdateData = req.body;

    if (!data) {
      logger.warn("POST /update-credits request rejected: no data provided");
      res
        .status(400)
        .json({ success: false, message: "There is no data to process" });
      return;
    }

    logger.debug("POST /update-credits request received", {
      userId: data.userId,
      delta: data.delta,
    });
    const user = await dbPostUpdateCredits(data);
    logger.debug("POST /update-credits request completed", {
      userId: data.userId,
      delta: data.delta,
      newCredits: user.credits,
    });
    res.status(200).json({ success: true, data: user });
  } catch (error) {
    logger.error("POST /update-credits request failed", { error });
    next(error);
  }
};

export const updateCWIssue = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { issue } = req.body;

    if (!id) {
      logger.warn("PUT /cw-issue request rejected: missing id");
      res.status(400).json({ success: false, message: "Issue ID is required" });
      return;
    }

    if (!issue) {
      logger.warn("PUT /cw-issue request rejected: missing issue content", {
        id,
      });
      res
        .status(400)
        .json({ success: false, message: "Issue content is required" });
      return;
    }

    logger.debug("PUT /cw-issue request received", { id });
    const data = await dbUpdateCWIssue(id, issue);
    logger.debug("PUT /cw-issue request completed", { id });
    res.status(200).json({ success: true, data });
  } catch (error) {
    logger.error("PUT /cw-issue request failed", { error });
    next(error);
  }
};

export const updateCWRecommendation = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { recommendation } = req.body;

    if (!id) {
      logger.warn("PUT /cw-recommendation request rejected: missing id");
      res
        .status(400)
        .json({ success: false, message: "Recommendation ID is required" });
      return;
    }

    if (!recommendation) {
      logger.warn(
        "PUT /cw-recommendation request rejected: missing recommendation content",
        { id }
      );
      res.status(400).json({
        success: false,
        message: "Recommendation content is required",
      });
      return;
    }

    logger.debug("PUT /cw-recommendation request received", { id });
    const data = await dbUpdateCWRecommendation(id, recommendation);
    logger.debug("PUT /cw-recommendation request completed", { id });
    res.status(200).json({ success: true, data });
  } catch (error) {
    logger.error("PUT /cw-recommendation request failed", { error });
    next(error);
  }
};

export const updateHEResult = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { issue } = req.body;

    if (!id) {
      logger.warn("PUT /he-result request rejected: missing id");
      res
        .status(400)
        .json({ success: false, message: "Result ID is required" });
      return;
    }

    if (!issue) {
      logger.warn("PUT /he-result request rejected: missing issue content", {
        id,
      });
      res
        .status(400)
        .json({ success: false, message: "Result reason is required" });
      return;
    }

    logger.debug("PUT /he-result request received", { id });
    const data = await dbUpdateHEResult(id, issue);
    logger.debug("PUT /he-result request completed", { id });
    res.status(200).json({ success: true, data });
  } catch (error) {
    logger.error("PUT /he-result request failed", { error });
    next(error);
  }
};

export const updateHERecommendation = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { recommendation } = req.body;

    if (!id) {
      logger.warn("PUT /he-recommendation request rejected: missing id");
      res
        .status(400)
        .json({ success: false, message: "Recommendation ID is required" });
      return;
    }

    if (!recommendation) {
      logger.warn(
        "PUT /he-recommendation request rejected: missing recommendation content",
        { id }
      );
      res.status(400).json({
        success: false,
        message: "Recommendation content is required",
      });
      return;
    }

    logger.debug("PUT /he-recommendation request received", { id });
    const data = await dbUpdateHERecommendation(id, recommendation);
    logger.debug("PUT /he-recommendation request completed", { id });
    res.status(200).json({ success: true, data });
  } catch (error) {
    logger.error("PUT /he-recommendation request failed", { error });
    next(error);
  }
};

export const deleteCWIssue = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    if (!id) {
      logger.warn("DELETE /cw-issue request rejected: missing id");
      res.status(400).json({ success: false, message: "Issue ID is required" });
      return;
    }

    logger.debug("DELETE /cw-issue request received", { id });
    const data = await dbDeleteCWIssue(id);
    logger.debug("DELETE /cw-issue request completed", { id });
    res.status(200).json({ success: true, data });
  } catch (error) {
    logger.error("DELETE /cw-issue request failed", { error });
    next(error);
  }
};

export const deleteCWRecommendation = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    if (!id) {
      logger.warn("DELETE /cw-recommendation request rejected: missing id");
      res
        .status(400)
        .json({ success: false, message: "Recommendation ID is required" });
      return;
    }

    logger.debug("DELETE /cw-recommendation request received", { id });
    const data = await dbDeleteCWRecommendation(id);
    logger.debug("DELETE /cw-recommendation request completed", { id });
    res.status(200).json({ success: true, data });
  } catch (error) {
    logger.error("DELETE /cw-recommendation request failed", { error });
    next(error);
  }
};

export const deleteHEResult = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    if (!id) {
      logger.warn("DELETE /he-result request rejected: missing id");
      res
        .status(400)
        .json({ success: false, message: "Result ID is required" });
      return;
    }

    logger.debug("DELETE /he-result request received", { id });
    const data = await dbDeleteHEResult(id);
    logger.debug("DELETE /he-result request completed", { id });
    res.status(200).json({ success: true, data });
  } catch (error) {
    logger.error("DELETE /he-result request failed", { error });
    next(error);
  }
};

export const deleteHERecommendation = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    if (!id) {
      logger.warn("DELETE /he-recommendation request rejected: missing id");
      res
        .status(400)
        .json({ success: false, message: "Recommendation ID is required" });
      return;
    }

    logger.debug("DELETE /he-recommendation request received", { id });
    const data = await dbDeleteHERecommendation(id);
    logger.debug("DELETE /he-recommendation request completed", { id });
    res.status(200).json({ success: true, data });
  } catch (error) {
    logger.error("DELETE /he-recommendation request failed", { error });
    next(error);
  }
};

export const createCWRecommendation = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { issueId, recommendation, source } = req.body;
    if (!issueId || !recommendation || !source) {
      logger.warn("POST /cw-recommendation request rejected: missing fields", {
        hasIssueId: !!issueId,
        hasRecommendation: !!recommendation,
        hasSource: !!source,
      });
      res.status(400).json({
        success: false,
        message: "issueId, recommendation, and source are required",
      });
      return;
    }

    logger.debug("POST /cw-recommendation request received", {
      issueId,
      source,
    });
    const data = await dbCreateCWRecommendation(
      issueId,
      recommendation,
      source
    );
    logger.debug("POST /cw-recommendation request completed", {
      issueId,
      recommendationId: data.id,
    });
    res.status(201).json({ success: true, data });
  } catch (error) {
    logger.error("POST /cw-recommendation request failed", { error });
    next(error);
  }
};

export const createHERecommendation = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { resultId, recommendation, source } = req.body;
    if (!resultId || !recommendation || !source) {
      logger.warn(
        "POST /he-recommendation request rejected: missing required fields",
        {
          hasResultId: !!resultId,
          hasRecommendation: !!recommendation,
          hasSource: !!source,
        }
      );
      res.status(400).json({
        success: false,
        message: "resultId, recommendation, and source are required",
      });
      return;
    }

    logger.debug("POST /he-recommendation request received", {
      resultId,
      source,
    });
    const data = await dbCreateHERecommendation(
      resultId,
      recommendation,
      source
    );
    logger.debug("POST /he-recommendation request completed", {
      resultId,
      source,
      recommendationId: data.id,
    });
    res.status(201).json({ success: true, data });
  } catch (error) {
    logger.error("POST /he-recommendation request failed", { error });
    next(error);
  }
};

export const createHEResult = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { heuristicEvaluationId, heuristicId, step, fileId, reason, source } =
      req.body;
    if (
      !heuristicEvaluationId ||
      !heuristicId ||
      !step ||
      !fileId ||
      !reason ||
      !source
    ) {
      logger.warn("POST /he-result request rejected: missing required fields", {
        hasHeuristicEvaluationId: !!heuristicEvaluationId,
        hasHeuristicId: !!heuristicId,
        hasStep: !!step,
        hasFileId: !!fileId,
        hasReason: !!reason,
        hasSource: !!source,
      });
      res
        .status(400)
        .json({ success: false, message: "Missing required fields" });
      return;
    }

    logger.debug("POST /he-result request received", {
      heuristicEvaluationId,
      heuristicId,
      step,
    });
    const result = await dbCreateHEResult({
      heuristicEvaluationId,
      heuristicId,
      step,
      fileId,
      reason,
      source,
    });
    logger.debug("POST /he-result request completed", {
      heuristicEvaluationId,
      heuristicId,
      step,
      resultId: result.id,
    });
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    logger.error("POST /he-result request failed", { error });
    next(error);
  }
};

export const createCWIssue = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { stepId, issueType, issue, source } = req.body;
    if (!stepId || !issueType || !issue || !source) {
      logger.warn("POST /cw-issue request rejected: missing fields", {
        hasStepId: !!stepId,
        hasIssueType: !!issueType,
        hasIssue: !!issue,
        hasSource: !!source,
      });
      res
        .status(400)
        .json({ success: false, message: "Missing required fields" });
      return;
    }

    logger.debug("POST /cw-issue request received", {
      stepId,
      issueType,
      source,
    });
    const result = await dbCreateCWIssue({
      stepId,
      issueType,
      issue,
      source,
    });
    logger.debug("POST /cw-issue request completed", {
      stepId,
      issueId: result.id,
    });
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    logger.error("POST /cw-issue request failed", { error });
    next(error);
  }
};

export const getCognitiveWalkthrough = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const studyId =
      req.query.studyId ||
      req.body.studyId ||
      req.params.studyId ||
      req.headers["study-id"];

    if (!studyId) {
      logger.warn(
        "GET /cognitiveWalkthrough request rejected: missing studyId"
      );
      res.status(400).json({ success: false, message: "Study ID is required" });
      return;
    }

    const userId =
      req.query.userId ||
      req.body.userId ||
      req.params.userId ||
      req.headers["user-id"];

    if (!userId) {
      logger.warn("GET /cognitiveWalkthrough request rejected: missing userId");
      res.status(400).json({ success: false, message: "User ID is required" });
      return;
    }

    const data = await dbGetCognitiveWalkthrough(studyId, userId);
    logger.debug("GET /cognitiveWalkthrough request completed", {
      studyId,
      userId,
      found: !!data,
    });
    res.status(200).json({ success: true, data });
  } catch (error) {
    logger.error("GET /cognitiveWalkthrough request failed", { error });
    next(error);
  }
};

export const getHeuristicEvaluation = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const studyId =
      req.query.studyId ||
      req.body.studyId ||
      req.params.studyId ||
      req.headers["study-id"];

    if (!studyId) {
      logger.warn("GET /heuristicEvaluation request rejected: missing studyId");
      res.status(400).json({ success: false, message: "Study ID is required" });
      return;
    }

    const userId =
      req.query.userId ||
      req.body.userId ||
      req.params.userId ||
      req.headers["user-id"];

    if (!userId) {
      logger.warn("GET /heuristicEvaluation request rejected: missing userId");
      res.status(400).json({ success: false, message: "User ID is required" });
      return;
    }

    const data = await dbGetHeuristicEvaluation(studyId, userId);
    logger.debug("GET /heuristicEvaluation request completed", {
      studyId,
      userId,
      found: !!data,
    });
    res.status(200).json({ success: true, data });
  } catch (error) {
    logger.error("GET /heuristicEvaluation request failed", { error });
    next(error);
  }
};

export const updateStudyName = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { studyId, name } = req.body;

    if (!studyId) {
      logger.warn("PATCH /study/name request rejected: missing studyId");
      res.status(400).json({ success: false, message: "Study ID is required" });
      return;
    }

    if (!name) {
      logger.warn("PATCH /study/name request rejected: missing name");
      res.status(400).json({ success: false, message: "Name is required" });
      return;
    }

    const data = await dbUpdateStudyName(studyId, name);
    logger.debug("PATCH /study/name request completed", {
      studyId,
      name,
    });
    res.status(200).json({ success: true, data });
  } catch (error) {
    logger.error("PATCH /study/name request failed", { error });
    next(error);
  }
};

export const updateUserName = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId, name } = req.body;

    if (!userId) {
      logger.warn("PATCH /user/name request rejected: missing userId");
      res.status(400).json({ success: false, message: "User ID is required" });
      return;
    }

    if (!name) {
      logger.warn("PATCH /user/name request rejected: missing name");
      res.status(400).json({ success: false, message: "Name is required" });
      return;
    }

    const data = await dbUpdateUserName(userId, name);
    logger.debug("PATCH /user/name request completed", { userId, name });

    res.status(200).json({ success: true, data });
  } catch (error) {
    logger.error("PATCH /user/name request failed", { error });
    next(error);
  }
};

export const updateUserImage = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId, imageKey } = req.body;

    if (!userId) {
      logger.warn("PATCH /user/image request rejected: missing userId");
      res.status(400).json({ success: false, message: "User ID is required" });
      return;
    }

    // imageKey can be null to remove a custom image
    const data = await dbUpdateUserImage(userId, imageKey || null);
    logger.debug("PATCH /user/image request completed", { userId, imageKey });

    res.status(200).json({ success: true, data });
  } catch (error) {
    logger.error("PATCH /user/image request failed", { error });
    next(error);
  }
};

export const postStudyInit = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, name, type } = req.body || {};
    if (!userId || !type) {
      res.status(400).json({ success: false, message: 'userId and type are required' });
      return;
    }
    const study = await dbInitStudy({ userId, name, type });
    res.status(200).json({ success: true, data: study });
  } catch (error) {
    logger.error('POST /study/init failed', { error });
    next(error);
  }
};

export const postStudyFinalize = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { studyId, files, jobData } = req.body || {};
    if (!studyId || !Array.isArray(files)) {
      res.status(400).json({ success: false, message: 'studyId and files[] are required' });
      return;
    }
    const study = await dbFinalizeStudy({ studyId, files, jobData });
    res.status(200).json({ success: true, data: study });
  } catch (error) {
    logger.error('POST /study/finalize failed', { error });
    next(error);
  }
};
