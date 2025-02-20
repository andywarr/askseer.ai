import {
  dbDeleteStudy,
  dbGetCWQuestion,
  dbGetHeuristics,
  dbGetStudies,
  dbGetStudy,
  dbGetUser,
  dbPostCognitiveWalkthrough,
  dbPostHeuristicEvaluation,
  dbPostStudy,
  dbUpdateStudyStatus,
  dbPostUpdateCredits,
} from "../services/databaseService.ts";

import type { NextFunction, Request, Response } from "express";

import { StudyStatus } from "@prisma/client";

interface JobData {
  data: {
    name: string;
    goal: string;
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
      res.status(400).json({ success: false, message: "Study ID is required" });
      return;
    }

    const userId =
      req.query.userId ||
      req.body.userId ||
      req.params.userId ||
      req.headers["user-id"];

    if (!userId) {
      res.status(400).json({ success: false, message: "User ID is required" });
      return;
    }

    const data = await dbDeleteStudy(studyId, userId);
    res.status(200).json({ success: true, data });
  } catch (error) {
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
      res.status(400).json({
        success: false,
        message: "Cognitive walkthrough question version is required",
      });
      return;
    }

    if (isNaN(version)) {
      res.status(400).json({
        success: false,
        message: "Cognitive walkthrough question version must be a number",
      });
      return;
    }

    const data = await dbGetCWQuestion(version);
    res.status(200).json({ success: true, data });
  } catch (error) {
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
      res
        .status(400)
        .json({ success: false, message: "Heuristic type is required" });
      return;
    }

    const data = await dbGetHeuristics(type);
    res.status(200).json({ success: true, data });
  } catch (error) {
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
      res.status(400).json({ success: false, message: "User ID is required" });
      return;
    }

    const data = await dbGetStudies(userId);
    res.status(200).json({ success: true, data });
  } catch (error) {
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
      res.status(400).json({ success: false, message: "Study ID is required" });
      return;
    }

    const userId =
      req.query.userId ||
      req.body.userId ||
      req.params.userId ||
      req.headers["user-id"];

    if (!userId) {
      res.status(400).json({ success: false, message: "User ID is required" });
      return;
    }

    const data = await dbGetStudy(studyId, userId);
    res.status(200).json({ success: true, data });
  } catch (error) {
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
      res.status(400).json({ success: false, message: "User ID is required" });
      return;
    }

    const data = await dbGetUser(userId);
    res.status(200).json({ success: true, data });
  } catch (error) {
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

    if (!data) {
      res
        .status(400)
        .json({ success: false, message: "There is no data to process" });
      return;
    }

    const study = await dbPostStudy(data);
    res.status(200).json({ success: true, data: study });
  } catch (error) {
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
      res
        .status(400)
        .json({ success: false, message: "There is no data to process" });
      return;
    }

    const status = convertToStudyStatus(data.status);

    if (!status) {
      res.status(400).json({ success: false, message: "Invalid study status" });
      return;
    }

    const study = await dbUpdateStudyStatus(data.studyId, status);
    res.status(200).json({ success: true, data: study });
  } catch (error) {
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
      res
        .status(400)
        .json({ success: false, message: "There is no data to process" });
      return;
    }

    const study = await dbPostHeuristicEvaluation(data);
    res.status(200).json({ success: true, data: study });
  } catch (error) {
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
      res
        .status(400)
        .json({ success: false, message: "There is no data to process" });
      return;
    }

    const study = await dbPostCognitiveWalkthrough(data);
    res.status(200).json({ success: true, data: study });
  } catch (error) {
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
      res
        .status(400)
        .json({ success: false, message: "There is no data to process" });
      return;
    }

    const user = await dbPostUpdateCredits(data);
    res.status(200).json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};
