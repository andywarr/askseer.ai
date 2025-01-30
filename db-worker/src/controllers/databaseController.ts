import express from "express";
import { dbGetStudies } from "../services/databaseService.ts";

import type { NextFunction, Request, Response } from "express";

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
