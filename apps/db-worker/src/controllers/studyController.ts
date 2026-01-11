/**
 * Study-related controller handlers.
 */
import type { NextFunction, Request, Response } from "express";
import { logger } from "@/apps/shared/logger.ts";
import { StudyVisibility } from "@prisma/client";
import {
  getParam,
  requireParam,
  handleServiceError,
  sendSuccess,
  sendError,
  convertToStudyStatus,
  requireBodyFields,
} from "./utils.ts";
import {
  dbDeleteStudy,
  dbGetStudies,
  dbGetStudy,
  dbCanAccessStudy,
  dbUpdateStudyAttempts,
  dbUpdateStudyName,
  dbUpdateStudyTeam,
  dbUpdateStudyVisibility,
  dbRegenerateStudyShareToken,
  dbToggleStudyShareLink,
  dbGetStudyByShareToken,
  dbGetStudyShareInfo,
  dbGetStudyPublicRedirectInfo,
  dbUpdateStudyStatus,
  dbInitStudy,
  dbFinalizeStudy,
  dbGetBookmarkedStudyIds,
  dbToggleStudyBookmark,
  dbGetFiles,
} from "@/apps/db-worker/src/services/index.ts";

export const deleteStudy = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const studyId = requireParam(req, res, "studyId", "Study ID", "study-id");
    if (!studyId) return;

    const userId = requireParam(req, res, "userId", "User ID", "user-id");
    if (!userId) return;

    logger.debug("DELETE /study request received", { studyId, userId });
    const data = await dbDeleteStudy(studyId, userId);
    logger.debug("DELETE /study request completed successfully", {
      studyId,
      userId,
    });
    sendSuccess(res, data);
  } catch (error) {
    handleServiceError(error, res, next, "DELETE /study request");
  }
};

export const getStudies = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = requireParam(req, res, "userId", "User ID", "user-id");
    if (!userId) return;

    const teamIdRaw = getParam(req, "teamId", "team-id");
    const teamId =
      typeof teamIdRaw === "string" && teamIdRaw.trim().length > 0
        ? teamIdRaw
        : undefined;

    logger.debug("GET /studies request received", { userId, teamId });
    const data = await dbGetStudies(userId, teamId);
    logger.debug("GET /studies request completed", {
      userId,
      teamId,
      studyCount: data.length,
    });
    sendSuccess(res, data);
  } catch (error) {
    handleServiceError(error, res, next, "GET /studies request");
  }
};

export const getStudy = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const studyId = requireParam(req, res, "studyId", "Study ID", "study-id");
    if (!studyId) return;

    const userId = requireParam(req, res, "userId", "User ID", "user-id");
    if (!userId) return;

    logger.debug("GET /study request received", { studyId, userId });
    const data = await dbGetStudy(studyId, userId);
    logger.debug("GET /study request completed", {
      studyId,
      userId,
      found: !!data,
    });
    sendSuccess(res, data);
  } catch (error) {
    handleServiceError(error, res, next, "GET /study request");
  }
};

export const canAccessStudy = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const studyId = requireParam(req, res, "studyId", "Study ID", "study-id");
    if (!studyId) return;

    const userId = requireParam(req, res, "userId", "User ID", "user-id");
    if (!userId) return;

    logger.debug("GET /study/access request received", { studyId, userId });
    const data = await dbCanAccessStudy(studyId, userId);
    logger.debug("GET /study/access request completed", {
      studyId,
      userId,
      hasAccess: data.hasAccess,
    });
    sendSuccess(res, data);
  } catch (error) {
    handleServiceError(error, res, next, "GET /study/access request");
  }
};

export const postStudyAttempts = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { studyId } = req.body || {};

    if (!studyId) {
      logger.warn("POST /study-attempts request rejected: no studyId");
      return sendError(res, "studyId is required");
    }

    logger.debug("POST /study-attempts request received", { studyId });
    const study = await dbUpdateStudyAttempts(studyId);
    logger.debug("POST /study-attempts request completed", { studyId });
    sendSuccess(res, study);
  } catch (error) {
    handleServiceError(error, res, next, "POST /study-attempts request");
  }
};

