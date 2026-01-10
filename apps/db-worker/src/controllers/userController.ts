/**
 * User-related controller handlers.
 */
import type { NextFunction, Request, Response } from "express";
import { logger } from "@/apps/shared/logger.ts";
import {
  getParam,
  requireParam,
  handleServiceError,
  sendSuccess,
  sendError,
  requireBodyFields,
} from "./utils.ts";
import {
  dbGetUser,
  dbUpdateUserName,
  dbUpdateUserImage,
  dbListUserTeams,
  dbUpdateUserSelectedTeam,
  dbDeleteUserAccount,
  dbGetCommunicationPreferences,
  dbUpdateCommunicationPreferences,
} from "@/apps/db-worker/src/services/databaseService.ts";

export const getUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = requireParam(req, res, "userId", "User ID", "user-id");
    if (!userId) return;

    logger.debug("GET /user request received", { userId });
    const data = await dbGetUser(userId);
    logger.debug("GET /user request completed", { userId, found: !!data });
    sendSuccess(res, data);
  } catch (error) {
    handleServiceError(error, res, next, "GET /user request");
  }
};

export const getUserTeams = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = getParam<string>(req, "userId", "user-id");

    if (!userId) {
      logger.warn("GET /user/teams request rejected: missing userId");
      return sendError(res, "userId is required");
    }

    logger.debug("GET /user/teams request received", { userId });
    const data = await dbListUserTeams(userId);
    return sendSuccess(res, data);
  } catch (error) {
    handleServiceError(error, res, next, "GET /user/teams request");
    return;
  }
};

export const updateUserName = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId, name } = req.body;

    if (!requireBodyFields(req.body || {}, ["userId", "name"], res)) {
      return;
    }

    const data = await dbUpdateUserName(userId, name);
    logger.debug("PATCH /user/name request completed", { userId, name });
    sendSuccess(res, data);
  } catch (error) {
    handleServiceError(error, res, next, "PATCH /user/name request");
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
      return sendError(res, "User ID is required");
    }

    // imageKey can be null to remove a custom image
    const data = await dbUpdateUserImage(userId, imageKey || null);
    logger.debug("PATCH /user/image request completed", { userId, imageKey });
    return sendSuccess(res, data);
  } catch (error) {
    handleServiceError(error, res, next, "PATCH /user/image request");
    return;
  }
};

export const updateUserSelectedTeam = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { userId, teamId } = req.body || {};

  if (!userId) {
    logger.warn("PATCH /user/selected-team request rejected: missing userId");
    return sendError(res, "userId is required");
  }

  if (!teamId) {
    logger.warn("PATCH /user/selected-team request rejected: missing teamId");
    return sendError(res, "teamId is required");
  }

  try {
    const data = await dbUpdateUserSelectedTeam({ userId, teamId });
    return sendSuccess(res, data);
  } catch (error) {
    handleServiceError(error, res, next, "PATCH /user/selected-team request");
    return;
  }
};

export const deleteUserAccount = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = getParam<string>(req, "userId");
    const requestedById =
      getParam<string>(req, "requestedById") ||
      (req.headers["user-id"] as string);

    if (!userId || !requestedById) {
      return sendError(res, "userId and requestedById are required");
    }

    const data = await dbDeleteUserAccount({
      userId,
      requestedById,
    });

    return sendSuccess(res, data);
  } catch (error) {
    handleServiceError(error, res, next, "DELETE /user");
    return;
  }
};

export const getCommunicationPreferences = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = getParam<string>(req, "userId", "user-id");
    if (!userId || typeof userId !== "string") {
      logger.warn("GET /communication-preferences missing userId");
      return sendError(res, "Missing userId");
    }
    const data = await dbGetCommunicationPreferences(userId);
    logger.debug("GET /communication-preferences request completed", {
      userId,
      found: !!data,
    });
    return sendSuccess(res, data);
  } catch (error) {
    handleServiceError(
      error,
      res,
      next,
      "GET /communication-preferences request"
    );
    return;
  }
};

export const updateCommunicationPreferences = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.body.userId;
    const updates = req.body.updates || {};
    if (!userId || typeof userId !== "string") {
      logger.warn("PATCH /communication-preferences missing userId");
      return sendError(res, "Missing userId");
    }
    const data = await dbUpdateCommunicationPreferences(userId, updates);
    logger.debug("PATCH /communication-preferences request completed", {
      userId,
    });
    return sendSuccess(res, data);
  } catch (error) {
    handleServiceError(
      error,
      res,
      next,
      "PATCH /communication-preferences request"
    );
    return;
  }
};
