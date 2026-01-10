/**
 * Team-related controller handlers.
 */
import type { NextFunction, Request, Response } from "express";
import { logger } from "@/apps/shared/logger.ts";
import { TeamRole, TeamJoinPolicy } from "@prisma/client";
import {
  getParam,
  handleServiceError,
  sendSuccess,
  sendError,
  requireBodyFields,
} from "./utils.ts";
import {
  dbGetTeam,
  dbCreateTeam,
  dbUpdateTeamName,
  dbUpdateTeamDescription,
  dbUpdateTeamJoinPolicy,
  dbAddTeamMembers,
  dbRemoveTeamMember,
  dbUpdateTeamMemberRole,
  dbAdjustTeamCredits,
  dbConsumeCreditForStudy,
  dbRefundCreditForStudy,
  dbGetTeamAutoRefillSettings,
  dbUpdateTeamAutoRefillSettings,
  dbUpdateTeamStripeCustomer,
  dbUpdateTeamPaymentMethod,
  dbRemoveTeamPaymentMethod,
  dbGetTeamsNeedingAutoRefill,
} from "@/apps/db-worker/src/services/databaseService.ts";

interface TeamCreditAdjustData {
  teamId: string;
  delta: number;
  byUserId?: string | null;
  studyId?: string | null;
  reason?: string | null;
}

export const getTeam = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const teamId = getParam<string>(req, "teamId", "team-id");

    if (!teamId) {
      logger.warn("GET /team request rejected: missing teamId");
      return sendError(res, "teamId is required");
    }
    const data = await dbGetTeam(teamId);
    return sendSuccess(res, data);
  } catch (error) {
    handleServiceError(error, res, next, "GET /team request");
    return;
  }
};

export const postTeam = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { companyId, userId, name, members } = req.body || {};
    if (
      !requireBodyFields(req.body || {}, ["companyId", "userId", "name"], res)
    ) {
      return;
    }
    const data = await dbCreateTeam({
      companyId,
      userId,
      name,
      members: Array.isArray(members) ? members : [],
    });
    return sendSuccess(res, data);
  } catch (error) {
    handleServiceError(error, res, next, "POST /team");
    return;
  }
};

export const patchTeamName = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { teamId, userId, name } = req.body || {};
    if (!teamId || !userId || typeof name !== "string") {
      return sendError(res, "teamId, userId and name are required");
    }

    const data = await dbUpdateTeamName({ teamId, userId, name });
    return sendSuccess(res, data);
  } catch (error) {
    handleServiceError(error, res, next, "PATCH /team/name");
    return;
  }
};

export const patchTeamJoin = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { teamId, userId, joinPolicy } = req.body || {};
    if (!teamId || !userId || typeof joinPolicy !== "string") {
      return sendError(res, "teamId, userId and joinPolicy are required");
    }

    const normalized = joinPolicy
      .toString()
      .trim()
      .toUpperCase()
      .replace(/[\s-]+/g, "_") as TeamJoinPolicy;

    if (!Object.values(TeamJoinPolicy).includes(normalized)) {
      return sendError(res, "joinPolicy is invalid");
    }

    const data = await dbUpdateTeamJoinPolicy({
      teamId,
      userId,
      joinPolicy: normalized,
    });

    return sendSuccess(res, data);
  } catch (error) {
    handleServiceError(error, res, next, "PATCH /team/join");
    return;
  }
};

export const patchTeamDescription = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { teamId, userId, description } = req.body || {};
    if (!teamId || !userId) {
      return sendError(res, "teamId and userId are required");
    }

    const data = await dbUpdateTeamDescription({
      teamId,
      userId,
      description: typeof description === "string" ? description : null,
    });

    return sendSuccess(res, data);
  } catch (error) {
    handleServiceError(error, res, next, "PATCH /team/description");
    return;
  }
};

export const postTeamMembers = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { teamId, members, invitedById } = req.body || {};
    if (!teamId || !invitedById || !Array.isArray(members) || !members.length) {
      return sendError(res, "teamId, invitedById and members[] are required");
    }

    const normalizedMembers = members
      .map((member: any) => ({
        userId: typeof member?.userId === "string" ? member.userId : "",
        role: String(member?.role || "").toUpperCase(),
      }))
      .filter((member) => member.userId);

    if (!normalizedMembers.length) {
      return sendError(res, "members[] must include at least one valid userId");
    }

    const allowedRoles: TeamRole[] = [
      TeamRole.ADMIN,
      TeamRole.MEMBER,
      TeamRole.VIEWER,
    ];
    const allowedRoleSet = new Set(allowedRoles);
    const invalidRole = normalizedMembers.find(
      (member) => !allowedRoleSet.has(member.role as TeamRole)
    );
    if (invalidRole) {
      return sendError(
        res,
        `Invalid role. Must be one of: ${allowedRoles.join(", ")}`
      );
    }

    const data = await dbAddTeamMembers({
      teamId,
      invitedById,
      members: normalizedMembers.map((member) => ({
        userId: member.userId,
        role: member.role as TeamRole,
      })),
    });

    return sendSuccess(res, data);
  } catch (error) {
    handleServiceError(error, res, next, "POST /team/members");
    return;
  }
};