export const postStudyStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { studyId, status: rawStatus } = req.body || {};

    if (!studyId) {
      return sendError(res, "studyId is required");
    }

    if (!rawStatus) {
      return sendError(res, "status is required");
    }

    const status = convertToStudyStatus(rawStatus);

    if (!status) {
      logger.warn("POST /study-status request rejected: invalid status", {
        status: rawStatus,
      });
      return sendError(res, "Invalid study status");
    }

    logger.debug("POST /study-status request received", { studyId, status });
    const study = await dbUpdateStudyStatus(studyId, status);
    logger.debug("POST /study-status request completed", { studyId, status });
    sendSuccess(res, study);
  } catch (error) {
    handleServiceError(error, res, next, "POST /study-status request");
  }
};

export const updateStudyName = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { studyId, name, userId } = req.body || {};

    if (
      !requireBodyFields(req.body || {}, ["studyId", "name", "userId"], res)
    ) {
      return;
    }

    const data = await dbUpdateStudyName(studyId, name, userId);
    logger.debug("PATCH /study/name request completed", {
      studyId,
      name,
      userId,
    });
    sendSuccess(res, data);
  } catch (error) {
    handleServiceError(error, res, next, "PATCH /study/name request");
  }
};

export const patchStudyTeam = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { studyId, teamId, byUserId } = req.body || {};

    if (
      !requireBodyFields(req.body || {}, ["studyId", "teamId", "byUserId"], res)
    ) {
      return;
    }

    const data = await dbUpdateStudyTeam({
      studyId,
      teamId,
      userId: byUserId,
    });
    logger.debug("PATCH /study/team request completed", {
      studyId,
      teamId,
      byUserId,
    });
    sendSuccess(res, data);
  } catch (error) {
    handleServiceError(error, res, next, "PATCH /study/team request");
  }
};

export const patchStudyVisibility = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { studyId, visibility, userId } = req.body || {};

    if (
      !requireBodyFields(
        req.body || {},
        ["studyId", "visibility", "userId"],
        res
      )
    ) {
      return;
    }

    if (!Object.values(StudyVisibility).includes(visibility)) {
      logger.warn(
        "PATCH /study/visibility request rejected: invalid visibility",
        { studyId, visibility }
      );
      return sendError(
        res,
        `visibility must be one of: ${Object.values(StudyVisibility).join(", ")}`
      );
    }

    const data = await dbUpdateStudyVisibility({ studyId, visibility, userId });
    logger.debug("PATCH /study/visibility request completed", {
      studyId,
      visibility,
      userId,
    });
    sendSuccess(res, data);
  } catch (error) {
    handleServiceError(error, res, next, "PATCH /study/visibility request");
  }
};

export const postStudyRegenerateShareToken = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { studyId, userId } = req.body || {};

    if (!requireBodyFields(req.body || {}, ["studyId", "userId"], res)) {
      return;
    }

    const data = await dbRegenerateStudyShareToken({ studyId, userId });
    logger.debug("POST /study/regenerate-share-token request completed", {
      studyId,
      userId,
    });
    sendSuccess(res, data);
  } catch (error) {
    handleServiceError(
      error,
      res,
      next,
      "POST /study/regenerate-share-token request"
    );
  }
};

export const postStudyToggleShareLink = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { studyId, userId, enabled } = req.body || {};

    if (!requireBodyFields(req.body || {}, ["studyId", "userId"], res)) {
      return;
    }

    if (typeof enabled !== "boolean") {
      return sendError(res, "enabled is required");
    }

    const data = await dbToggleStudyShareLink({ studyId, userId, enabled });
    logger.debug("POST /study/toggle-share-link request completed", {
      studyId,
      userId,
      enabled,
    });
    sendSuccess(res, data);
  } catch (error) {
    handleServiceError(
      error,
      res,
      next,
      "POST /study/toggle-share-link request"
    );
  }
};

