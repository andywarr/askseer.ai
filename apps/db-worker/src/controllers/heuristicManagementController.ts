/**
 * Heuristic Family and Individual Heuristic management controller handlers.
 */

import {
  getParam,
  sendSuccess,
  sendError,
  requireBodyFields,
  requireCompanyAdmin,
  withErrorHandler,
} from "./utils.ts";
import {
  dbGetHeuristicFamilies,
  dbGetHeuristicFamily,
  dbCreateHeuristicFamily,
  dbUpdateHeuristicFamily,
  dbDeleteHeuristicFamily,
  dbToggleHeuristicFamilyVisibility,
  dbGetHeuristic,
  dbCreateHeuristic,
  dbUpdateHeuristic,
  dbDeleteHeuristic,
  dbCreateHeuristicExample,
  dbUpdateHeuristicExample,
  dbDeleteHeuristicExample,
} from "@/apps/db-worker/src/services/index.ts";

// ==================== Heuristic Family Management ====================

export const getHeuristicFamilies = withErrorHandler(async (req, res) => {
  const companyId = getParam<string>(req, "companyId", "company-id");
  const families = await dbGetHeuristicFamilies(companyId || null);
  return sendSuccess(res, families);
}, "GET /heuristic-families");

export const getHeuristicFamily = withErrorHandler(async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return sendError(res, "Family ID is required");
  }

  const family = await dbGetHeuristicFamily(id);

  if (!family) {
    return sendError(res, "Heuristic family not found", 404);
  }

  return sendSuccess(res, family);
}, "GET /heuristic-families/:id");

export const createHeuristicFamily = withErrorHandler(async (req, res) => {
  const { name, key, description, companyId, userId } = req.body;

  if (!requireBodyFields(req.body || {}, ["name", "key", "companyId", "userId"], res)) {
    return;
  }

  if (!(await requireCompanyAdmin(companyId, userId, res, "create heuristic families"))) {
    return;
  }

  const family = await dbCreateHeuristicFamily({
    name,
    key,
    description,
    companyId,
    createdById: userId,
  });

  return sendSuccess(res, family, 201);
}, "POST /heuristic-families");

export const updateHeuristicFamily = withErrorHandler(async (req, res) => {
  const { id } = req.params;
  const { name, description, userId, companyId } = req.body;

  if (!requireBodyFields(req.body || {}, ["userId", "companyId"], res)) {
    return;
  }

  if (!(await requireCompanyAdmin(companyId, userId, res, "update heuristic families"))) {
    return;
  }

  const family = await dbUpdateHeuristicFamily(id, { name, description });
  return sendSuccess(res, family);
}, "PATCH /heuristic-families/:id");

export const deleteHeuristicFamily = withErrorHandler(async (req, res) => {
  const { id } = req.params;
  const { userId, companyId } = req.body;

  if (!requireBodyFields(req.body || {}, ["userId", "companyId"], res)) {
    return;
  }

  if (!(await requireCompanyAdmin(companyId, userId, res, "delete heuristic families"))) {
    return;
  }

  await dbDeleteHeuristicFamily(id, companyId);
  return sendSuccess(res);
}, "DELETE /heuristic-families/:id");

export const toggleHeuristicFamilyVisibility = withErrorHandler(async (req, res) => {
  const { id } = req.params;
  const { isHidden, userId, companyId } = req.body;

  if (!userId || !companyId || typeof isHidden !== "boolean") {
    return sendError(res, "userId, companyId, and isHidden are required");
  }

  if (!(await requireCompanyAdmin(companyId, userId, res, "toggle visibility"))) {
    return;
  }

  const visibility = await dbToggleHeuristicFamilyVisibility(id, companyId, isHidden);
  return sendSuccess(res, visibility);
}, "POST /heuristic-families/:id/visibility");

// ==================== Individual Heuristic CRUD ====================

