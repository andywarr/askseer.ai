/**
 * Company-related controller handlers.
 */
import type { Request, Response } from "express";

import { CompanyRole } from "@prisma/client";
import { randomUUID } from "crypto";
import {
  getParam,
  handleServiceError,
  sendSuccess,
  sendError,
  requireBodyFields,
  withErrorHandler,
} from "./utils.ts";
import {
  dbGetCompanyByDomain,
  dbCreateCompanyForDomain,
  dbGetCompanyMembership,
  dbAddCompanyMembership,
  dbRemoveCompanyMember,
  dbActivateCompanyMember,
  dbActivateCompany,
  dbRejectCompany,
  dbEraseUser,
  dbListCompanyMembers,
  dbListCompanyTeams,
  dbUpdateCompanyName,
  dbUpdateCompanyLogo,
  dbUpdateCompanyJoinSettings,
  dbUpdateCompanyPersonalTeams,
  dbListDomainUsersNotMembers,
  dbEnrollUsersToCompany,
  dbCreateCompanyInvite,
  dbDeleteCompany,
} from "@/apps/db-worker/src/services/index.ts";

export const getCompanyByDomain = withErrorHandler(async (req, res) => {
  const domain = getParam<string>(req, "domain");

  if (!domain || typeof domain !== "string") {
    return sendError(res, "domain is required");
  }

  const data = await dbGetCompanyByDomain(domain);
  return sendSuccess(res, data);
}, "GET /company/by-domain");

export const postCompanyCreateForDomain = withErrorHandler(async (req, res) => {
  const { domain, name, userId } = req.body || {};

  if (!domain || typeof domain !== "string") {
    return sendError(res, "domain is required");
  }

  const data = await dbCreateCompanyForDomain({ domain, name, userId });
  return sendSuccess(res, data);
}, "POST /company/create-for-domain");

export const postCompanyActivate = withErrorHandler(async (req, res) => {
  const { companyId, reviewedByUserId } = req.body || {};

  if (!companyId || typeof companyId !== "string") {
    return sendError(res, "companyId is required");
  }

  const data = await dbActivateCompany({
    companyId,
    reviewedByUserId: reviewedByUserId || undefined,
  });
  return sendSuccess(res, data);
}, "POST /company/activate");

export const postCompanyReject = withErrorHandler(async (req, res) => {
  const { companyId, reviewedByUserId } = req.body || {};

  if (!companyId || typeof companyId !== "string") {
    return sendError(res, "companyId is required");
  }

  const data = await dbRejectCompany({
    companyId,
    reviewedByUserId: reviewedByUserId || undefined,
  });
  return sendSuccess(res, data);
}, "POST /company/reject");

export const getCompanyMembers = withErrorHandler(async (req, res) => {
  const companyId = getParam<string>(req, "companyId");

  if (!companyId) {
    return sendError(res, "companyId is required");
  }

  const data = await dbListCompanyMembers(companyId);
  return sendSuccess(res, data);
}, "GET /company/members");

export const getCompanyMembership = withErrorHandler(async (req, res) => {
  const companyId = getParam<string>(req, "companyId");
  const userId = getParam<string>(req, "userId");

  if (!companyId || !userId) {
    return sendError(res, "companyId and userId are required");
  }

  const data = await dbGetCompanyMembership(companyId, userId);
  return sendSuccess(res, data);
}, "GET /company/membership");

export const getCompanyTeams = withErrorHandler(async (req, res) => {
  const companyId = getParam<string>(req, "companyId");

  if (!companyId) {
    return sendError(res, "companyId is required");
  }

  const data = await dbListCompanyTeams(companyId);
  return sendSuccess(res, data);
}, "GET /company/teams");

export const patchCompanyName = withErrorHandler(async (req, res) => {
  const { companyId, userId, name } = req.body || {};

  if (!requireBodyFields(req.body || {}, ["companyId", "userId", "name"], res)) {
    return;
  }

  const data = await dbUpdateCompanyName({ companyId, userId, name });
  return sendSuccess(res, data);
}, "PATCH /company/name");

export const patchCompanyLogo = withErrorHandler(async (req, res) => {
  const { companyId, userId, logoKey } = req.body || {};

  if (!requireBodyFields(req.body || {}, ["companyId", "userId"], res)) {
    return;
  }

  const data = await dbUpdateCompanyLogo({
    companyId,
    userId,
    logoKey: logoKey || null,
  });
  return sendSuccess(res, data);
}, "PATCH /company/image");

export const patchCompanyJoin = withErrorHandler(async (req, res) => {
  const { companyId, userId, autoEnroll } = req.body || {};

  if (!companyId || !userId || typeof autoEnroll !== "boolean") {
    return sendError(res, "companyId, userId and autoEnroll are required");
  }

  const data = await dbUpdateCompanyJoinSettings({ companyId, userId, autoEnroll });
  return sendSuccess(res, data);
}, "PATCH /company/join");