export const getStudyByShareToken = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { token } = req.query;

    if (!token || typeof token !== "string") {
      return sendError(res, "token is required");
    }

    const data = await dbGetStudyByShareToken(token);

    if (!data) {
      return sendError(res, "Study not found or not public", 404);
    }

    logger.debug("GET /study/shared request completed", { token });
    sendSuccess(res, data);
  } catch (error) {
    handleServiceError(error, res, next, "GET /study/shared request");
  }
};

export const getStudyShareInfo = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const studyId = requireParam(req, res, "studyId", "Study ID");
    if (!studyId) return;

    const userId = requireParam(req, res, "userId", "User ID");
    if (!userId) return;

    const data = await dbGetStudyShareInfo(studyId, userId);
    logger.debug("GET /study/share-info request completed", {
      studyId,
      userId,
    });
    sendSuccess(res, data);
  } catch (error) {
    handleServiceError(error, res, next, "GET /study/share-info request");
  }
};

export const getStudyPublicRedirectInfo = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { studyId } = req.query;

    if (!studyId || typeof studyId !== "string") {
      return sendError(res, "studyId is required");
    }

    const data = await dbGetStudyPublicRedirectInfo(studyId);

    if (!data) {
      return sendError(res, "Study not found or not public", 404);
    }

    logger.debug("GET /study/public-redirect request completed", { studyId });
    sendSuccess(res, data);
  } catch (error) {
    handleServiceError(error, res, next, "GET /study/public-redirect request");
  }
};

export const postStudyInit = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId, teamId, name, type } = req.body || {};

    if (!requireBodyFields(req.body || {}, ["userId", "teamId", "type"], res)) {
      return;
    }

    const study = await dbInitStudy({ userId, teamId, name, type });
    sendSuccess(res, study);
  } catch (error) {
    handleServiceError(error, res, next, "POST /study/init");
  }
};

export const postStudyFinalize = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { studyId, files, jobData } = req.body || {};

    if (!studyId || !Array.isArray(files)) {
      return sendError(res, "studyId and files[] are required");
    }

    const study = await dbFinalizeStudy({ studyId, files, jobData });
    sendSuccess(res, study);
  } catch (error) {
    handleServiceError(error, res, next, "POST /study/finalize");
  }
};

// Bookmarked Studies Controllers

export const getBookmarkedStudies = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = requireParam(req, res, "userId", "User ID", "user-id");
    if (!userId) return;

    logger.debug("GET /bookmarked-studies request received", { userId });
    const data = await dbGetBookmarkedStudyIds(userId);
    logger.debug("GET /bookmarked-studies request completed", {
      userId,
      count: data.length,
    });
    sendSuccess(res, data);
  } catch (error) {
    handleServiceError(error, res, next, "GET /bookmarked-studies request");
  }
};

export const postToggleStudyBookmark = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId, studyId } = req.body;

    if (!requireBodyFields(req.body || {}, ["userId", "studyId"], res)) {
      return;
    }

    logger.debug("POST /toggle-study-bookmark request received", {
      userId,
      studyId,
    });
    const data = await dbToggleStudyBookmark(userId, studyId);
    logger.debug("POST /toggle-study-bookmark request completed", {
      userId,
      studyId,
      data,
    });
    sendSuccess(res, data);
  } catch (error) {
    handleServiceError(error, res, next, "POST /toggle-study-bookmark request");
  }
};

export const getFiles = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const studyId = requireParam(req, res, "studyId", "Study ID", "studyid");
    if (!studyId) return;

    logger.debug("GET /files request received", { studyId });
    const data = await dbGetFiles(studyId);
    logger.debug("GET /files request completed", {
      studyId,
      fileCount: data.length,
    });
    sendSuccess(res, data);
  } catch (error) {
    handleServiceError(error, res, next, "GET /files request");
  }
};
