/**
 * Persona-related controller handlers.
 */

import { logger } from "@/apps/shared/logger.ts";
import {
  JobEnvelopeV2Schema,
  JobEnvelopeV2_PE,
} from "@/apps/shared/jobSchema.ts";
import {
  getParam,
  requireParam,
  sendSuccess,
  sendError,
  requireBodyFields,
  withErrorHandler,
} from "./utils.ts";
import {
  dbGetPersona,
  dbGetPersonaBasicInfo,
  dbListPersonas,
  dbGetPersonaVersions,
  dbUpdatePersona,
  dbPostPersona,
} from "@/apps/db-worker/src/services/index.ts";

export const getPersona = withErrorHandler(async (req, res) => {
  const studyId = requireParam(req, res, "studyId", "Study ID", "study-id");
  if (!studyId) return;

  const userId = requireParam(req, res, "userId", "User ID", "user-id");
  if (!userId) return;

  const data = await dbGetPersona(studyId, userId);
  sendSuccess(res, data);
}, "GET /persona");

export const getPersonaBasicInfo = withErrorHandler(async (req, res) => {
  const studyId = getParam<string>(req, "studyId", "study-id");

  if (!studyId) {
    return sendError(res, "Study ID is required");
  }

  const data = await dbGetPersonaBasicInfo(studyId);
  return sendSuccess(res, data);
}, "GET /persona/basic");

export const getPersonas = withErrorHandler(async (req, res) => {
  const userId = getParam<string>(req, "userId", "user-id");
  const teamId = getParam<string>(req, "teamId", "team-id");

  if (!userId) {
    return sendError(res, "User ID is required");
  }

  if (!teamId) {
    return sendError(res, "Team ID is required");
  }

  const data = await dbListPersonas(userId, teamId);
  return sendSuccess(res, data);
}, "GET /personas");

export const getPersonaVersions = withErrorHandler(async (req, res) => {
  const { personaGroupId } = req.params;
  const userId = getParam<string>(req, "userId", "user-id");

  if (!personaGroupId) {
    return sendError(res, "Persona Group ID is required");
  }

  if (!userId) {
    return sendError(res, "User ID is required");
  }

  const data = await dbGetPersonaVersions(personaGroupId, userId);
  return sendSuccess(res, data);
}, "GET /persona/versions/:personaGroupId");

export const updatePersona = withErrorHandler(async (req, res) => {
  const { studyId, userId, data } = req.body;

  if (!requireBodyFields(req.body || {}, ["studyId", "userId", "data"], res)) {
    return;
  }

  const result = await dbUpdatePersona(studyId, userId, data);
  sendSuccess(res, result);
}, "PATCH /persona/update");

export const postPersona = withErrorHandler(async (req, res) => {
  const { studyData, persona } = req.body || {};
  const parsed = JobEnvelopeV2Schema.safeParse(studyData);

  if (!parsed.success || parsed.data.type !== "persona") {
    logger.warn("POST /persona invalid v2 jobData", {
      issues: parsed.success ? [] : parsed.error.issues,
    });
    return sendError(res, "Invalid jobData");
  }

  if (!persona) {
    return sendError(res, "Missing persona");
  }

  await dbPostPersona({
    studyData: parsed.data as JobEnvelopeV2_PE,
    persona,
  });
  return sendSuccess(res);
}, "POST /persona");
