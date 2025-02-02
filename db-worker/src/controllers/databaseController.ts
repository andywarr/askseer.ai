import express from "express";
import {
  dbDeleteStudy,
  dbGetStudies,
  dbGetStudy,
  dbGetUser,
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
    }

    const userId =
      req.query.userId ||
      req.body.userId ||
      req.params.userId ||
      req.headers["user-id"];

    if (!userId) {
      res.status(400).json({ success: false, message: "User ID is required" });
    }

    const data = await dbDeleteStudy(studyId, userId);
    res.json({ success: true, data });
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
    }

    const data = await dbGetStudies(userId);
    res.json({ success: true, data });
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
    }

    const userId =
      req.query.userId ||
      req.body.userId ||
      req.params.userId ||
      req.headers["user-id"];

    if (!userId) {
      res.status(400).json({ success: false, message: "User ID is required" });
    }

    const data = await dbGetStudy(studyId, userId);
    res.json({ success: true, data });
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
    }

    const data = await dbGetUser(userId);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};
