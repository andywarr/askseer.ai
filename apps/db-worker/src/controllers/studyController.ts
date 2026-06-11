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
  dbTransferStudy,
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
  dbGetLiveSessionByToken,
  dbCreateLiveSessionTag,
  dbCreateLiveSessionNote,
  dbCreateBackroomMessage,
  dbGetBackroomMessages,
  dbUpdateLiveSessionStatus,
  dbGetLiveSessionDetails,
  dbSaveLiveSessionTranscript,
  dbRenameLiveSession,
  dbDeleteLiveSession,
  dbSetRecordingStartedAt,
  dbSetLiveSessionInterviewer,
  dbFinalizeLiveSessionRecording,
  dbGetStudyTldrStatus,
  dbGetStudyTakeaways,
  dbUpdateStudyTldrStatus,
  dbUpsertStudyTakeaways,
  dbUpdateStudyTakeaway,
  dbDeleteStudyTakeaway,
  dbUpdateTakeawayRecommendation,
  dbDeleteTakeawayRecommendation,
  dbGetStudyBenchmarks,
  dbCreateTakeawayRecommendation,
  dbCreateStudyTakeaway,
  dbReorderStudyTakeaways,
  dbReorderTakeawayRecommendations,
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

export const postTransferStudy = withErrorHandler(async (req, res) => {
  const { studyId, targetTeamId, byUserId } = req.body || {};

  if (
    !requireBodyFields(
      req.body || {},
      ["studyId", "targetTeamId", "byUserId"],
      res,
    )
  ) {
    return;
  }

  const data = await dbTransferStudy({
    studyId,
    targetTeamId,
    userId: byUserId,
  });
  sendSuccess(res, data);
}, "POST /study/transfer");

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
  const { userId, teamId, name, type, initialJobData, benchmarkSourceId, locale } =
    req.body || {};

  if (!requireBodyFields(req.body || {}, ["userId", "teamId", "type"], res)) {
    return;
  }

  const study = await dbInitStudy({
    userId,
    teamId,
    name,
    type,
    initialJobData,
    benchmarkSourceId: benchmarkSourceId || null,
    locale,
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
  const { liveSessionId, status, startedAt, endedAt, recordingKey } =
    req.body || {};

  if (!requireBodyFields(req.body || {}, ["liveSessionId", "status"], res)) {
    return;
  }

  const session = await dbUpdateLiveSessionStatus({
    liveSessionId,
    status,
    startedAt:
      startedAt === null ? null : startedAt ? new Date(startedAt) : undefined,
    endedAt: endedAt ? new Date(endedAt) : undefined,
    recordingKey: recordingKey || undefined,
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
  const { liveSessionId, transcriptKey, transcriptText } = req.body || {};

  if (
    !requireBodyFields(
      req.body || {},
      ["liveSessionId", "transcriptKey", "transcriptText"],
      res,
    )
  ) {
    return;
  }

  const session = await dbSaveLiveSessionTranscript({
    liveSessionId,
    transcriptKey,
    transcriptText,
  });
  sendSuccess(res, session);
}, "POST /study/live-session/transcript");

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

// ─── TLDR / Takeaway Controllers ────────────────────────────────────────────

export const getStudyTldrStatus = withErrorHandler(async (req, res) => {
  const studyId = requireParam(req, res, "studyId", "Study ID", "study-id");
  if (!studyId) return;

  const userId = requireParam(req, res, "userId", "User ID", "user-id");
  if (!userId) return;

  const data = await dbGetStudyTldrStatus(studyId, userId);
  sendSuccess(res, data);
}, "GET /study/tldr-status");

export const getStudyTakeaways = withErrorHandler(async (req, res) => {
  const studyId = requireParam(req, res, "studyId", "Study ID", "study-id");
  if (!studyId) return;

  const userId = requireParam(req, res, "userId", "User ID", "user-id");
  if (!userId) return;

  const data = await dbGetStudyTakeaways(studyId, userId);
  sendSuccess(res, data);
}, "GET /study/takeaways");

export const patchStudyTldrStatus = withErrorHandler(async (req, res) => {
  const { studyId, tldrStatus, userId } = req.body || {};

  if (
    !requireBodyFields(req.body || {}, ["studyId", "tldrStatus", "userId"], res)
  ) {
    return;
  }

  await dbUpdateStudyTldrStatus(studyId, tldrStatus, userId);
  sendSuccess(res, { success: true });
}, "PATCH /study/tldr-status");

export const postStudyTakeaways = withErrorHandler(async (req, res) => {
  const { studyId, takeaways } = req.body || {};

  if (!studyId || !Array.isArray(takeaways)) {
    return sendError(res, "studyId and takeaways[] are required");
  }

  await dbUpsertStudyTakeaways(studyId, takeaways);
  sendSuccess(res, { success: true });
}, "POST /study/takeaways");

export const patchStudyTakeaway = withErrorHandler(async (req, res) => {
  const { id } = req.params;
  const { title, description, userId } = req.body || {};

  if (!id || !userId) {
    return sendError(res, "id and userId are required");
  }

  const data = await dbUpdateStudyTakeaway(id, { title, description }, userId);
  sendSuccess(res, data);
}, "PATCH /study/takeaways/:id");

export const deleteStudyTakeaway = withErrorHandler(async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body || {};

  if (!id || !userId) {
    return sendError(res, "id and userId are required");
  }

  const data = await dbDeleteStudyTakeaway(id, userId);
  sendSuccess(res, data);
}, "DELETE /study/takeaways/:id");

export const patchStudyTakeawayRecommendation = withErrorHandler(
  async (req, res) => {
    const { id } = req.params;
    const { text, userId } = req.body || {};

    if (!id || !userId) {
      return sendError(res, "id and userId are required");
    }

    const data = await dbUpdateTakeawayRecommendation(id, { text }, userId);
    sendSuccess(res, data);
  },
  "PATCH /study/takeaway-recommendations/:id",
);

export const deleteStudyTakeawayRecommendation = withErrorHandler(
  async (req, res) => {
    const { id } = req.params;
    const { userId } = req.body || {};

    if (!id || !userId) {
      return sendError(res, "id and userId are required");
    }

    const data = await dbDeleteTakeawayRecommendation(id, userId);
    sendSuccess(res, data);
  },
  "DELETE /study/takeaway-recommendations/:id",
);

export const postStudyTakeawayRecommendation = withErrorHandler(
  async (req, res) => {
    const { takeawayId, text, userId } = req.body || {};

    if (!takeawayId || !text || !userId) {
      return sendError(res, "takeawayId, text, and userId are required");
    }

    const data = await dbCreateTakeawayRecommendation(takeawayId, text, userId);
    sendSuccess(res, data);
  },
  "POST /study/takeaway-recommendations",
);

export const postStudyTakeaway = withErrorHandler(async (req, res) => {
  const { studyId, title, description, userId } = req.body || {};

  if (!studyId || !title || !userId) {
    return sendError(res, "studyId, title, and userId are required");
  }

  const data = await dbCreateStudyTakeaway(
    studyId,
    { title, description: description || "" },
    userId,
  );
  sendSuccess(res, data);
}, "POST /study/takeaway");

export const patchStudyTakeawaysOrder = withErrorHandler(async (req, res) => {
  const { studyId, orderedIds, userId } = req.body || {};

  if (!studyId || !Array.isArray(orderedIds) || !userId) {
    return sendError(res, "studyId, orderedIds[], and userId are required");
  }

  const data = await dbReorderStudyTakeaways(studyId, orderedIds, userId);
  sendSuccess(res, data);
}, "PATCH /study/takeaways/reorder");

export const patchTakeawayRecommendationsOrder = withErrorHandler(
  async (req, res) => {
    const { takeawayId, orderedIds, userId } = req.body || {};

    if (!takeawayId || !Array.isArray(orderedIds) || !userId) {
      return sendError(
        res,
        "takeawayId, orderedIds[], and userId are required",
      );
    }

    const data = await dbReorderTakeawayRecommendations(
      takeawayId,
      orderedIds,
      userId,
    );
    sendSuccess(res, data);
  },
  "PATCH /study/takeaway-recommendations/reorder",
);

export const getStudyBenchmarks = withErrorHandler(async (req, res) => {
  const studyId = requireParam(req, res, "studyId", "Study ID", "study-id");
  if (!studyId) return;

  const userId = requireParam(req, res, "userId", "User ID", "user-id");
  if (!userId) return;

  const data = await dbGetStudyBenchmarks(studyId, userId);
  sendSuccess(res, data);
}, "GET /study/benchmarks");
