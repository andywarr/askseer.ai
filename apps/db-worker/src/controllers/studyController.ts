/**
 * Study-related controller handlers.
 */

import { logger } from "@/apps/shared/logger.ts";
import { StudyVisibility } from "@prisma/client";
import {
  getParam,
  requireParam,
  sendSuccess,
  sendError,
  convertToStudyStatus,
  requireBodyFields,
  withErrorHandler,
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
  dbUpdateFileTranscript,
  dbUpdateFileIdentifier,
  dbInitLiveSession,
  dbAttachLiveSessionGuide,
  dbGetLiveSessionByToken,
  dbCreateLiveSessionTag,
  dbCreateLiveSessionNote,
  dbFinalizeLiveSessionRecording,
  dbCreateBackroomMessage,
  dbGetBackroomMessages,
  dbUpdateLiveSessionStatus,
  dbGetLiveSessionDetails,
  dbSaveLiveSessionTranscript,
  dbRenameLiveSession,
  dbDeleteLiveSession,
  dbSetRecordingStartedAt,
  dbSetLiveSessionInterviewer,
} from "@/apps/db-worker/src/services/index.ts";

export const deleteStudy = withErrorHandler(async (req, res) => {
  const studyId = requireParam(req, res, "studyId", "Study ID", "study-id");
  if (!studyId) return;

  const userId = requireParam(req, res, "userId", "User ID", "user-id");
  if (!userId) return;

  const data = await dbDeleteStudy(studyId, userId);
  sendSuccess(res, data);
}, "DELETE /study");

export const getStudies = withErrorHandler(async (req, res) => {
  const userId = requireParam(req, res, "userId", "User ID", "user-id");
  if (!userId) return;

  const teamIdRaw = getParam(req, "teamId", "team-id");
  const teamId =
    typeof teamIdRaw === "string" && teamIdRaw.trim().length > 0
      ? teamIdRaw
      : undefined;

  const data = await dbGetStudies(userId, teamId);
  sendSuccess(res, data);
}, "GET /studies");

export const getStudy = withErrorHandler(async (req, res) => {
  const studyId = requireParam(req, res, "studyId", "Study ID", "study-id");
  if (!studyId) return;

  const userId = requireParam(req, res, "userId", "User ID", "user-id");
  if (!userId) return;

  const data = await dbGetStudy(studyId, userId);
  sendSuccess(res, data);
}, "GET /study");

export const canAccessStudy = withErrorHandler(async (req, res) => {
  const studyId = requireParam(req, res, "studyId", "Study ID", "study-id");
  if (!studyId) return;

  const userId = requireParam(req, res, "userId", "User ID", "user-id");
  if (!userId) return;

  const data = await dbCanAccessStudy(studyId, userId);
  sendSuccess(res, data);
}, "GET /study/access");

export const postStudyAttempts = withErrorHandler(async (req, res) => {
  const { studyId } = req.body || {};

  if (!studyId) {
    return sendError(res, "studyId is required");
  }

  const study = await dbUpdateStudyAttempts(studyId);
  sendSuccess(res, study);
}, "POST /study-attempts");

export const postStudyStatus = withErrorHandler(async (req, res) => {
  const { studyId, status: rawStatus } = req.body || {};

  if (!studyId) {
    return sendError(res, "studyId is required");
  }

  if (!rawStatus) {
    return sendError(res, "status is required");
  }

  const status = convertToStudyStatus(rawStatus);

  if (!status) {
    logger.warn("POST /study-status invalid status", { status: rawStatus });
    return sendError(res, "Invalid study status");
  }

  const study = await dbUpdateStudyStatus(studyId, status);
  sendSuccess(res, study);
}, "POST /study-status");

export const updateStudyName = withErrorHandler(async (req, res) => {
  const { studyId, name, userId } = req.body || {};

  if (!requireBodyFields(req.body || {}, ["studyId", "name", "userId"], res)) {
    return;
  }

  const data = await dbUpdateStudyName(studyId, name, userId);
  sendSuccess(res, data);
}, "PATCH /study/name");

export const patchStudyTeam = withErrorHandler(async (req, res) => {
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
  sendSuccess(res, data);
}, "PATCH /study/team");

