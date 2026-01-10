/**
 * Company-related controller handlers.
 */
import type { NextFunction, Request, Response } from "express";
import { logger } from "@/apps/shared/logger.ts";
import { CompanyRole } from "@prisma/client";
import { randomUUID } from "crypto";
import {
  getParam,
  handleServiceError,
  sendSuccess,
  sendError,
  requireBodyFields,
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
} from "@/apps/db-worker/src/services/databaseService.ts";

export const getCompanyByDomain = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const domain = getParam<string>(req, "domain");
    if (!domain || typeof domain !== "string") {
      logger.warn("GET /company/by-domain missing domain");
      return sendError(res, "domain is required");
    }
    const data = await dbGetCompanyByDomain(domain);
    return sendSuccess(res, data);
  } catch (error) {
    handleServiceError(error, res, next, "GET /company/by-domain");
    return;
  }
};

export const postCompanyCreateForDomain = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { domain, name, userId } = req.body || {};
    if (!domain || typeof domain !== "string") {
      logger.warn("POST /company/create-for-domain missing domain");
      return sendError(res, "domain is required");
    }
    const data = await dbCreateCompanyForDomain({ domain, name, userId });
    return sendSuccess(res, data);
  } catch (error) {
    handleServiceError(error, res, next, "POST /company/create-for-domain");
    return;
  }
};

export const postCompanyActivate = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { companyId, reviewedByUserId } = req.body || {};
    if (!companyId || typeof companyId !== "string") {
      logger.warn("POST /company/activate missing companyId");
      return sendError(res, "companyId is required");
    }
    const data = await dbActivateCompany({
      companyId,
      reviewedByUserId: reviewedByUserId || undefined,
    });
    return sendSuccess(res, data);
  } catch (error) {
    handleServiceError(error, res, next, "POST /company/activate");
    return;
  }
};

export const postCompanyReject = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { companyId, reviewedByUserId } = req.body || {};
    if (!companyId || typeof companyId !== "string") {
      logger.warn("POST /company/reject missing companyId");
      return sendError(res, "companyId is required");
    }
    const data = await dbRejectCompany({
      companyId,
      reviewedByUserId: reviewedByUserId || undefined,
    });
    return sendSuccess(res, data);
  } catch (error) {
    handleServiceError(error, res, next, "POST /company/reject");
    return;
  }
};

export const getCompanyMembers = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const companyId = getParam<string>(req, "companyId");
    if (!companyId) {
      return sendError(res, "companyId is required");
    }
    const data = await dbListCompanyMembers(companyId);
    return sendSuccess(res, data);
  } catch (error) {
    handleServiceError(error, res, next, "GET /company/members");
    return;
  }
};

export const getCompanyMembership = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const companyId = getParam<string>(req, "companyId");
    const userId = getParam<string>(req, "userId");
    if (!companyId || !userId) {
      return sendError(res, "companyId and userId are required");
    }
    const data = await dbGetCompanyMembership(companyId, userId);
    return sendSuccess(res, data);
  } catch (error) {
    handleServiceError(error, res, next, "GET /company/membership");
    return;
  }
};

export const getCompanyTeams = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const companyId = getParam<string>(req, "companyId");
    if (!companyId) {
      return sendError(res, "companyId is required");
    }
    const data = await dbListCompanyTeams(companyId);
    return sendSuccess(res, data);
  } catch (error) {
    handleServiceError(error, res, next, "GET /company/teams");
    return;
  }
};

export const patchCompanyName = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { companyId, userId, name } = req.body || {};
    if (
      !requireBodyFields(req.body || {}, ["companyId", "userId", "name"], res)
    ) {
      return;
    }
    const data = await dbUpdateCompanyName({ companyId, userId, name });
    return sendSuccess(res, data);
  } catch (error) {
    handleServiceError(error, res, next, "PATCH /company/name");
    return;
  }
};

export const patchCompanyLogo = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
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
  } catch (error) {
    handleServiceError(error, res, next, "PATCH /company/image");
    return;
  }
};

export const patchCompanyJoin = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { companyId, userId, autoEnroll } = req.body || {};
    if (!companyId || !userId || typeof autoEnroll !== "boolean") {
      return sendError(res, "companyId, userId and autoEnroll are required");
    }
    const data = await dbUpdateCompanyJoinSettings({
      companyId,
      userId,
      autoEnroll,
    });
    return sendSuccess(res, data);
  } catch (error) {
    handleServiceError(error, res, next, "PATCH /company/join");
    return;
  }
};