export const getHeuristic = withErrorHandler(async (req, res) => {
  const { id } = req.params;
  const companyId = getParam<string>(req, "companyId", "company-id");

  if (!id) {
    return sendError(res, "Heuristic ID is required");
  }

  const heuristic = await dbGetHeuristic(id, companyId || null);

  if (!heuristic) {
    return sendError(res, "Heuristic not found", 404);
  }

  return sendSuccess(res, heuristic);
}, "GET /heuristics/:id");

export const createHeuristic = withErrorHandler(async (req, res) => {
  const {
    heuristicFamilyId,
    category,
    label,
    heuristic,
    description,
    userId,
    companyId,
  } = req.body;

  if (!requireBodyFields(req.body || {}, ["heuristicFamilyId", "heuristic", "userId", "companyId"], res)) {
    return;
  }

  if (!(await requireCompanyAdmin(companyId, userId, res, "create heuristics"))) {
    return;
  }

  const newHeuristic = await dbCreateHeuristic({
    heuristicFamilyId,
    category,
    label,
    heuristic,
    description,
    companyId,
    createdById: userId,
  });

  return sendSuccess(res, newHeuristic, 201);
}, "POST /heuristics");

export const updateHeuristic = withErrorHandler(async (req, res) => {
  const { id } = req.params;
  const { category, label, heuristic, description, userId, companyId } = req.body;

  if (!requireBodyFields(req.body || {}, ["userId", "companyId"], res)) {
    return;
  }

  if (!(await requireCompanyAdmin(companyId, userId, res, "update heuristics"))) {
    return;
  }

  const updatedHeuristic = await dbUpdateHeuristic(id, {
    category,
    label,
    heuristic,
    description,
    companyId,
  });

  return sendSuccess(res, updatedHeuristic);
}, "PATCH /heuristics/:id");

export const deleteHeuristic = withErrorHandler(async (req, res) => {
  const { id } = req.params;
  const { userId, companyId } = req.body;

  if (!requireBodyFields(req.body || {}, ["userId", "companyId"], res)) {
    return;
  }

  if (!(await requireCompanyAdmin(companyId, userId, res, "delete heuristics"))) {
    return;
  }

  await dbDeleteHeuristic(id, companyId);
  return sendSuccess(res);
}, "DELETE /heuristics/:id");

// ==================== Heuristic Examples CRUD ====================

export const createHeuristicExample = withErrorHandler(async (req, res) => {
  const { heuristicId, title, description, userId, companyId, createdById } = req.body;

  if (!requireBodyFields(req.body || {}, ["heuristicId", "description", "userId", "companyId"], res)) {
    return;
  }

  if (!(await requireCompanyAdmin(companyId, userId, res, "create heuristic examples"))) {
    return;
  }

  const example = await dbCreateHeuristicExample({
    heuristicId,
    title,
    description,
    companyId,
    createdById: createdById || userId,
  });

  return sendSuccess(res, example, 201);
}, "POST /heuristic-examples");

export const updateHeuristicExample = withErrorHandler(async (req, res) => {
  const { id } = req.params;
  const { title, description, userId, companyId } = req.body;

  if (!requireBodyFields(req.body || {}, ["userId", "companyId"], res)) {
    return;
  }

  if (!(await requireCompanyAdmin(companyId, userId, res, "update heuristic examples"))) {
    return;
  }

  const example = await dbUpdateHeuristicExample(id, {
    title,
    description,
    companyId,
  });

  return sendSuccess(res, example);
}, "PATCH /heuristic-examples/:id");

export const deleteHeuristicExample = withErrorHandler(async (req, res) => {
  const { id } = req.params;
  const { userId, companyId } = req.body;

  if (!requireBodyFields(req.body || {}, ["userId", "companyId"], res)) {
    return;
  }

  if (!(await requireCompanyAdmin(companyId, userId, res, "delete heuristic examples"))) {
    return;
  }

  await dbDeleteHeuristicExample(id, companyId);
  return sendSuccess(res);
}, "DELETE /heuristic-examples/:id");
