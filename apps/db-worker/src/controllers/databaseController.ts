// Function imports
import {
  dbDeleteStudy,
  dbGetCognitiveWalkthrough,
  dbGetCWQuestion,
  dbGetFiles,
  dbGetHeuristics,
  dbGetHeuristicEvaluation,
  dbGetPersona,
  dbListPersonas,
  dbUpdatePersona,
  dbGetStudies,
  dbGetStudy,
  dbGetUser,
  dbPostCognitiveWalkthrough,
  dbPostHeuristicEvaluation,
  dbUpdateStudyAttempts,
  dbUpdateStudyName,
  dbUpdateStudyTeam,
  dbUpdateStudyStatus,
  dbUpdateCWIssue,
  dbUpdateCWRecommendation,
  dbUpdateHEResult,
  dbUpdateHERecommendation,
  dbDeleteCWIssue,
  dbDeleteCWRecommendation,
  dbDeleteHEResult,
  dbDeleteHERecommendation,
  dbCreateCWRecommendation,
  dbCreateHERecommendation,
  dbCreateHEResult,
  dbCreateCWIssue,
  dbUpdateUserName,
  dbUpdateUserImage,
  dbInitStudy,
  dbFinalizeStudy,
  dbGetCommunicationPreferences,
  dbUpdateCommunicationPreferences,
  dbPostPersona,
  dbGetTeam,
  dbAdjustTeamCredits,
  dbConsumeCreditForStudy,
  dbRefundCreditForStudy,
  dbGetCompanyByDomain,
  dbCreateCompanyForDomain,
  dbAddCompanyMembership,
  dbRemoveCompanyMember,
  dbListCompanyMembers,
  dbListCompanyTeams,
  dbCreateTeam,
  dbUpdateTeamName,
  dbAddTeamMembers,
  dbListUserTeams,
  dbUpdateUserSelectedTeam,
  dbUpdateCompanyName,
  dbUpdateCompanyLogo,
  dbUpdateCompanyJoinSettings,
  dbListDomainUsersNotMembers,
  dbEnrollUsersToCompany,
  dbCreateCompanyInvite,
} from "@/apps/db-worker/src/services/databaseService.ts";
import { logger } from "@/apps/shared/logger.ts";
import {
  JobEnvelopeV2Schema,
  JobEnvelopeV2_HE,
  JobEnvelopeV2_CW,
  JobEnvelopeV2_PE,
} from "@/apps/shared/jobSchema.ts";
import { randomUUID } from "crypto";

// Express imports
import type { NextFunction, Request, Response } from "express";

// Prisma imports
import { StudyStatus, CompanyRole, TeamRole } from "@prisma/client";

// V2-only envelope

interface HERecommendation {
  recommendation: string;
}

interface ResultData {
  id: string;
  heuristic: string;
  violated: boolean;
  reason: string;
  recommendations: HERecommendation[];
  fileId: string;
  step: number;
}

interface HeuristicEvaluationData {
  studyData: JobEnvelopeV2_HE;
  results: ResultData[];
}

interface CognitiveWalkthroughData {
  studyData: JobEnvelopeV2_CW;
  results: CWStepData[];
}

interface CWResultData {
  questionId: string;
  answer: string;
}

interface CWIssueData {
  issueType: string;
  issue: string;
  recommendations: Array<CWRecommendationData>;
}

interface CWRecommendationData {
  recommendation: string;
}

interface CWStepData {
  step: number;
  expected: boolean;
  results: Array<CWResultData>;
  issues: Array<CWIssueData>;
}

interface TeamCreditAdjustData {
  teamId: string;
  delta: number;
  byUserId?: string | null;
  studyId?: string | null;
  reason?: string | null;
}

function convertToStudyStatus(status: string): StudyStatus | null {
  switch (status.toLowerCase()) {
    case "completed":
      return StudyStatus.COMPLETED;
    case "failed":
      return StudyStatus.FAILED;
    case "pending":
      return StudyStatus.PENDING;
    default:
      return null;
  }
}

export const deleteStudy = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const studyId =
      req.query.studyId ||
      req.body.studyId ||
      req.params.studyId ||
      req.headers["study-id"];

    if (!studyId) {
      logger.warn("DELETE /study request rejected: missing studyId");
      res.status(400).json({ success: false, message: "Study ID is required" });
      return;
    }

    const userId =
      req.query.userId ||
      req.body.userId ||
      req.params.userId ||
      req.headers["user-id"];

    if (!userId) {
      logger.warn("DELETE /study request rejected: missing userId");
      res.status(400).json({ success: false, message: "User ID is required" });
      return;
    }

    logger.debug("DELETE /study request received", { studyId, userId });
    const data = await dbDeleteStudy(studyId, userId);
    logger.debug("DELETE /study request completed successfully", {
      studyId,
      userId,
    });
    res.status(200).json({ success: true, data });
  } catch (error) {
    logger.error("DELETE /study request failed", { error });
    next(error);
  }
};

// Company/domain controllers
export const getCompanyByDomain = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const domain =
      (req.query.domain as string) ||
      (req.body.domain as string) ||
      (req.params.domain as string);
    if (!domain || typeof domain !== "string") {
      logger.warn("GET /company/by-domain missing domain");
      return res
        .status(400)
        .json({ success: false, message: "domain is required" });
    }
    const data = await dbGetCompanyByDomain(domain);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    logger.error("GET /company/by-domain failed", { error });
    return next(error);
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
      return res
        .status(400)
        .json({ success: false, message: "domain is required" });
    }
    const data = await dbCreateCompanyForDomain({ domain, name, userId });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    logger.error("POST /company/create-for-domain failed", { error });
    return next(error);
  }
};

export const getCompanyMembers = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const companyId =
      (req.query.companyId as string) || (req.body.companyId as string);
    if (!companyId) {
      return res
        .status(400)
        .json({ success: false, message: "companyId is required" });
    }
    const data = await dbListCompanyMembers(companyId);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    logger.error("GET /company/members failed", { error });
    return next(error);
  }
};

export const getCompanyTeams = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const companyId =
      (req.query.companyId as string) || (req.body.companyId as string);
    if (!companyId) {
      return res
        .status(400)
        .json({ success: false, message: "companyId is required" });
    }
    const data = await dbListCompanyTeams(companyId);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    logger.error("GET /company/teams failed", { error });
    return next(error);
  }
};

export const patchCompanyName = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { companyId, userId, name } = req.body || {};
    if (!companyId || !userId || !name) {
      return res.status(400).json({
        success: false,
        message: "companyId, userId and name are required",
      });
    }
    const data = await dbUpdateCompanyName({ companyId, userId, name });
    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    if ((error as any)?.status === 403) {
      return res.status(403).json({ success: false, message: error.message });
    }
    logger.error("PATCH /company/name failed", { error });
    return next(error);
  }
};