export const deleteTeamMember = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { teamId, userId, requestedById } = req.body || {};
    if (
      !requireBodyFields(
        req.body || {},
        ["teamId", "userId", "requestedById"],
        res
      )
    ) {
      return;
    }

    const data = await dbRemoveTeamMember({ teamId, userId, requestedById });
    return sendSuccess(res, data);
  } catch (error) {
    handleServiceError(error, res, next, "DELETE /team/members");
    return;
  }
};

export const patchTeamMemberRole = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { teamId, userId, role, requestedById } = req.body || {};
    if (
      !requireBodyFields(
        req.body || {},
        ["teamId", "userId", "role", "requestedById"],
        res
      )
    ) {
      return;
    }

    const roleUpper = String(role).toUpperCase();
    const validRoles: TeamRole[] = [
      TeamRole.OWNER,
      TeamRole.ADMIN,
      TeamRole.MEMBER,
      TeamRole.VIEWER,
    ];
    if (!validRoles.includes(roleUpper as TeamRole)) {
      return sendError(
        res,
        `Invalid role. Must be one of: ${validRoles.join(", ")}`
      );
    }

    const data = await dbUpdateTeamMemberRole({
      teamId,
      userId,
      role: roleUpper as TeamRole,
      requestedById,
    });
    return sendSuccess(res, data);
  } catch (error) {
    handleServiceError(error, res, next, "PATCH /team/members/role");
    return;
  }
};

// Team Join Request Controllers

export const postTeamRequestJoin = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { teamId, userId, requestNote } = req.body || {};

    if (!teamId || !userId) {
      return sendError(res, "teamId and userId are required");
    }

    const { dbRequestTeamJoin } =
      await import("@/apps/db-worker/src/services/databaseService.ts");
    const data = await dbRequestTeamJoin({ teamId, userId, requestNote });

    return sendSuccess(res, data);
  } catch (error) {
    handleServiceError(error, res, next, "POST /team/request-join");
    return;
  }
};

export const getTeamJoinRequests = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const teamId = req.query.teamId as string;

    if (!teamId) {
      return sendError(res, "teamId is required");
    }

    const { dbGetTeamJoinRequests } =
      await import("@/apps/db-worker/src/services/databaseService.ts");
    const data = await dbGetTeamJoinRequests(teamId);

    return sendSuccess(res, data);
  } catch (error) {
    handleServiceError(error, res, next, "GET /team/join-requests");
    return;
  }
};

export const postAcceptTeamJoinRequest = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { teamId, userId, acceptedById } = req.body || {};

    if (
      !requireBodyFields(
        req.body || {},
        ["teamId", "userId", "acceptedById"],
        res
      )
    ) {
      return;
    }

    const { dbAcceptTeamJoinRequest } =
      await import("@/apps/db-worker/src/services/databaseService.ts");
    const data = await dbAcceptTeamJoinRequest({
      teamId,
      userId,
      acceptedById,
    });

    return sendSuccess(res, data);
  } catch (error) {
    handleServiceError(error, res, next, "POST /team/join-requests/accept");
    return;
  }
};

export const postRejectTeamJoinRequest = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { teamId, userId, rejectedById, rejectReason } = req.body || {};

    if (
      !requireBodyFields(
        req.body || {},
        ["teamId", "userId", "rejectedById"],
        res
      )
    ) {
      return;
    }

    const { dbRejectTeamJoinRequest } =
      await import("@/apps/db-worker/src/services/databaseService.ts");
    const data = await dbRejectTeamJoinRequest({
      teamId,
      userId,
      rejectedById,
      rejectReason,
    });

    return sendSuccess(res, data);
  } catch (error) {
    handleServiceError(error, res, next, "POST /team/join-requests/reject");
    return;
  }
};

// Team Credits Controllers

export const postTeamCreditsAdjust = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const data: TeamCreditAdjustData = req.body;
    if (!data || !data.teamId || typeof data.delta !== "number") {
      logger.warn("POST /team/credits/adjust invalid payload", { data });
      return sendError(res, "teamId and delta are required");
    }
    const updated = await dbAdjustTeamCredits(data);
    return sendSuccess(res, updated);
  } catch (error) {
    handleServiceError(error, res, next, "POST /team/credits/adjust");
    return;
  }
};

export const postTeamCreditsConsumeByStudy = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { studyId, byUserId } = req.body || {};
    if (!studyId || !byUserId) {
      return sendError(res, "studyId and byUserId are required");
    }
    const result = await dbConsumeCreditForStudy(studyId, byUserId);
    return sendSuccess(res, result);
  } catch (error) {
    handleServiceError(error, res, next, "POST /team/credits/consume");
    return;
  }
};

