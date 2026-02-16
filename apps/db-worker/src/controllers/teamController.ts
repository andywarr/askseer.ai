/**
 * Team-related controller handlers.
 */

import { logger } from "@/apps/shared/logger.ts";
import { TeamRole, TeamJoinPolicy } from "@prisma/client";
import {
  getParam,
  sendSuccess,
  sendError,
  requireBodyFields,
  withErrorHandler,
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
  dbAdjustTeamBalance,
  dbConsumeBalanceForStudy,
  dbRefundBalanceForStudy,
  dbGetTeamAutoRefillSettings,
  dbUpdateTeamAutoRefillSettings,
  dbUpdateTeamStripeCustomer,
  dbUpdateTeamPaymentMethod,
  dbRemoveTeamPaymentMethod,
  dbGetTeamsNeedingAutoRefill,
  dbRequestTeamJoin,
  dbGetTeamJoinRequests,
  dbAcceptTeamJoinRequest,
  dbRejectTeamJoinRequest,
  dbGetBalanceLedger,
} from "@/apps/db-worker/src/services/index.ts";

interface TeamBalanceAdjustData {
  teamId: string;
  amountCents: number;
  byUserId?: string | null;
  studyId?: string | null;
  reason?: string | null;
}

export const getTeam = withErrorHandler(async (req, res) => {
  const teamId = getParam<string>(req, "teamId", "team-id");

  if (!teamId) {
    return sendError(res, "teamId is required");
  }

  const data = await dbGetTeam(teamId);
  return sendSuccess(res, data);
}, "GET /team");

export const postTeam = withErrorHandler(async (req, res) => {
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
}, "POST /team");

export const patchTeamName = withErrorHandler(async (req, res) => {
  const { teamId, userId, name } = req.body || {};

  if (!teamId || !userId || typeof name !== "string") {
    return sendError(res, "teamId, userId and name are required");
  }

  const data = await dbUpdateTeamName({ teamId, userId, name });
  return sendSuccess(res, data);
}, "PATCH /team/name");

export const patchTeamJoin = withErrorHandler(async (req, res) => {
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
}, "PATCH /team/join");

export const patchTeamDescription = withErrorHandler(async (req, res) => {
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
}, "PATCH /team/description");

export const postTeamMembers = withErrorHandler(async (req, res) => {
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
}, "POST /team/members");

export const deleteTeamMember = withErrorHandler(async (req, res) => {
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
}, "DELETE /team/members");

export const patchTeamMemberRole = withErrorHandler(async (req, res) => {
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
}, "PATCH /team/members/role");

// Team Join Request Controllers

export const postTeamRequestJoin = withErrorHandler(async (req, res) => {
  const { teamId, userId, requestNote } = req.body || {};

  if (!teamId || !userId) {
    return sendError(res, "teamId and userId are required");
  }

  const data = await dbRequestTeamJoin({ teamId, userId, requestNote });
  return sendSuccess(res, data);
}, "POST /team/request-join");

export const getTeamJoinRequests = withErrorHandler(async (req, res) => {
  const teamId = req.query.teamId as string;

  if (!teamId) {
    return sendError(res, "teamId is required");
  }

  const data = await dbGetTeamJoinRequests(teamId);
  return sendSuccess(res, data);
}, "GET /team/join-requests");

export const postAcceptTeamJoinRequest = withErrorHandler(async (req, res) => {
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

  const data = await dbAcceptTeamJoinRequest({ teamId, userId, acceptedById });
  return sendSuccess(res, data);
}, "POST /team/join-requests/accept");

export const postRejectTeamJoinRequest = withErrorHandler(async (req, res) => {
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

  const data = await dbRejectTeamJoinRequest({
    teamId,
    userId,
    rejectedById,
    rejectReason,
  });
  return sendSuccess(res, data);
}, "POST /team/join-requests/reject");

// Team Balance Controllers

export const postTeamBalanceAdjust = withErrorHandler(async (req, res) => {
  const data: TeamBalanceAdjustData = req.body;

  if (!data || !data.teamId || typeof data.amountCents !== "number") {
    logger.warn("POST /team/balance/adjust invalid payload", { data });
    return sendError(res, "teamId and amountCents are required");
  }

  const updated = await dbAdjustTeamBalance(data);
  return sendSuccess(res, updated);
}, "POST /team/balance/adjust");

export const postTeamBalanceConsumeByStudy = withErrorHandler(
  async (req, res) => {
    const { studyId, byUserId } = req.body || {};

    if (!studyId || !byUserId) {
      return sendError(res, "studyId and byUserId are required");
    }

    const result = await dbConsumeBalanceForStudy(studyId, byUserId);
    return sendSuccess(res, result);
  },
  "POST /team/balance/consume"
);

export const postTeamBalanceRefundByStudy = withErrorHandler(
  async (req, res) => {
    const { studyId, byUserId } = req.body || {};

    if (!studyId || !byUserId) {
      return sendError(res, "studyId and byUserId are required");
    }

    const result = await dbRefundBalanceForStudy(studyId, byUserId);
    return sendSuccess(res, result);
  },
  "POST /team/balance/refund"
);

export const getBalanceLedger = withErrorHandler(async (req, res) => {
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
      | "amountCents"
      | "teamName"
      | "reason"
      | "byUserName") || "createdAt";
  const sortOrder = (req.query.sortOrder as "asc" | "desc") || "desc";

  if (!userId) {
    return sendError(res, "userId is required");
  }

  const data = await dbGetBalanceLedger({
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
}, "GET /balance-ledger");

// Auto-Refill Controllers

export const getTeamAutoRefillSettings = withErrorHandler(async (req, res) => {
  const teamId = req.query.teamId as string;
  const userId = req.query.userId as string;

  if (!teamId || !userId) {
    return sendError(res, "teamId and userId are required");
  }

  const data = await dbGetTeamAutoRefillSettings(teamId, userId);
  return sendSuccess(res, data);
}, "GET /team/auto-refill");

export const postTeamAutoRefillSettings = withErrorHandler(async (req, res) => {
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
}, "POST /team/auto-refill");

export const postTeamStripeCustomer = withErrorHandler(async (req, res) => {
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
}, "POST /team/stripe-customer");

export const postTeamPaymentMethod = withErrorHandler(async (req, res) => {
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
}, "POST /team/payment-method");

export const deleteTeamPaymentMethod = withErrorHandler(async (req, res) => {
  const { teamId, userId } = req.body || {};

  if (!teamId || !userId) {
    return sendError(res, "teamId and userId are required");
  }

  const data = await dbRemoveTeamPaymentMethod({ teamId, userId });
  return sendSuccess(res, data);
}, "DELETE /team/payment-method");

export const getTeamAutoRefillStatus = withErrorHandler(async (req, res) => {
  const teamId = req.query.teamId as string;

  if (!teamId) {
    return sendError(res, "teamId is required");
  }

  const team = await dbGetTeamsNeedingAutoRefill(teamId);
  return sendSuccess(res, {
    needsRefill: team !== null,
    team,
  });
}, "GET /team/auto-refill/status");