export const patchCompanyLogo = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { companyId, userId, logoKey } = req.body || {};
    if (!companyId || !userId) {
      return res.status(400).json({
        success: false,
        message: "companyId and userId are required",
      });
    }
    const data = await dbUpdateCompanyLogo({
      companyId,
      userId,
      logoKey: logoKey || null,
    });
    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    if ((error as any)?.status === 403) {
      return res.status(403).json({ success: false, message: error.message });
    }
    logger.error("PATCH /company/image failed", { error });
    return next(error);
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
      return res.status(400).json({
        success: false,
        message: "companyId, userId and autoEnroll are required",
      });
    }
    const data = await dbUpdateCompanyJoinSettings({
      companyId,
      userId,
      autoEnroll,
    });
    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    if ((error as any)?.status === 403) {
      return res.status(403).json({ success: false, message: error.message });
    }
    logger.error("PATCH /company/join failed", { error });
    return next(error);
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
      return res
        .status(400)
        .json({ success: false, message: "companyId and domain are required" });
    }
    const data = await dbListDomainUsersNotMembers({ companyId, domain });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    logger.error("GET /company/domain-users failed", { error });
    return next(error);
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
      return res.status(400).json({
        success: false,
        message: "companyId and userIds[] are required",
      });
    }
    await dbEnrollUsersToCompany({
      companyId,
      userIds,
      invitedById: invitedById || null,
    });
    return res.status(200).json({ success: true });
  } catch (error) {
    logger.error("POST /company/enroll failed", { error });
    return next(error);
  }
};

export const postCompanyMember = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { companyId, userId, role, invitedById } = req.body || {};
    if (!companyId || !userId || !role) {
      return res.status(400).json({
        success: false,
        message: "companyId, userId and role are required",
      });
    }
    // Validate role against Prisma enum
    const roleUpper = String(role).toUpperCase();
    const validRoles = Object.values(CompanyRole);
    if (!validRoles.includes(roleUpper as CompanyRole)) {
      return res.status(400).json({
        success: false,
        message: `Invalid role. Must be one of: ${validRoles.join(", ")}`,
      });
    }

    const data = await dbAddCompanyMembership({
      companyId,
      userId,
      role: roleUpper as CompanyRole,
      invitedById,
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    logger.error("POST /company/members failed", { error });
    return next(error);
  }
};

export const deleteCompanyMember = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { companyId, userId, requestedById } = req.body || {};
    if (!companyId || !userId || !requestedById) {
      return res.status(400).json({
        success: false,
        message: "companyId, userId and requestedById are required",
      });
    }
    const data = await dbRemoveCompanyMember({
      companyId,
      userId,
      requestedById,
    });
    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    if ((error as any)?.status === 400 || (error as any)?.status === 403) {
      return res
        .status((error as any).status)
        .json({ success: false, message: error.message });
    }
    logger.error("DELETE /company/members failed", { error });
    return next(error);
  }
};

export const postCompanyInvite = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { companyId, email, role, invitedById } = req.body || {};
    if (!companyId || !email || !role) {
      return res.status(400).json({
        success: false,
        message: "companyId, email and role are required",
      });
    }
    const roleUpper = String(role).toUpperCase();
    const validRoles = Object.values(CompanyRole);
    if (!validRoles.includes(roleUpper as CompanyRole)) {
      return res.status(400).json({
        success: false,
        message: `Invalid role. Must be one of: ${validRoles.join(", ")}`,
      });
    }
    const token = randomUUID();
    const data = await dbCreateCompanyInvite({
      companyId,
      email,
      role: roleUpper as CompanyRole,
      token,
      invitedById,
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    logger.error("POST /company/invite failed", { error });
    return next(error);
  }
};

export const getCWQuestion = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const version =
      Number(req.query.version) ||
      Number(req.body.version) ||
      Number(req.params.version) ||
      Number(req.headers["version"]);

    if (!version) {
      logger.warn("GET /cw-questions request rejected: missing version");
      res.status(400).json({
        success: false,
        message: "Cognitive walkthrough question version is required",
      });
      return;
    }

    if (isNaN(version)) {
      logger.warn("GET /cw-questions request rejected: invalid version", {
        version,
      });
      res.status(400).json({
        success: false,
        message: "Cognitive walkthrough question version must be a number",
      });
      return;
    }

    logger.debug("GET /cw-questions request received", { version });
    const data = await dbGetCWQuestion(version);
    logger.debug("GET /cw-questions request completed", {
      version,
      questionCount: data.length,
    });
    res.status(200).json({ success: true, data });
  } catch (error) {
    logger.error("GET /cw-questions request failed", { error });
    next(error);
  }
};

export const getFiles = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const studyId =
      req.query.studyId ||
      req.body.studyId ||
      req.params.studyId ||
      req.headers["studyId"];

    if (!studyId) {
      logger.warn("GET /files request rejected: missing studyId");
      res.status(400).json({ success: false, message: "studyId is required" });
      return;
    }

    logger.debug("GET /files request received", { studyId });
    const data = await dbGetFiles(studyId);
    logger.debug("GET /files request completed", {
      studyId,
      fileCount: data.length,
    });
    res.status(200).json({ success: true, data });
  } catch (error) {
    logger.error("GET /files request failed", { error });
    next(error);
  }
};

export const getHeuristics = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const familyKey =
      req.query.type || req.body.type || req.params.type || req.headers["type"];
    const familyId =
      req.query.familyId || req.body.familyId || req.headers["family-id"];
    const companyId = req.query.companyId || req.headers["company-id"];

    const companyIdStr = (
      Array.isArray(companyId) ? companyId[0] : companyId
    ) as string | undefined;
    const familyKeyStr = familyKey
      ? ((Array.isArray(familyKey) ? familyKey[0] : familyKey) as string)
      : undefined;
    const familyIdStr = familyId
      ? ((Array.isArray(familyId) ? familyId[0] : familyId) as string)
      : undefined;

    if (!familyKeyStr && !familyIdStr) {
      logger.warn("GET /heuristics request rejected: missing family key or id");
      res.status(400).json({
        success: false,
        message: "Heuristic family key or id is required",
      });
      return;
    }

    logger.debug("GET /heuristics request received", {
      familyKey: familyKeyStr,
      familyId: familyIdStr,
      companyId: companyIdStr,
    });

    const data = await dbGetHeuristics(familyKeyStr, familyIdStr, companyIdStr);

    logger.debug("GET /heuristics request completed", {
      familyKey: familyKeyStr,
      familyId: familyIdStr,
      heuristicCount: data.length,
    });
    res.status(200).json({ success: true, data });
  } catch (error) {
    logger.error("GET /heuristics request failed", { error });
    next(error);
  }
};

export const getStudies = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userIdRaw =
      req.query.userId ||
      req.body.userId ||
      req.params.userId ||
      req.headers["user-id"];
    const userId = Array.isArray(userIdRaw) ? userIdRaw[0] : userIdRaw;

    if (!userId) {
      logger.warn("GET /studies request rejected: missing userId");
      res.status(400).json({ success: false, message: "User ID is required" });
      return;
    }

    const teamIdRaw =
      req.query.teamId ||
      req.body.teamId ||
      req.params.teamId ||
      req.headers["team-id"];
    const teamIdValue = Array.isArray(teamIdRaw) ? teamIdRaw[0] : teamIdRaw;
    const teamId =
      typeof teamIdValue === "string" && teamIdValue.trim().length > 0
        ? teamIdValue
        : undefined;

    logger.debug("GET /studies request received", { userId, teamId });
    const data = await dbGetStudies(userId, teamId);
    logger.debug("GET /studies request completed", {
      userId,
      teamId,
      studyCount: data.length,
    });
    res.status(200).json({ success: true, data });
  } catch (error) {
    logger.error("GET /studies request failed", { error });
    next(error);
  }
};