export const patchStudyVisibility = withErrorHandler(async (req, res) => {
  const { studyId, visibility, userId } = req.body || {};

  if (
    !requireBodyFields(req.body || {}, ["studyId", "visibility", "userId"], res)
  ) {
    return;
  }

  if (!Object.values(StudyVisibility).includes(visibility)) {
    return sendError(
      res,
      `visibility must be one of: ${Object.values(StudyVisibility).join(", ")}`,
    );
  }

  const data = await dbUpdateStudyVisibility({ studyId, visibility, userId });
  sendSuccess(res, data);
}, "PATCH /study/visibility");

export const postStudyRegenerateShareToken = withErrorHandler(
  async (req, res) => {
    const { studyId, userId } = req.body || {};

    if (!requireBodyFields(req.body || {}, ["studyId", "userId"], res)) {
      return;
    }

    const data = await dbRegenerateStudyShareToken({ studyId, userId });
    sendSuccess(res, data);
  },
  "POST /study/regenerate-share-token",
);

export const postStudyToggleShareLink = withErrorHandler(async (req, res) => {
  const { studyId, userId, enabled } = req.body || {};

  if (!requireBodyFields(req.body || {}, ["studyId", "userId"], res)) {
    return;
  }

  if (typeof enabled !== "boolean") {
    return sendError(res, "enabled is required");
  }

  const data = await dbToggleStudyShareLink({ studyId, userId, enabled });
  sendSuccess(res, data);
}, "POST /study/toggle-share-link");

export const getStudyByShareToken = withErrorHandler(async (req, res) => {
  const { token } = req.query;

  if (!token || typeof token !== "string") {
    return sendError(res, "token is required");
  }

  const data = await dbGetStudyByShareToken(token);

  if (!data) {
    return sendError(res, "Study not found or not public", 404);
  }

  sendSuccess(res, data);
}, "GET /study/shared");

export const getStudyShareInfo = withErrorHandler(async (req, res) => {
  const studyId = requireParam(req, res, "studyId", "Study ID");
  if (!studyId) return;

  const userId = requireParam(req, res, "userId", "User ID");
  if (!userId) return;

  const data = await dbGetStudyShareInfo(studyId, userId);
  sendSuccess(res, data);
}, "GET /study/share-info");

export const getStudyPublicRedirectInfo = withErrorHandler(async (req, res) => {
  const { studyId } = req.query;

  if (!studyId || typeof studyId !== "string") {
    return sendError(res, "studyId is required");
  }

  const data = await dbGetStudyPublicRedirectInfo(studyId);

  if (!data) {
    return sendError(res, "Study not found or not public", 404);
  }

  sendSuccess(res, data);
}, "GET /study/public-redirect");

export const postStudyInit = withErrorHandler(async (req, res) => {
  const { userId, teamId, name, type, initialJobData } = req.body || {};

  if (!requireBodyFields(req.body || {}, ["userId", "teamId", "type"], res)) {
    return;
  }

  const study = await dbInitStudy({
    userId,
    teamId,
    name,
    type,
    initialJobData,
  });
  sendSuccess(res, study);
}, "POST /study/init");

export const postLiveSessionInit = withErrorHandler(async (req, res) => {
  const { studyId, guideFileId, name } = req.body || {};

  if (!requireBodyFields(req.body || {}, ["studyId"], res)) {
    return;
  }

  const liveSession = await dbInitLiveSession({ studyId, guideFileId, name });
  sendSuccess(res, liveSession);
}, "POST /study/live-session/init");

export const getLiveSessionByToken = withErrorHandler(async (req, res) => {
  const { token } = req.query;

  if (!token || typeof token !== "string") {
    return sendError(res, "token is required");
  }

  const data = await dbGetLiveSessionByToken(token);

  if (!data) {
    return sendError(res, "Live session not found", 404);
  }

  sendSuccess(res, data);
}, "GET /study/live-session/token");

export const patchLiveSessionGuide = withErrorHandler(async (req, res) => {
  const { studyId, liveSessionId, file } = req.body || {};

  if (!requireBodyFields(req.body || {}, ["studyId", "file"], res)) {
    return;
  }

  const liveSession = await dbAttachLiveSessionGuide({
    studyId,
    liveSessionId,
    file,
  });
  sendSuccess(res, liveSession);
}, "PATCH /study/live-session/guide");

