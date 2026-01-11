/**
 * User-related controller handlers.
 */

import {
  getParam,
  requireParam,
  sendSuccess,
  sendError,
  requireBodyFields,
  withErrorHandler,
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
} from "@/apps/db-worker/src/services/index.ts";

export const getUser = withErrorHandler(async (req, res) => {
  const userId = requireParam(req, res, "userId", "User ID", "user-id");
  if (!userId) return;

  const data = await dbGetUser(userId);
  sendSuccess(res, data);
}, "GET /user");

export const getUserTeams = withErrorHandler(async (req, res) => {
  const userId = getParam<string>(req, "userId", "user-id");

  if (!userId) {
    return sendError(res, "userId is required");
  }

  const data = await dbListUserTeams(userId);
  return sendSuccess(res, data);
}, "GET /user/teams");

export const updateUserName = withErrorHandler(async (req, res) => {
  const { userId, name } = req.body;

  if (!requireBodyFields(req.body || {}, ["userId", "name"], res)) {
    return;
  }

  const data = await dbUpdateUserName(userId, name);
  sendSuccess(res, data);
}, "PATCH /user/name");

export const updateUserImage = withErrorHandler(async (req, res) => {
  const { userId, imageKey } = req.body;

  if (!userId) {
    return sendError(res, "User ID is required");
  }

  // imageKey can be null to remove a custom image
  const data = await dbUpdateUserImage(userId, imageKey || null);
  return sendSuccess(res, data);
}, "PATCH /user/image");

export const updateUserSelectedTeam = withErrorHandler(async (req, res) => {
  const { userId, teamId } = req.body || {};

  if (!requireBodyFields(req.body || {}, ["userId", "teamId"], res)) {
    return;
  }

  const data = await dbUpdateUserSelectedTeam({ userId, teamId });
  return sendSuccess(res, data);
}, "PATCH /user/selected-team");

export const deleteUserAccount = withErrorHandler(async (req, res) => {
  const userId = getParam<string>(req, "userId");
  const requestedById =
    getParam<string>(req, "requestedById") || (req.headers["user-id"] as string);

  if (!userId || !requestedById) {
    return sendError(res, "userId and requestedById are required");
  }

  const data = await dbDeleteUserAccount({ userId, requestedById });
  return sendSuccess(res, data);
}, "DELETE /user");

export const getCommunicationPreferences = withErrorHandler(async (req, res) => {
  const userId = getParam<string>(req, "userId", "user-id");

  if (!userId || typeof userId !== "string") {
    return sendError(res, "Missing userId");
  }

  const data = await dbGetCommunicationPreferences(userId);
  return sendSuccess(res, data);
}, "GET /communication-preferences");

export const updateCommunicationPreferences = withErrorHandler(async (req, res) => {
  const userId = req.body.userId;
  const updates = req.body.updates || {};

  if (!userId || typeof userId !== "string") {
    return sendError(res, "Missing userId");
  }

  const data = await dbUpdateCommunicationPreferences(userId, updates);
  return sendSuccess(res, data);
}, "PATCH /communication-preferences");