export const getStudy = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const studyId =
      req.query.studyId ||
      req.body.studyId ||
      req.params.studyId ||
      req.headers["study-id"];

    if (!studyId) {
      logger.warn("GET /study request rejected: missing studyId");
      res.status(400).json({ success: false, message: "Study ID is required" });
      return;
    }

    const userId =
      req.query.userId ||
      req.body.userId ||
      req.params.userId ||
      req.headers["user-id"];

    if (!userId) {
      logger.warn("GET /study request rejected: missing userId");
      res.status(400).json({ success: false, message: "User ID is required" });
      return;
    }

    logger.debug("GET /study request received", { studyId, userId });
    const data = await dbGetStudy(studyId, userId);
    logger.debug("GET /study request completed", {
      studyId,
      userId,
      found: !!data,
    });
    res.status(200).json({ success: true, data });
  } catch (error) {
    logger.error("GET /study request failed", { error });
    next(error);
  }
};

export const getUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId =
      req.query.userId ||
      req.body.userId ||
      req.params.userId ||
      req.headers["user-id"];

    if (!userId) {
      logger.warn("GET /user request rejected: missing userId");
      res.status(400).json({ success: false, message: "User ID is required" });
      return;
    }

    logger.debug("GET /user request received", { userId });
    const data = await dbGetUser(userId);
    logger.debug("GET /user request completed", { userId, found: !!data });
    res.status(200).json({ success: true, data });
  } catch (error) {
    logger.error("GET /user request failed", { error });
    next(error);
  }
};

export const getUserTeams = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId =
      (req.query.userId as string) ||
      (req.body.userId as string) ||
      (req.params.userId as string) ||
      (req.headers["user-id"] as string | undefined);

    if (!userId) {
      logger.warn("GET /user/teams request rejected: missing userId");
      res.status(400).json({ success: false, message: "userId is required" });
      return;
    }

    logger.debug("GET /user/teams request received", { userId });
    const data = await dbListUserTeams(userId);
    res.status(200).json({ success: true, data });
  } catch (error) {
    logger.error("GET /user/teams request failed", { error });
    next(error);
  }
};

export const postStudyAttempts = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const data = req.body;

    if (!data) {
      logger.warn("POST /study-attempts request rejected: no data provided");
      res
        .status(400)
        .json({ success: false, message: "There is no data to process" });
      return;
    }

    logger.debug("POST /study-attempts request received", {
      studyId: data.studyId,
    });
    const study = await dbUpdateStudyAttempts(data.studyId);
    logger.debug("POST /study-attempts request completed", {
      studyId: data.studyId,
    });
    res.status(200).json({ success: true, data: study });
  } catch (error) {
    logger.error("POST /study-attempts request failed", { error });
    next(error);
  }
};

export const postStudyStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const data = req.body;

    if (!data) {
      logger.warn("POST /study-status request rejected: no data provided");
      res
        .status(400)
        .json({ success: false, message: "There is no data to process" });
      return;
    }

    const status = convertToStudyStatus(data.status);

    if (!status) {
      logger.warn("POST /study-status request rejected: invalid status", {
        status: data.status,
      });
      res.status(400).json({ success: false, message: "Invalid study status" });
      return;
    }

    logger.debug("POST /study-status request received", {
      studyId: data.studyId,
      status,
    });
    const study = await dbUpdateStudyStatus(data.studyId, status);
    logger.debug("POST /study-status request completed", {
      studyId: data.studyId,
      status,
    });
    res.status(200).json({ success: true, data: study });
  } catch (error) {
    logger.error("POST /study-status request failed", { error });
    next(error);
  }
};

export const postHeuristicEvaluation = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const data: HeuristicEvaluationData = req.body;
    // Require v2 envelope and validate
    const parsed = JobEnvelopeV2Schema.safeParse(data?.studyData);
    if (!parsed.success) {
      logger.warn("POST /heuristic-evaluation invalid v2 jobData", {
        issues: parsed.error.issues,
      });
      return res
        .status(400)
        .json({ success: false, message: "Invalid jobData" });
    }

    if (!data) {
      logger.warn(
        "POST /heuristic-evaluation request rejected: no data provided"
      );
      return res
        .status(400)
        .json({ success: false, message: "There is no data to process" });
    }

    logger.debug("POST /heuristic-evaluation request received", {
      studyId: data.studyData?.studyId,
      resultCount: data.results?.length,
    });
    await dbPostHeuristicEvaluation(data);
    logger.debug("POST /heuristic-evaluation request completed", {
      studyId: data.studyData?.studyId,
    });
    return res.status(200).json({ success: true });
  } catch (error) {
    logger.error("POST /heuristic-evaluation request failed", { error });
    return next(error);
  }
};

export const postCognitiveWalkthrough = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const data: CognitiveWalkthroughData = req.body;
    // Require v2 envelope and validate
    const parsed = JobEnvelopeV2Schema.safeParse(data?.studyData);
    if (!parsed.success) {
      logger.warn("POST /cognitive-walkthrough invalid v2 jobData", {
        issues: parsed.error.issues,
      });
      return res
        .status(400)
        .json({ success: false, message: "Invalid jobData" });
    }

    if (!data) {
      logger.warn(
        "POST /cognitive-walkthrough request rejected: no data provided"
      );
      return res
        .status(400)
        .json({ success: false, message: "There is no data to process" });
    }

    logger.debug("POST /cognitive-walkthrough request received", {
      studyId: data.studyData?.studyId,
      resultCount: data.results?.length,
    });
    await dbPostCognitiveWalkthrough(data);
    logger.debug("POST /cognitive-walkthrough request completed", {
      studyId: data.studyData?.studyId,
    });
    return res.status(200).json({ success: true });
  } catch (error) {
    logger.error("POST /cognitive-walkthrough request failed", { error });
    return next(error);
  }
};

// Team credit endpoints
export const postTeam = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { companyId, userId, name, members } = req.body || {};
    if (!companyId || !userId || !name) {
      return res.status(400).json({
        success: false,
        message: "companyId, userId and name are required",
      });
    }
    const data = await dbCreateTeam({
      companyId,
      userId,
      name,
      members: Array.isArray(members) ? members : [],
    });
    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    if ((error as any)?.status === 403) {
      return res.status(403).json({ success: false, message: error.message });
    }
    if ((error as any)?.status === 400) {
      return res.status(400).json({ success: false, message: error.message });
    }
    logger.error("POST /team failed", { error });
    return next(error);
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
      return res.status(400).json({
        success: false,
        message: "teamId, userId and name are required",
      });
    }

    const data = await dbUpdateTeamName({
      teamId,
      userId,
      name,
    });

    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    const status = (error as any)?.status;
    if (status) {
      return res
        .status(status)
        .json({ success: false, message: error.message });
    }
    logger.error("PATCH /team/name failed", { error });
    return next(error);
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
      return res.status(400).json({
        success: false,
        message: "teamId, invitedById and members[] are required",
      });
    }

    const normalizedMembers = members
      .map((member: any) => ({
        userId: typeof member?.userId === "string" ? member.userId : "",
        role: String(member?.role || "").toUpperCase(),
      }))
      .filter((member) => member.userId);

    if (!normalizedMembers.length) {
      return res.status(400).json({
        success: false,
        message: "members[] must include at least one valid userId",
      });
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
      return res.status(400).json({
        success: false,
        message: `Invalid role. Must be one of: ${allowedRoles.join(", ")}`,
      });
    }

    const data = await dbAddTeamMembers({
      teamId,
      invitedById,
      members: normalizedMembers.map((member) => ({
        userId: member.userId,
        role: member.role as TeamRole,
      })),
    });

    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    if ((error as any)?.status === 400) {
      return res.status(400).json({ success: false, message: error.message });
    }
    if ((error as any)?.status === 403) {
      return res.status(403).json({ success: false, message: error.message });
    }
    if ((error as any)?.status === 404) {
      return res.status(404).json({ success: false, message: error.message });
    }
    logger.error("POST /team/members failed", { error });
    return next(error);
  }
};

