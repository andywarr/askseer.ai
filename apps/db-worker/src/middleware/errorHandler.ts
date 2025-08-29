// Express imports
import type { NextFunction, Request, Response } from "express";
import { logger } from "@/apps/shared/logger.ts";

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  logger.error("Error in request:", {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
  });
  res.status(500).json({ success: false, message: "Internal Server Error" });
};