export const postLiveSessionTag = withErrorHandler(async (req, res) => {
  const { liveSessionId, userId, tagType, timestamp, screenshotKey } =
    req.body || {};

  if (
    !requireBodyFields(
      req.body || {},
      ["liveSessionId", "tagType", "timestamp"],
      res,
    )
  ) {
    return;
  }

  const tag = await dbCreateLiveSessionTag({
    liveSessionId,
    userId,
    tagType,
    timestamp,
    screenshotKey,
  });
  sendSuccess(res, tag);
}, "POST /study/live-session/tag");

export const postLiveSessionNote = withErrorHandler(async (req, res) => {
  const { liveSessionId, userId, text, timestamp, screenshotKey } =
    req.body || {};

  if (
    !requireBodyFields(
      req.body || {},
      ["liveSessionId", "text", "timestamp"],
      res,
    )
  ) {
    return;
  }

  const note = await dbCreateLiveSessionNote({
    liveSessionId,
    userId,
    text,
    timestamp,
    screenshotKey,
  });
  sendSuccess(res, note);
}, "POST /study/live-session/note");

export const postLiveSessionRecordingFinalize = withErrorHandler(
  async (req, res) => {
    const { liveSessionId, fileKey, fileSize } = req.body || {};

    if (
      !requireBodyFields(
        req.body || {},
        ["liveSessionId", "fileKey", "fileSize"],
        res,
      )
    ) {
      return;
    }

    const result = await dbFinalizeLiveSessionRecording({
      liveSessionId,
      fileKey,
      fileSize,
    });

    sendSuccess(res, result);
  },
  "POST /study/live-session/recording/finalize",
);

export const postStudyFinalize = withErrorHandler(async (req, res) => {
  const { studyId, files, jobData } = req.body || {};

  if (!studyId || !Array.isArray(files)) {
    return sendError(res, "studyId and files[] are required");
  }

  const study = await dbFinalizeStudy({ studyId, files, jobData });
  sendSuccess(res, study);
}, "POST /study/finalize");

// Bookmarked Studies Controllers

export const getBookmarkedStudies = withErrorHandler(async (req, res) => {
  const userId = requireParam(req, res, "userId", "User ID", "user-id");
  if (!userId) return;

  const data = await dbGetBookmarkedStudyIds(userId);
  sendSuccess(res, data);
}, "GET /bookmarked-studies");

export const postToggleStudyBookmark = withErrorHandler(async (req, res) => {
  const { userId, studyId } = req.body;

  if (!requireBodyFields(req.body || {}, ["userId", "studyId"], res)) {
    return;
  }

  const data = await dbToggleStudyBookmark(userId, studyId);
  sendSuccess(res, data);
}, "POST /toggle-study-bookmark");

export const getFiles = withErrorHandler(async (req, res) => {
  const studyId = requireParam(req, res, "studyId", "Study ID", "studyid");
  if (!studyId) return;

  const data = await dbGetFiles(studyId);
  sendSuccess(res, data);
}, "GET /files");

export const patchFileTranscript = withErrorHandler(async (req, res) => {
  const { fileId, transcript } = req.body;
  if (!fileId || typeof fileId !== "string") {
    return sendError(res, "fileId is required");
  }
  if (!transcript || typeof transcript !== "string") {
    return sendError(res, "transcript is required");
  }
  const data = await dbUpdateFileTranscript(fileId, transcript);
  sendSuccess(res, data);
}, "PATCH /files/transcript");

export const patchFileIdentifier = withErrorHandler(async (req, res) => {
  const { fileId, identifier } = req.body;
  if (!fileId || typeof fileId !== "string") {
    return sendError(res, "fileId is required");
  }
  if (typeof identifier !== "string") {
    return sendError(res, "identifier is required");
  }
  const data = await dbUpdateFileIdentifier(fileId, identifier);
  sendSuccess(res, data);
}, "PATCH /files/identifier");

// ─── Backroom Chat Controllers ──────────────────────────────────────────────