export const getTeam = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const teamId =
      (req.query.teamId as string) ||
      (req.body.teamId as string) ||
      (req.params.teamId as string) ||
      (req.headers["team-id"] as string);

    if (!teamId) {
      logger.warn("GET /team request rejected: missing teamId");
      return res
        .status(400)
        .json({ success: false, message: "teamId is required" });
    }
    const data = await dbGetTeam(teamId);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    logger.error("GET /team request failed", { error });
    return next(error);
  }
};

export const postTeamCreditsAdjust = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const data: TeamCreditAdjustData = req.body;
    if (!data || !data.teamId || typeof data.delta !== "number") {
      logger.warn("POST /team/credits/adjust invalid payload", { data });
      return res
        .status(400)
        .json({ success: false, message: "teamId and delta are required" });
    }
    const updated = await dbAdjustTeamCredits(data);
    return res.status(200).json({ success: true, data: updated });
  } catch (error) {
    logger.error("POST /team/credits/adjust failed", { error });
    return next(error);
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
      return res
        .status(400)
        .json({ success: false, message: "studyId and byUserId are required" });
    }
    const result = await dbConsumeCreditForStudy(studyId, byUserId);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logger.error("POST /team/credits/consume failed", { error });
    return next(error);
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
      return res
        .status(400)
        .json({ success: false, message: "studyId and byUserId are required" });
    }
    const result = await dbRefundCreditForStudy(studyId, byUserId);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    logger.error("POST /team/credits/refund failed", { error });
    return next(error);
  }
};

export const updateCWIssue = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { issue } = req.body;

    if (!id) {
      logger.warn("PUT /cw-issue request rejected: missing id");
      res.status(400).json({ success: false, message: "Issue ID is required" });
      return;
    }

    if (!issue) {
      logger.warn("PUT /cw-issue request rejected: missing issue content", {
        id,
      });
      res
        .status(400)
        .json({ success: false, message: "Issue content is required" });
      return;
    }

    logger.debug("PUT /cw-issue request received", { id });
    const data = await dbUpdateCWIssue(id, issue);
    logger.debug("PUT /cw-issue request completed", { id });
    res.status(200).json({ success: true, data });
  } catch (error) {
    logger.error("PUT /cw-issue request failed", { error });
    next(error);
  }
};

export const updateCWRecommendation = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { recommendation } = req.body;

    if (!id) {
      logger.warn("PUT /cw-recommendation request rejected: missing id");
      res
        .status(400)
        .json({ success: false, message: "Recommendation ID is required" });
      return;
    }

    if (!recommendation) {
      logger.warn(
        "PUT /cw-recommendation request rejected: missing recommendation content",
        { id }
      );
      res.status(400).json({
        success: false,
        message: "Recommendation content is required",
      });
      return;
    }

    logger.debug("PUT /cw-recommendation request received", { id });
    const data = await dbUpdateCWRecommendation(id, recommendation);
    logger.debug("PUT /cw-recommendation request completed", { id });
    res.status(200).json({ success: true, data });
  } catch (error) {
    logger.error("PUT /cw-recommendation request failed", { error });
    next(error);
  }
};

export const updateHEResult = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { issue } = req.body;

    if (!id) {
      logger.warn("PUT /he-result request rejected: missing id");
      res
        .status(400)
        .json({ success: false, message: "Result ID is required" });
      return;
    }

    if (!issue) {
      logger.warn("PUT /he-result request rejected: missing issue content", {
        id,
      });
      res
        .status(400)
        .json({ success: false, message: "Result reason is required" });
      return;
    }

    logger.debug("PUT /he-result request received", { id });
    const data = await dbUpdateHEResult(id, issue);
    logger.debug("PUT /he-result request completed", { id });
    res.status(200).json({ success: true, data });
  } catch (error) {
    logger.error("PUT /he-result request failed", { error });
    next(error);
  }
};

export const updateHERecommendation = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { recommendation } = req.body;

    if (!id) {
      logger.warn("PUT /he-recommendation request rejected: missing id");
      res
        .status(400)
        .json({ success: false, message: "Recommendation ID is required" });
      return;
    }

    if (!recommendation) {
      logger.warn(
        "PUT /he-recommendation request rejected: missing recommendation content",
        { id }
      );
      res.status(400).json({
        success: false,
        message: "Recommendation content is required",
      });
      return;
    }

    logger.debug("PUT /he-recommendation request received", { id });
    const data = await dbUpdateHERecommendation(id, recommendation);
    logger.debug("PUT /he-recommendation request completed", { id });
    res.status(200).json({ success: true, data });
  } catch (error) {
    logger.error("PUT /he-recommendation request failed", { error });
    next(error);
  }
};

export const deleteCWIssue = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    if (!id) {
      logger.warn("DELETE /cw-issue request rejected: missing id");
      res.status(400).json({ success: false, message: "Issue ID is required" });
      return;
    }

    logger.debug("DELETE /cw-issue request received", { id });
    const data = await dbDeleteCWIssue(id);
    logger.debug("DELETE /cw-issue request completed", { id });
    res.status(200).json({ success: true, data });
  } catch (error) {
    logger.error("DELETE /cw-issue request failed", { error });
    next(error);
  }
};

export const deleteCWRecommendation = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    if (!id) {
      logger.warn("DELETE /cw-recommendation request rejected: missing id");
      res
        .status(400)
        .json({ success: false, message: "Recommendation ID is required" });
      return;
    }

    logger.debug("DELETE /cw-recommendation request received", { id });
    const data = await dbDeleteCWRecommendation(id);
    logger.debug("DELETE /cw-recommendation request completed", { id });
    res.status(200).json({ success: true, data });
  } catch (error) {
    logger.error("DELETE /cw-recommendation request failed", { error });
    next(error);
  }
};

export const deleteHEResult = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    if (!id) {
      logger.warn("DELETE /he-result request rejected: missing id");
      res
        .status(400)
        .json({ success: false, message: "Result ID is required" });
      return;
    }

    logger.debug("DELETE /he-result request received", { id });
    const data = await dbDeleteHEResult(id);
    logger.debug("DELETE /he-result request completed", { id });
    res.status(200).json({ success: true, data });
  } catch (error) {
    logger.error("DELETE /he-result request failed", { error });
    next(error);
  }
};

export const deleteHERecommendation = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    if (!id) {
      logger.warn("DELETE /he-recommendation request rejected: missing id");
      res
        .status(400)
        .json({ success: false, message: "Recommendation ID is required" });
      return;
    }

    logger.debug("DELETE /he-recommendation request received", { id });
    const data = await dbDeleteHERecommendation(id);
    logger.debug("DELETE /he-recommendation request completed", { id });
    res.status(200).json({ success: true, data });
  } catch (error) {
    logger.error("DELETE /he-recommendation request failed", { error });
    next(error);
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
      return res
        .status(400)
        .json({ success: false, message: "Invalid jobData" });
    }
    if (!persona) {
      logger.warn("POST /persona missing persona payload");
      return res
        .status(400)
        .json({ success: false, message: "Missing persona" });
    }
    await dbPostPersona({
      studyData: parsed.data as JobEnvelopeV2_PE,
      persona,
    });
    logger.debug("POST /persona completed", {
      studyId: parsed.data.studyId,
    });
    return res.status(200).json({ success: true });
  } catch (error) {
    logger.error("POST /persona failed", { error });
    return next(error);
  }
};