export const patchCompanyPersonalTeams = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { companyId, userId, disablePersonalTeams } = req.body || {};
    if (!companyId || !userId || typeof disablePersonalTeams !== "boolean") {
      return sendError(
        res,
        "companyId, userId and disablePersonalTeams are required"
      );
    }
    const data = await dbUpdateCompanyPersonalTeams({
      companyId,
      userId,
      disablePersonalTeams,
    });
    return sendSuccess(res, data);
  } catch (error) {
    handleServiceError(error, res, next, "PATCH /company/personal-teams");
    return;
  }
};

export const getCompanyDomainUsers = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const companyId = req.query.companyId as string;
    const domain = req.query.domain as string;
    if (!companyId || !domain) {
      return sendError(res, "companyId and domain are required");
    }
    const data = await dbListDomainUsersNotMembers({ companyId, domain });
    return sendSuccess(res, data);
  } catch (error) {
    handleServiceError(error, res, next, "GET /company/domain-users");
    return;
  }
};

export const postCompanyEnrollExisting = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
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
  } catch (error) {
    handleServiceError(error, res, next, "POST /company/enroll");
    return;
  }
};

export const postCompanyMember = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { companyId, userId, role, invitedById, canCreatePersonas } =
      req.body || {};
    if (!companyId || !userId || !role) {
      return sendError(res, "companyId, userId and role are required");
    }
    // Validate role against Prisma enum
    const roleUpper = String(role).toUpperCase();
    const validRoles = Object.values(CompanyRole);
    if (!validRoles.includes(roleUpper as CompanyRole)) {
      return sendError(
        res,
        `Invalid role. Must be one of: ${validRoles.join(", ")}`
      );
    }

    const data = await dbAddCompanyMembership({
      companyId,
      userId,
      role: roleUpper as CompanyRole,
      invitedById,
      canCreatePersonas,
    });
    return sendSuccess(res, data);
  } catch (error) {
    handleServiceError(error, res, next, "POST /company/members");
    return;
  }
};

export const deleteCompanyMember = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { companyId, userId, requestedById } = req.body || {};
    if (
      !requireBodyFields(
        req.body || {},
        ["companyId", "userId", "requestedById"],
        res
      )
    ) {
      return;
    }
    const data = await dbRemoveCompanyMember({
      companyId,
      userId,
      requestedById,
    });
    return sendSuccess(res, data);
  } catch (error) {
    handleServiceError(error, res, next, "DELETE /company/members");
    return;
  }
};

export const eraseCompanyUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { companyId, userId, requestedById, reason } = req.body || {};
    if (
      !requireBodyFields(
        req.body || {},
        ["companyId", "userId", "requestedById"],
        res
      )
    ) {
      return;
    }
    const data = await dbEraseUser({
      companyId,
      userId,
      requestedById,
      reason,
    });
    return sendSuccess(res, data);
  } catch (error: any) {
    // Special handling for erase errors that include teams/companies
    if (
      error?.status === 400 ||
      error?.status === 403 ||
      error?.status === 404
    ) {
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

export const patchCompanyMember = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { companyId, userId, requestedById, action } = req.body || {};
    if (
      !requireBodyFields(
        req.body || {},
        ["companyId", "userId", "requestedById"],
        res
      )
    ) {
      return;
    }
    if (action !== "activate") {
      return sendError(res, "Invalid action. Only 'activate' is supported");
    }
    const data = await dbActivateCompanyMember({
      companyId,
      userId,
      requestedById,
    });
    return sendSuccess(res, data);
  } catch (error) {
    handleServiceError(error, res, next, "PATCH /company/members");
    return;
  }
};

export const deleteCompany = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const companyId = getParam<string>(req, "companyId");
    const requestedById =
      getParam<string>(req, "requestedById") ||
      (req.headers["user-id"] as string);

    if (!companyId || !requestedById) {
      return sendError(res, "companyId and requestedById are required");
    }

    const data = await dbDeleteCompany({
      companyId,
      requestedById,
    });

    return sendSuccess(res, data);
  } catch (error) {
    handleServiceError(error, res, next, "DELETE /company");
    return;
  }
};

export const postCompanyInvite = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { companyId, email, role, invitedById, teamIds } = req.body || {};
    if (!companyId || !email || !role) {
      return sendError(res, "companyId, email and role are required");
    }
    const roleUpper = String(role).toUpperCase();
    const validRoles = Object.values(CompanyRole);
    if (!validRoles.includes(roleUpper as CompanyRole)) {
      return sendError(
        res,
        `Invalid role. Must be one of: ${validRoles.join(", ")}`
      );
    }
    // Validate teamIds if provided
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
  } catch (error) {
    handleServiceError(error, res, next, "POST /company/invite");
    return;
  }
};