export const postTeamCreditsRefundByStudy = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { studyId, byUserId } = req.body || {};
    if (!studyId || !byUserId) {
      return sendError(res, "studyId and byUserId are required");
    }
    const result = await dbRefundCreditForStudy(studyId, byUserId);
    return sendSuccess(res, result);
  } catch (error) {
    handleServiceError(error, res, next, "POST /team/credits/refund");
    return;
  }
};

export const getCreditLedger = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.query.userId as string;
    const companyId = req.query.companyId as string | undefined;
    const isCompanyAdmin = req.query.isCompanyAdmin === "true";
    const teamIds = req.query.teamIds
      ? (req.query.teamIds as string).split(",").filter(Boolean)
      : [];
    const page = parseInt(req.query.page as string, 10) || 1;
    const pageSize = Math.min(
      parseInt(req.query.pageSize as string, 10) || 10,
      100
    );
    const sortBy =
      (req.query.sortBy as
        | "createdAt"
        | "delta"
        | "teamName"
        | "reason"
        | "byUserName") || "createdAt";
    const sortOrder = (req.query.sortOrder as "asc" | "desc") || "desc";

    if (!userId) {
      return sendError(res, "userId is required");
    }

    const { dbGetCreditLedger } =
      await import("@/apps/db-worker/src/services/databaseService.ts");

    const data = await dbGetCreditLedger({
      userId,
      companyId,
      isCompanyAdmin,
      teamIds,
      page,
      pageSize,
      sortBy,
      sortOrder,
    });

    return sendSuccess(res, data);
  } catch (error) {
    handleServiceError(error, res, next, "GET /credit-ledger");
    return;
  }
};

// Auto-Refill Controllers

export const getTeamAutoRefillSettings = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const teamId = req.query.teamId as string;
    const userId = req.query.userId as string;

    if (!teamId || !userId) {
      return sendError(res, "teamId and userId are required");
    }

    const data = await dbGetTeamAutoRefillSettings(teamId, userId);
    return sendSuccess(res, data);
  } catch (error) {
    handleServiceError(error, res, next, "GET /team/auto-refill");
    return;
  }
};

export const postTeamAutoRefillSettings = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const {
      teamId,
      userId,
      autoRefillEnabled,
      autoRefillThreshold,
      autoRefillAmount,
    } = req.body || {};

    if (!teamId || !userId) {
      return sendError(res, "teamId and userId are required");
    }

    const data = await dbUpdateTeamAutoRefillSettings({
      teamId,
      userId,
      autoRefillEnabled: Boolean(autoRefillEnabled),
      autoRefillThreshold: autoRefillThreshold ?? null,
      autoRefillAmount: autoRefillAmount ?? null,
    });

    return sendSuccess(res, data);
  } catch (error) {
    handleServiceError(error, res, next, "POST /team/auto-refill");
    return;
  }
};

export const postTeamStripeCustomer = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { teamId, userId, stripeCustomerId } = req.body || {};

    if (
      !requireBodyFields(
        req.body || {},
        ["teamId", "userId", "stripeCustomerId"],
        res
      )
    ) {
      return;
    }

    const data = await dbUpdateTeamStripeCustomer({
      teamId,
      userId,
      stripeCustomerId,
    });

    return sendSuccess(res, data);
  } catch (error) {
    handleServiceError(error, res, next, "POST /team/stripe-customer");
    return;
  }
};

export const postTeamPaymentMethod = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const {
      teamId,
      userId,
      stripePaymentMethodId,
      paymentMethodLast4,
      paymentMethodBrand,
    } = req.body || {};

    if (
      !requireBodyFields(
        req.body || {},
        ["teamId", "userId", "stripePaymentMethodId"],
        res
      )
    ) {
      return;
    }

    const data = await dbUpdateTeamPaymentMethod({
      teamId,
      userId,
      stripePaymentMethodId,
      paymentMethodLast4: paymentMethodLast4 || "",
      paymentMethodBrand: paymentMethodBrand || "",
    });

    return sendSuccess(res, data);
  } catch (error) {
    handleServiceError(error, res, next, "POST /team/payment-method");
    return;
  }
};

export const deleteTeamPaymentMethod = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { teamId, userId } = req.body || {};

    if (!teamId || !userId) {
      return sendError(res, "teamId and userId are required");
    }

    const data = await dbRemoveTeamPaymentMethod({ teamId, userId });
    return sendSuccess(res, data);
  } catch (error) {
    handleServiceError(error, res, next, "DELETE /team/payment-method");
    return;
  }
};

export const getTeamAutoRefillStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const teamId = req.query.teamId as string;

    if (!teamId) {
      return sendError(res, "teamId is required");
    }

    const team = await dbGetTeamsNeedingAutoRefill(teamId);
    return sendSuccess(res, {
      needsRefill: team !== null,
      team,
    });
  } catch (error) {
    handleServiceError(error, res, next, "GET /team/auto-refill/status");
    return;
  }
};