export const createCWRecommendation = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { issueId, recommendation, source } = req.body;
    if (!issueId || !recommendation || !source) {
      logger.warn("POST /cw-recommendation request rejected: missing fields", {
        hasIssueId: !!issueId,
        hasRecommendation: !!recommendation,
        hasSource: !!source,
      });
      res.status(400).json({
        success: false,
        message: "issueId, recommendation, and source are required",
      });
      return;
    }

    logger.debug("POST /cw-recommendation request received", {
      issueId,
      source,
    });
    const data = await dbCreateCWRecommendation(
      issueId,
      recommendation,
      source
    );
    logger.debug("POST /cw-recommendation request completed", {
      issueId,
      recommendationId: data.id,
    });
    res.status(201).json({ success: true, data });
  } catch (error) {
    logger.error("POST /cw-recommendation request failed", { error });
    next(error);
  }
};

export const createHERecommendation = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { resultId, recommendation, source } = req.body;
    if (!resultId || !recommendation || !source) {
      logger.warn(
        "POST /he-recommendation request rejected: missing required fields",
        {
          hasResultId: !!resultId,
          hasRecommendation: !!recommendation,
          hasSource: !!source,
        }
      );
      res.status(400).json({
        success: false,
        message: "resultId, recommendation, and source are required",
      });
      return;
    }

    logger.debug("POST /he-recommendation request received", {
      resultId,
      source,
    });
    const data = await dbCreateHERecommendation(
      resultId,
      recommendation,
      source
    );
    logger.debug("POST /he-recommendation request completed", {
      resultId,
      source,
      recommendationId: data.id,
    });
    res.status(201).json({ success: true, data });
  } catch (error) {
    logger.error("POST /he-recommendation request failed", { error });
    next(error);
  }
};

export const createHEResult = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { heuristicEvaluationId, heuristicId, step, fileId, reason, source } =
      req.body;
    if (
      !heuristicEvaluationId ||
      !heuristicId ||
      !step ||
      !fileId ||
      !reason ||
      !source
    ) {
      logger.warn("POST /he-result request rejected: missing required fields", {
        hasHeuristicEvaluationId: !!heuristicEvaluationId,
        hasHeuristicId: !!heuristicId,
        hasStep: !!step,
        hasFileId: !!fileId,
        hasReason: !!reason,
        hasSource: !!source,
      });
      res
        .status(400)
        .json({ success: false, message: "Missing required fields" });
      return;
    }

    logger.debug("POST /he-result request received", {
      heuristicEvaluationId,
      heuristicId,
      step,
    });
    const result = await dbCreateHEResult({
      heuristicEvaluationId,
      heuristicId,
      step,
      fileId,
      reason,
      source,
    });
    logger.debug("POST /he-result request completed", {
      heuristicEvaluationId,
      heuristicId,
      step,
      resultId: result.id,
    });
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    logger.error("POST /he-result request failed", { error });
    next(error);
  }
};

export const createCWIssue = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { stepId, issueType, issue, source } = req.body;
    if (!stepId || !issueType || !issue || !source) {
      logger.warn("POST /cw-issue request rejected: missing fields", {
        hasStepId: !!stepId,
        hasIssueType: !!issueType,
        hasIssue: !!issue,
        hasSource: !!source,
      });
      res
        .status(400)
        .json({ success: false, message: "Missing required fields" });
      return;
    }

    logger.debug("POST /cw-issue request received", {
      stepId,
      issueType,
      source,
    });
    const result = await dbCreateCWIssue({
      stepId,
      issueType,
      issue,
      source,
    });
    logger.debug("POST /cw-issue request completed", {
      stepId,
      issueId: result.id,
    });
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    logger.error("POST /cw-issue request failed", { error });
    next(error);
  }
};

export const getCognitiveWalkthrough = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const studyId =
      req.query.studyId ||
      req.body.studyId ||
      req.params.studyId ||
      req.headers["study-id"];

    if (!studyId) {
      logger.warn(
        "GET /cognitiveWalkthrough request rejected: missing studyId"
      );
      res.status(400).json({ success: false, message: "Study ID is required" });
      return;
    }

    const userId =
      req.query.userId ||
      req.body.userId ||
      req.params.userId ||
      req.headers["user-id"];

    if (!userId) {
      logger.warn("GET /cognitiveWalkthrough request rejected: missing userId");
      res.status(400).json({ success: false, message: "User ID is required" });
      return;
    }

    const data = await dbGetCognitiveWalkthrough(studyId, userId);
    logger.debug("GET /cognitiveWalkthrough request completed", {
      studyId,
      userId,
      found: !!data,
    });
    res.status(200).json({ success: true, data });
  } catch (error) {
    logger.error("GET /cognitiveWalkthrough request failed", { error });
    next(error);
  }
};

export const getHeuristicEvaluation = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const studyId =
      req.query.studyId ||
      req.body.studyId ||
      req.params.studyId ||
      req.headers["study-id"];

    if (!studyId) {
      logger.warn("GET /heuristicEvaluation request rejected: missing studyId");
      res.status(400).json({ success: false, message: "Study ID is required" });
      return;
    }

    const userId =
      req.query.userId ||
      req.body.userId ||
      req.params.userId ||
      req.headers["user-id"];

    if (!userId) {
      logger.warn("GET /heuristicEvaluation request rejected: missing userId");
      res.status(400).json({ success: false, message: "User ID is required" });
      return;
    }

    const data = await dbGetHeuristicEvaluation(studyId, userId);
    logger.debug("GET /heuristicEvaluation request completed", {
      studyId,
      userId,
      found: !!data,
    });
    res.status(200).json({ success: true, data });
  } catch (error) {
    logger.error("GET /heuristicEvaluation request failed", { error });
    next(error);
  }
};

export const getPersona = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const studyId =
      (req.query.studyId as string) ||
      (req.body.studyId as string) ||
      (req.params.studyId as string) ||
      (req.headers["study-id"] as string);

    if (!studyId) {
      logger.warn("GET /persona request rejected: missing studyId");
      res.status(400).json({ success: false, message: "Study ID is required" });
      return;
    }

    const userId =
      (req.query.userId as string) ||
      (req.body.userId as string) ||
      (req.params.userId as string) ||
      (req.headers["user-id"] as string);

    if (!userId) {
      logger.warn("GET /persona request rejected: missing userId");
      res.status(400).json({ success: false, message: "User ID is required" });
      return;
    }

    const data = await dbGetPersona(studyId, userId);
    logger.debug("GET /persona request completed", {
      studyId,
      userId,
      found: !!data,
    });
    res.status(200).json({ success: true, data });
  } catch (error) {
    logger.error("GET /persona request failed", { error });
    next(error);
  }
};

