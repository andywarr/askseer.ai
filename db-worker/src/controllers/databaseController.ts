import {
  dbDeleteStudy,
  dbGetHeuristics,
  dbGetStudies,
  dbGetStudy,
  dbGetUser,
  dbPostHeuristicEvaluation,
  dbPostStudy,
} from "../services/databaseService.ts";

import type { NextFunction, Request, Response } from "express";

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

export const postHeuristicEvaluation = async (
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

    const study = await dbPostHeuristicEvaluation(data);
    res.status(200).json({ success: true, data: study });
  } catch (error) {
    next(error);
  }
};
