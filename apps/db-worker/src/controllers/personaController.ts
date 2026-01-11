/**
 * Persona-related controller handlers.
 */
import type { NextFunction, Request, Response } from "express";
import { logger } from "@/apps/shared/logger.ts";
import {
  JobEnvelopeV2Schema,
  JobEnvelopeV2_PE,
} from "@/apps/shared/jobSchema.ts";
import {
  getParam,
  requireParam,
  handleServiceError,
  sendSuccess,
  sendError,
  requireBodyFields,
} from "./utils.ts";
import {
  dbGetPersona,
  dbGetPersonaBasicInfo,
  dbListPersonas,
  dbGetPersonaVersions,
  dbUpdatePersona,
  dbPostPersona,
} from "@/apps/db-worker/src/services/index.ts";

export const getPersona = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const studyId = requireParam(req, res, "studyId", "Study ID", "study-id");
    if (!studyId) return;

    const userId = requireParam(req, res, "userId", "User ID", "user-id");
    if (!userId) return;

    const data = await dbGetPersona(studyId, userId);
    logger.debug("GET /persona request completed", {
      studyId,
      userId,
      found: !!data,
    });
    sendSuccess(res, data);
  } catch (error) {
    handleServiceError(error, res, next, "GET /persona request");
  }
};

export const getPersonaBasicInfo = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const studyId = getParam<string>(req, "studyId", "study-id");

    if (!studyId) {
      logger.warn("GET /persona/basic request rejected: missing studyId");
      return sendError(res, "Study ID is required");
    }

    const data = await dbGetPersonaBasicInfo(studyId);
    logger.debug("GET /persona/basic request completed", {
      studyId,
      found: !!data,
    });
    return sendSuccess(res, data);
  } catch (error) {
    handleServiceError(error, res, next, "GET /persona/basic request");
    return;
  }
};

export const getPersonas = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = getParam<string>(req, "userId", "user-id");

    if (!userId) {
      logger.warn("GET /personas request rejected: missing userId");
      return sendError(res, "User ID is required");
    }

    const teamId = getParam<string>(req, "teamId", "team-id");

    if (!teamId) {
      logger.warn("GET /personas request rejected: missing teamId", { userId });
      return sendError(res, "Team ID is required");
    }

    const data = await dbListPersonas(userId, teamId);
    logger.debug("GET /personas request completed", {
      userId,
      teamId,
      count: data.length,
    });
    return sendSuccess(res, data);
  } catch (error) {
    handleServiceError(error, res, next, "GET /personas request");
    return;
  }
};

export const getPersonaVersions = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { personaGroupId } = req.params;

    if (!personaGroupId) {
      logger.warn(
        "GET /persona/versions/:personaGroupId request rejected: missing personaGroupId"
      );
      return sendError(res, "Persona Group ID is required");
    }

    const userId = getParam<string>(req, "userId", "user-id");

    if (!userId) {
      logger.warn(
        "GET /persona/versions/:personaGroupId request rejected: missing userId",
        { personaGroupId }
      );
      return sendError(res, "User ID is required");
    }

    const data = await dbGetPersonaVersions(personaGroupId, userId);
    logger.debug("GET /persona/versions/:personaGroupId request completed", {
      personaGroupId,
      userId,
      count: data.length,
    });
    return sendSuccess(res, data);
  } catch (error) {
    handleServiceError(
      error,
      res,
      next,
      "GET /persona/versions/:personaGroupId request"
    );
    return;
  }
};

export const updatePersona = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { studyId, userId, data } = req.body;

    if (
      !requireBodyFields(req.body || {}, ["studyId", "userId", "data"], res)
    ) {
      return;
    }

    const result = await dbUpdatePersona(studyId, userId, data);
    logger.debug("PATCH /persona/update request completed", {
      studyId,
      userId,
    });
    sendSuccess(res, result);
  } catch (error) {
    handleServiceError(error, res, next, "PATCH /persona/update request");
  }
};

export const postPersona = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { studyData, persona } = req.body || {};
    const parsed = JobEnvelopeV2Schema.safeParse(studyData);
    if (!parsed.success || parsed.data.type !== "persona") {
      logger.warn("POST /persona invalid v2 jobData", {
        issues: parsed.success ? [] : parsed.error.issues,
      });
      return sendError(res, "Invalid jobData");
    }
    if (!persona) {
      logger.warn("POST /persona missing persona payload");
      return sendError(res, "Missing persona");
    }
    await dbPostPersona({
      studyData: parsed.data as JobEnvelopeV2_PE,
      persona,
    });
    logger.debug("POST /persona completed", {
      studyId: parsed.data.studyId,
    });
    return sendSuccess(res);
  } catch (error) {
    handleServiceError(error, res, next, "POST /persona");
    return;
  }
};