export const patchCompanyPersonalTeams = withErrorHandler(async (req, res) => {
  const { companyId, userId, disablePersonalTeams } = req.body || {};

  if (!companyId || !userId || typeof disablePersonalTeams !== "boolean") {
    return sendError(res, "companyId, userId and disablePersonalTeams are required");
  }

  const data = await dbUpdateCompanyPersonalTeams({ companyId, userId, disablePersonalTeams });
  return sendSuccess(res, data);
}, "PATCH /company/personal-teams");

export const getCompanyDomainUsers = withErrorHandler(async (req, res) => {
  const companyId = req.query.companyId as string;
  const domain = req.query.domain as string;

  if (!companyId || !domain) {
    return sendError(res, "companyId and domain are required");
  }

  const data = await dbListDomainUsersNotMembers({ companyId, domain });
  return sendSuccess(res, data);
}, "GET /company/domain-users");

export const postCompanyEnrollExisting = withErrorHandler(async (req, res) => {
  const { companyId, userIds, invitedById } = req.body || {};

  if (!companyId || !Array.isArray(userIds)) {
    return sendError(res, "companyId and userIds[] are required");
  }

  await dbEnrollUsersToCompany({
    companyId,
    userIds,
    invitedById: invitedById || null,
  });
  return sendSuccess(res);
}, "POST /company/enroll");

export const postCompanyMember = withErrorHandler(async (req, res) => {
  const { companyId, userId, role, invitedById, canCreatePersonas } = req.body || {};

  if (!companyId || !userId || !role) {
    return sendError(res, "companyId, userId and role are required");
  }

  const roleUpper = String(role).toUpperCase();
  const validRoles = Object.values(CompanyRole);
  if (!validRoles.includes(roleUpper as CompanyRole)) {
    return sendError(res, `Invalid role. Must be one of: ${validRoles.join(", ")}`);
  }

  const data = await dbAddCompanyMembership({
    companyId,
    userId,
    role: roleUpper as CompanyRole,
    invitedById,
    canCreatePersonas,
  });
  return sendSuccess(res, data);
}, "POST /company/members");

export const deleteCompanyMember = withErrorHandler(async (req, res) => {
  const { companyId, userId, requestedById } = req.body || {};

  if (!requireBodyFields(req.body || {}, ["companyId", "userId", "requestedById"], res)) {
    return;
  }

  const data = await dbRemoveCompanyMember({ companyId, userId, requestedById });
  return sendSuccess(res, data);
}, "DELETE /company/members");

export const eraseCompanyUser = async (
  req: Request,
  res: Response,
  next: any
) => {
  try {
    const { companyId, userId, requestedById, reason } = req.body || {};

    if (!requireBodyFields(req.body || {}, ["companyId", "userId", "requestedById"], res)) {
      return;
    }

    const data = await dbEraseUser({ companyId, userId, requestedById, reason });
    return sendSuccess(res, data);
  } catch (error: any) {
    // Special handling for erase errors that include teams/companies
    if (error?.status === 400 || error?.status === 403 || error?.status === 404) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
        teams: error?.teams,
        companies: error?.companies,
      });
    }
    handleServiceError(error, res, next, "POST /company/members/erase");
    return;
  }
};

export const patchCompanyMember = withErrorHandler(async (req, res) => {
  const { companyId, userId, requestedById, action } = req.body || {};

  if (!requireBodyFields(req.body || {}, ["companyId", "userId", "requestedById"], res)) {
    return;
  }

  if (action !== "activate") {
    return sendError(res, "Invalid action. Only 'activate' is supported");
  }

  const data = await dbActivateCompanyMember({ companyId, userId, requestedById });
  return sendSuccess(res, data);
}, "PATCH /company/members");

export const deleteCompany = withErrorHandler(async (req, res) => {
  const companyId = getParam<string>(req, "companyId");
  const requestedById =
    getParam<string>(req, "requestedById") || (req.headers["user-id"] as string);

  if (!companyId || !requestedById) {
    return sendError(res, "companyId and requestedById are required");
  }

  const data = await dbDeleteCompany({ companyId, requestedById });
  return sendSuccess(res, data);
}, "DELETE /company");

export const postCompanyInvite = withErrorHandler(async (req, res) => {
  const { companyId, email, role, invitedById, teamIds } = req.body || {};

  if (!companyId || !email || !role) {
    return sendError(res, "companyId, email and role are required");
  }

  const roleUpper = String(role).toUpperCase();
  const validRoles = Object.values(CompanyRole);
  if (!validRoles.includes(roleUpper as CompanyRole)) {
    return sendError(res, `Invalid role. Must be one of: ${validRoles.join(", ")}`);
  }

  const validatedTeamIds = Array.isArray(teamIds)
    ? teamIds.filter((id): id is string => typeof id === "string")
    : [];
  const token = randomUUID();

  const data = await dbCreateCompanyInvite({
    companyId,
    email,
    role: roleUpper as CompanyRole,
    token,
    invitedById,
    teamIds: validatedTeamIds,
  });
  return sendSuccess(res, data);
}, "POST /company/invite");