export const postBackroomMessage = withErrorHandler(async (req, res) => {
  const { liveSessionId, userId, text, timestamp } = req.body || {};

  if (
    !requireBodyFields(
      req.body || {},
      ["liveSessionId", "text", "timestamp"],
      res,
    )
  ) {
    return;
  }

  const message = await dbCreateBackroomMessage({
    liveSessionId,
    userId: userId || null,
    text,
    timestamp,
  });
  sendSuccess(res, message);
}, "POST /study/live-session/backroom-message");

export const getBackroomMessages = withErrorHandler(async (req, res) => {
  const liveSessionId = requireParam(
    req,
    res,
    "liveSessionId",
    "Live Session ID",
    "live-session-id",
  );
  if (!liveSessionId) return;

  const messages = await dbGetBackroomMessages(liveSessionId);
  sendSuccess(res, messages);
}, "GET /study/live-session/backroom-messages");

// ─── Session Lifecycle Controllers ──────────────────────────────────────────

export const patchLiveSessionStatus = withErrorHandler(async (req, res) => {
  const { liveSessionId, status, startedAt, endedAt, recordingUrl } =
    req.body || {};

  if (!requireBodyFields(req.body || {}, ["liveSessionId", "status"], res)) {
    return;
  }

  const session = await dbUpdateLiveSessionStatus({
    liveSessionId,
    status,
    startedAt: startedAt ? new Date(startedAt) : undefined,
    endedAt: endedAt ? new Date(endedAt) : undefined,
    recordingUrl: recordingUrl || undefined,
  });
  sendSuccess(res, session);
}, "PATCH /study/live-session/status");

export const getLiveSessionDetails = withErrorHandler(async (req, res) => {
  const liveSessionId = requireParam(
    req,
    res,
    "liveSessionId",
    "Live Session ID",
    "live-session-id",
  );
  if (!liveSessionId) return;

  const session = await dbGetLiveSessionDetails(liveSessionId);
  if (!session) {
    return sendError(res, "Live session not found", 404);
  }

  sendSuccess(res, session);
}, "GET /study/live-session/details");

export const postLiveSessionTranscript = withErrorHandler(async (req, res) => {
  const { liveSessionId, transcriptUrl, transcriptText } = req.body || {};

  if (
    !requireBodyFields(
      req.body || {},
      ["liveSessionId", "transcriptUrl", "transcriptText"],
      res,
    )
  ) {
    return;
  }

  const session = await dbSaveLiveSessionTranscript({
    liveSessionId,
    transcriptUrl,
    transcriptText,
  });
  sendSuccess(res, session);
}, "POST /study/live-session/transcript");

export const patchLiveSessionName = withErrorHandler(async (req, res) => {
  const { liveSessionId, name } = req.body || {};

  if (!requireBodyFields(req.body || {}, ["liveSessionId", "name"], res)) {
    return;
  }

  const session = await dbRenameLiveSession(liveSessionId, name);
  sendSuccess(res, session);
}, "PATCH /study/live-session/name");

export const patchLiveSessionRecordingStarted = withErrorHandler(
  async (req, res) => {
    const { liveSessionId } = req.body || {};

    if (!requireBodyFields(req.body || {}, ["liveSessionId"], res)) {
      return;
    }

    const session = await dbSetRecordingStartedAt(liveSessionId);
    sendSuccess(res, session);
  },
  "PATCH /study/live-session/recording-started",
);

export const patchLiveSessionInterviewer = withErrorHandler(
  async (req, res) => {
    const { liveSessionId, userId } = req.body || {};

    if (!requireBodyFields(req.body || {}, ["liveSessionId", "userId"], res)) {
      return;
    }

    const session = await dbSetLiveSessionInterviewer(liveSessionId, userId);
    sendSuccess(res, session);
  },
  "PATCH /study/live-session/interviewer",
);

export const deleteLiveSession = withErrorHandler(async (req, res) => {
  const liveSessionId = requireParam(
    req,
    res,
    "liveSessionId",
    "Live Session ID",
    "live-session-id",
  );
  if (!liveSessionId) return;

  const result = await dbDeleteLiveSession(liveSessionId);
  sendSuccess(res, result);
}, "DELETE /study/live-session");
