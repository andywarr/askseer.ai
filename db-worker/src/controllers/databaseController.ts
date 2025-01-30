import express from "express";
import { fetchAllData } from "../services/databaseService.ts";

import type { NextFunction, Request, Response } from "express";

export const getAllData = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const data = await fetchAllData();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};