export const getPersonas = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId =
      (req.query.userId as string) ||
      (req.body.userId as string) ||
      (req.params.userId as string) ||
      (req.headers["user-id"] as string);

    if (!userId) {
      logger.warn("GET /personas request rejected: missing userId");
      res.status(400).json({ success: false, message: "User ID is required" });
      return;
    }

    const teamId =
      (req.query.teamId as string) ||
      (req.body.teamId as string) ||
      (req.params.teamId as string) ||
      (req.headers["team-id"] as string);

    if (!teamId) {
      logger.warn("GET /personas request rejected: missing teamId", { userId });
      res.status(400).json({ success: false, message: "Team ID is required" });
      return;
    }

    const data = await dbListPersonas(userId, teamId);
    logger.debug("GET /personas request completed", {
      userId,
      teamId,
      count: data.length,
    });
    res.status(200).json({ success: true, data });
  } catch (error) {
    logger.error("GET /personas request failed", { error });
    next(error);
  }
};

export const updatePersona = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { studyId, userId, data } = req.body;

    if (!studyId) {
      logger.warn("PATCH /persona/update request rejected: missing studyId");
      res.status(400).json({ success: false, message: "Study ID is required" });
      return;
    }

    if (!userId) {
      logger.warn("PATCH /persona/update request rejected: missing userId");
      res.status(400).json({ success: false, message: "User ID is required" });
      return;
    }

    if (!data) {
      logger.warn("PATCH /persona/update request rejected: missing data");
      res.status(400).json({ success: false, message: "Data is required" });
      return;
    }

    const result = await dbUpdatePersona(studyId, userId, data);
    logger.debug("PATCH /persona/update request completed", {
      studyId,
      userId,
    });
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    logger.error("PATCH /persona/update request failed", { error });
    next(error);
  }
};

export const updateStudyName = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { studyId, name } = req.body;

    if (!studyId) {
      logger.warn("PATCH /study/name request rejected: missing studyId");
      res.status(400).json({ success: false, message: "Study ID is required" });
      return;
    }

    if (!name) {
      logger.warn("PATCH /study/name request rejected: missing name");
      res.status(400).json({ success: false, message: "Name is required" });
      return;
    }

    const data = await dbUpdateStudyName(studyId, name);
    logger.debug("PATCH /study/name request completed", {
      studyId,
      name,
    });
    res.status(200).json({ success: true, data });
  } catch (error) {
    logger.error("PATCH /study/name request failed", { error });
    next(error);
  }
};

export const patchStudyTeam = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { studyId, teamId, byUserId } = req.body || {};

    if (!studyId) {
      logger.warn("PATCH /study/team request rejected: missing studyId");
      res.status(400).json({ success: false, message: "studyId is required" });
      return;
    }

    if (!teamId) {
      logger.warn("PATCH /study/team request rejected: missing teamId", {
        studyId,
      });
      res.status(400).json({ success: false, message: "teamId is required" });
      return;
    }

    if (!byUserId) {
      logger.warn("PATCH /study/team request rejected: missing byUserId", {
        studyId,
        teamId,
      });
      res.status(400).json({ success: false, message: "byUserId is required" });
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
    res.status(200).json({ success: true, data });
  } catch (error) {
    if ((error as any)?.code === "NOT_MEMBER") {
      res.status(403).json({
        success: false,
        message: "User is not a member of the requested team",
      });
      return;
    }
    if ((error as any)?.code === "NOT_FOUND") {
      res.status(404).json({ success: false, message: "Study not found" });
      return;
    }
    logger.error("PATCH /study/team request failed", { error });
    next(error);
  }
};

export const updateUserName = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId, name } = req.body;

    if (!userId) {
      logger.warn("PATCH /user/name request rejected: missing userId");
      res.status(400).json({ success: false, message: "User ID is required" });
      return;
    }

    if (!name) {
      logger.warn("PATCH /user/name request rejected: missing name");
      res.status(400).json({ success: false, message: "Name is required" });
      return;
    }

    const data = await dbUpdateUserName(userId, name);
    logger.debug("PATCH /user/name request completed", { userId, name });

    res.status(200).json({ success: true, data });
  } catch (error) {
    logger.error("PATCH /user/name request failed", { error });
    next(error);
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
      res.status(400).json({ success: false, message: "User ID is required" });
      return;
    }

    // imageKey can be null to remove a custom image
    const data = await dbUpdateUserImage(userId, imageKey || null);
    logger.debug("PATCH /user/image request completed", { userId, imageKey });

    res.status(200).json({ success: true, data });
  } catch (error) {
    logger.error("PATCH /user/image request failed", { error });
    next(error);
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
    res.status(400).json({ success: false, message: "userId is required" });
    return;
  }

  if (!teamId) {
    logger.warn("PATCH /user/selected-team request rejected: missing teamId");
    res.status(400).json({ success: false, message: "teamId is required" });
    return;
  }

  try {
    const data = await dbUpdateUserSelectedTeam({ userId, teamId });
    res.status(200).json({ success: true, data });
  } catch (error) {
    if ((error as any)?.code === "NOT_MEMBER") {
      res.status(403).json({
        success: false,
        message: "User is not a member of the requested team",
      });
      return;
    }
    logger.error("PATCH /user/selected-team request failed", {
      userId,
      teamId,
      error,
    });
    next(error);
  }
};

export const postStudyInit = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId, teamId, name, type } = req.body || {};
    if (!userId || !teamId || !type) {
      res.status(400).json({
        success: false,
        message: "userId, teamId, and type are required",
      });
      return;
    }
    const study = await dbInitStudy({ userId, teamId, name, type });
    res.status(200).json({ success: true, data: study });
  } catch (error) {
    logger.error("POST /study/init failed", { error });
    next(error);
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
      res
        .status(400)
        .json({ success: false, message: "studyId and files[] are required" });
      return;
    }
    const study = await dbFinalizeStudy({ studyId, files, jobData });
    res.status(200).json({ success: true, data: study });
  } catch (error) {
    logger.error("POST /study/finalize failed", { error });
    next(error);
  }
};

export const getCommunicationPreferences = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId =
      req.query.userId ||
      req.body.userId ||
      req.params.userId ||
      req.headers["user-id"];
    if (!userId || typeof userId !== "string") {
      logger.warn("GET /communication-preferences missing userId");
      return res.status(400).json({ success: false, error: "Missing userId" });
    }
    const data = await dbGetCommunicationPreferences(userId);
    logger.debug("GET /communication-preferences request completed", {
      userId,
      found: !!data,
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    logger.error("GET /communication-preferences request failed", { error });
    return next(error);
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
      return res.status(400).json({ success: false, error: "Missing userId" });
    }
    const data = await dbUpdateCommunicationPreferences(userId, updates);
    logger.debug("PATCH /communication-preferences request completed", {
      userId,
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    logger.error("PATCH /communication-preferences request failed", { error });
    return next(error);
  }
};

// ==================== Heuristic Family Management ====================

export const getHeuristicFamilies = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const companyId = req.query.companyId || req.headers["company-id"];
    const companyIdStr = (
      Array.isArray(companyId) ? companyId[0] : companyId
    ) as string | undefined;

    logger.debug("GET /heuristic-families request received", {
      companyId: companyIdStr,
    });

    const { dbGetHeuristicFamilies } = await import(
      "@/apps/db-worker/src/services/databaseService.ts"
    );
    const families = await dbGetHeuristicFamilies(companyIdStr || null);

    logger.debug("GET /heuristic-families request completed", {
      familyCount: families.length,
    });
    res.status(200).json({ success: true, data: families });
  } catch (error) {
    logger.error("GET /heuristic-families request failed", { error });
    next(error);
  }
};

export const getHeuristicFamily = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    if (!id) {
      logger.warn("GET /heuristic-families/:id missing id");
      return res.status(400).json({
        success: false,
        error: "Family ID is required",
      });
    }

    logger.debug("GET /heuristic-families/:id request received", { id });

    const { dbGetHeuristicFamily } = await import(
      "@/apps/db-worker/src/services/databaseService.ts"
    );
    const family = await dbGetHeuristicFamily(id);

    if (!family) {
      logger.warn("GET /heuristic-families/:id family not found", { id });
      return res.status(404).json({
        success: false,
        error: "Heuristic family not found",
      });
    }

    logger.debug("GET /heuristic-families/:id request completed", {
      id,
      heuristicCount: family.heuristics.length,
    });
    return res.status(200).json({ success: true, data: family });
  } catch (error) {
    logger.error("GET /heuristic-families/:id request failed", { error });
    return next(error);
  }
};

export const createHeuristicFamily = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { name, key, description, companyId, userId } = req.body;

    if (!name || !key || !companyId || !userId) {
      logger.warn("POST /heuristic-families missing required fields");
      res.status(400).json({
        success: false,
        message: "name, key, companyId, and userId are required",
      });
      return;
    }

    // Verify user is an admin of the company
    const { dbGetCompanyMembership } = await import(
      "@/apps/db-worker/src/services/databaseService.ts"
    );
    const membership = await dbGetCompanyMembership(companyId, userId);

    if (
      !membership ||
      (membership.role !== "ADMIN" && membership.role !== "OWNER")
    ) {
      logger.warn("POST /heuristic-families access denied", {
        userId,
        companyId,
        role: membership?.role,
      });
      res.status(403).json({
        success: false,
        message: "Only company admins can create heuristic families",
      });
      return;
    }

    logger.debug("POST /heuristic-families request received", {
      companyId,
      name,
    });

    const { dbCreateHeuristicFamily } = await import(
      "@/apps/db-worker/src/services/databaseService.ts"
    );
    const family = await dbCreateHeuristicFamily({
      name,
      key,
      description,
      companyId,
      createdById: userId,
    });

    logger.debug("POST /heuristic-families request completed", {
      familyId: family.id,
    });
    res.status(201).json({ success: true, data: family });
  } catch (error) {
    logger.error("POST /heuristic-families request failed", { error });
    next(error);
  }
};

export const updateHeuristicFamily = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { name, description, userId, companyId } = req.body;

    if (!userId || !companyId) {
      logger.warn("PATCH /heuristic-families/:id missing userId or companyId");
      res.status(400).json({
        success: false,
        message: "userId and companyId are required",
      });
      return;
    }

    // Verify user is an admin and family belongs to company
    const { dbGetCompanyMembership } = await import(
      "@/apps/db-worker/src/services/databaseService.ts"
    );
    const membership = await dbGetCompanyMembership(companyId, userId);

    if (
      !membership ||
      (membership.role !== "ADMIN" && membership.role !== "OWNER")
    ) {
      logger.warn("PATCH /heuristic-families/:id access denied", {
        userId,
        companyId,
      });
      res.status(403).json({
        success: false,
        message: "Only company admins can update heuristic families",
      });
      return;
    }

    const { dbUpdateHeuristicFamily } = await import(
      "@/apps/db-worker/src/services/databaseService.ts"
    );
    const family = await dbUpdateHeuristicFamily(id, { name, description });

    res.status(200).json({ success: true, data: family });
  } catch (error) {
    logger.error("PATCH /heuristic-families/:id request failed", { error });
    next(error);
  }
};

export const deleteHeuristicFamily = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { userId, companyId } = req.body;

    if (!userId || !companyId) {
      logger.warn("DELETE /heuristic-families/:id missing userId or companyId");
      res.status(400).json({
        success: false,
        message: "userId and companyId are required",
      });
      return;
    }

    // Verify user is an admin
    const { dbGetCompanyMembership } = await import(
      "@/apps/db-worker/src/services/databaseService.ts"
    );
    const membership = await dbGetCompanyMembership(companyId, userId);

    if (
      !membership ||
      (membership.role !== "ADMIN" && membership.role !== "OWNER")
    ) {
      logger.warn("DELETE /heuristic-families/:id access denied", {
        userId,
        companyId,
      });
      res.status(403).json({
        success: false,
        message: "Only company admins can delete heuristic families",
      });
      return;
    }

    const { dbDeleteHeuristicFamily } = await import(
      "@/apps/db-worker/src/services/databaseService.ts"
    );
    await dbDeleteHeuristicFamily(id, companyId);

    res.status(200).json({ success: true });
  } catch (error) {
    logger.error("DELETE /heuristic-families/:id request failed", { error });
    next(error);
  }
};

export const toggleHeuristicFamilyVisibility = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { isHidden, userId, companyId } = req.body;

    if (!userId || !companyId || typeof isHidden !== "boolean") {
      logger.warn("POST /heuristic-families/:id/visibility missing fields");
      res.status(400).json({
        success: false,
        message: "userId, companyId, and isHidden are required",
      });
      return;
    }

    // Verify user is an admin
    const { dbGetCompanyMembership } = await import(
      "@/apps/db-worker/src/services/databaseService.ts"
    );
    const membership = await dbGetCompanyMembership(companyId, userId);

    if (
      !membership ||
      (membership.role !== "ADMIN" && membership.role !== "OWNER")
    ) {
      logger.warn("POST /heuristic-families/:id/visibility access denied", {
        userId,
        companyId,
      });
      res.status(403).json({
        success: false,
        message: "Only company admins can toggle visibility",
      });
      return;
    }

    const { dbToggleHeuristicFamilyVisibility } = await import(
      "@/apps/db-worker/src/services/databaseService.ts"
    );
    const visibility = await dbToggleHeuristicFamilyVisibility(
      id,
      companyId,
      isHidden
    );

    res.status(200).json({ success: true, data: visibility });
  } catch (error) {
    logger.error("POST /heuristic-families/:id/visibility request failed", {
      error,
    });
    next(error);
  }
};

export const getHeuristic = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const companyId = req.query.companyId || req.headers["company-id"];
    const companyIdStr = (
      Array.isArray(companyId) ? companyId[0] : companyId
    ) as string | undefined;

    if (!id) {
      logger.warn("GET /heuristics/:id missing id");
      return res.status(400).json({
        success: false,
        error: "Heuristic ID is required",
      });
    }

    logger.debug("GET /heuristics/:id request received", {
      id,
      companyId: companyIdStr,
    });

    const { dbGetHeuristic } = await import(
      "@/apps/db-worker/src/services/databaseService.ts"
    );
    const heuristic = await dbGetHeuristic(id, companyIdStr || null);

    if (!heuristic) {
      logger.warn("GET /heuristics/:id heuristic not found", { id });
      return res.status(404).json({
        success: false,
        error: "Heuristic not found",
      });
    }

    logger.debug("GET /heuristics/:id request completed", {
      id,
      exampleCount: heuristic.examples.length,
    });
    return res.status(200).json({ success: true, data: heuristic });
  } catch (error) {
    logger.error("GET /heuristics/:id request failed", { error });
    return next(error);
  }
};

export const createHeuristic = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const {
      heuristicFamilyId,
      category,
      label,
      heuristic,
      description,
      userId,
      companyId,
    } = req.body;

    if (!heuristicFamilyId || !heuristic || !userId || !companyId) {
      logger.warn("POST /heuristics missing required fields");
      res.status(400).json({
        success: false,
        message:
          "heuristicFamilyId, heuristic, userId, and companyId are required",
      });
      return;
    }

    // Verify user is an admin
    const { dbGetCompanyMembership } = await import(
      "@/apps/db-worker/src/services/databaseService.ts"
    );
    const membership = await dbGetCompanyMembership(companyId, userId);

    if (
      !membership ||
      (membership.role !== "ADMIN" && membership.role !== "OWNER")
    ) {
      logger.warn("POST /heuristics access denied", { userId, companyId });
      res.status(403).json({
        success: false,
        message: "Only company admins can create heuristics",
      });
      return;
    }

    const { dbCreateHeuristic } = await import(
      "@/apps/db-worker/src/services/databaseService.ts"
    );
    const newHeuristic = await dbCreateHeuristic({
      heuristicFamilyId,
      category,
      label,
      heuristic,
      description,
      companyId,
      createdById: userId,
    });

    res.status(201).json({ success: true, data: newHeuristic });
  } catch (error) {
    logger.error("POST /heuristics request failed", { error });
    next(error);
  }
};

export const updateHeuristic = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { category, label, heuristic, description, userId, companyId } =
      req.body;

    if (!userId || !companyId) {
      logger.warn("PATCH /heuristics/:id missing userId or companyId");
      res.status(400).json({
        success: false,
        message: "userId and companyId are required",
      });
      return;
    }

    // Verify user is an admin
    const { dbGetCompanyMembership } = await import(
      "@/apps/db-worker/src/services/databaseService.ts"
    );
    const membership = await dbGetCompanyMembership(companyId, userId);

    if (
      !membership ||
      (membership.role !== "ADMIN" && membership.role !== "OWNER")
    ) {
      logger.warn("PATCH /heuristics/:id access denied", { userId, companyId });
      res.status(403).json({
        success: false,
        message: "Only company admins can update heuristics",
      });
      return;
    }

    const { dbUpdateHeuristic } = await import(
      "@/apps/db-worker/src/services/databaseService.ts"
    );
    const updatedHeuristic = await dbUpdateHeuristic(id, {
      category,
      label,
      heuristic,
      description,
      companyId,
    });

    res.status(200).json({ success: true, data: updatedHeuristic });
  } catch (error) {
    logger.error("PATCH /heuristics/:id request failed", { error });
    next(error);
  }
};

export const deleteHeuristic = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { userId, companyId } = req.body;

    if (!userId || !companyId) {
      logger.warn("DELETE /heuristics/:id missing userId or companyId");
      res.status(400).json({
        success: false,
        message: "userId and companyId are required",
      });
      return;
    }

    // Verify user is an admin
    const { dbGetCompanyMembership } = await import(
      "@/apps/db-worker/src/services/databaseService.ts"
    );
    const membership = await dbGetCompanyMembership(companyId, userId);

    if (
      !membership ||
      (membership.role !== "ADMIN" && membership.role !== "OWNER")
    ) {
      logger.warn("DELETE /heuristics/:id access denied", {
        userId,
        companyId,
      });
      res.status(403).json({
        success: false,
        message: "Only company admins can delete heuristics",
      });
      return;
    }

    const { dbDeleteHeuristic } = await import(
      "@/apps/db-worker/src/services/databaseService.ts"
    );
    await dbDeleteHeuristic(id, companyId);

    res.status(200).json({ success: true });
  } catch (error) {
    logger.error("DELETE /heuristics/:id request failed", { error });
    next(error);
  }
};

export const createHeuristicExample = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { heuristicId, title, description, userId, companyId, createdById } =
      req.body;

    if (!heuristicId || !description || !userId || !companyId) {
      logger.warn("POST /heuristic-examples missing required fields");
      res.status(400).json({
        success: false,
        message: "heuristicId, description, userId, and companyId are required",
      });
      return;
    }

    // Verify user is an admin
    const { dbGetCompanyMembership } = await import(
      "@/apps/db-worker/src/services/databaseService.ts"
    );
    const membership = await dbGetCompanyMembership(companyId, userId);

    if (
      !membership ||
      (membership.role !== "ADMIN" && membership.role !== "OWNER")
    ) {
      logger.warn("POST /heuristic-examples access denied", {
        userId,
        companyId,
      });
      res.status(403).json({
        success: false,
        message: "Only company admins can create heuristic examples",
      });
      return;
    }

    const { dbCreateHeuristicExample } = await import(
      "@/apps/db-worker/src/services/databaseService.ts"
    );
    const example = await dbCreateHeuristicExample({
      heuristicId,
      title,
      description,
      companyId,
      createdById: createdById || userId, // Use createdById if provided, fallback to userId
    });

    res.status(201).json({ success: true, data: example });
  } catch (error) {
    logger.error("POST /heuristic-examples request failed", { error });
    next(error);
  }
};

export const updateHeuristicExample = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { title, description, userId, companyId } = req.body;

    if (!userId || !companyId) {
      logger.warn("PATCH /heuristic-examples/:id missing userId or companyId");
      res.status(400).json({
        success: false,
        message: "userId and companyId are required",
      });
      return;
    }

    // Verify user is an admin
    const { dbGetCompanyMembership } = await import(
      "@/apps/db-worker/src/services/databaseService.ts"
    );
    const membership = await dbGetCompanyMembership(companyId, userId);

    if (
      !membership ||
      (membership.role !== "ADMIN" && membership.role !== "OWNER")
    ) {
      logger.warn("PATCH /heuristic-examples/:id access denied", {
        userId,
        companyId,
      });
      res.status(403).json({
        success: false,
        message: "Only company admins can update heuristic examples",
      });
      return;
    }

    const { dbUpdateHeuristicExample } = await import(
      "@/apps/db-worker/src/services/databaseService.ts"
    );
    const example = await dbUpdateHeuristicExample(id, {
      title,
      description,
      companyId,
    });

    res.status(200).json({ success: true, data: example });
  } catch (error) {
    logger.error("PATCH /heuristic-examples/:id request failed", { error });
    next(error);
  }
};

export const deleteHeuristicExample = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { userId, companyId } = req.body;

    if (!userId || !companyId) {
      logger.warn("DELETE /heuristic-examples/:id missing userId or companyId");
      res.status(400).json({
        success: false,
        message: "userId and companyId are required",
      });
      return;
    }

    // Verify user is an admin
    const { dbGetCompanyMembership } = await import(
      "@/apps/db-worker/src/services/databaseService.ts"
    );
    const membership = await dbGetCompanyMembership(companyId, userId);

    if (
      !membership ||
      (membership.role !== "ADMIN" && membership.role !== "OWNER")
    ) {
      logger.warn("DELETE /heuristic-examples/:id access denied", {
        userId,
        companyId,
      });
      res.status(403).json({
        success: false,
        message: "Only company admins can delete heuristic examples",
      });
      return;
    }

    const { dbDeleteHeuristicExample } = await import(
      "@/apps/db-worker/src/services/databaseService.ts"
    );
    await dbDeleteHeuristicExample(id, companyId);

    res.status(200).json({ success: true });
  } catch (error) {
    logger.error("DELETE /heuristic-examples/:id request failed", { error });
    next(error);
  }
};
