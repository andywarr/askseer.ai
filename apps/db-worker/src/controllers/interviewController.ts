/**
 * Interview-related controller handlers.
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
  dbInitInterview,
  dbInitInterviewSession,
  dbGetInterviewSessionByToken,
  dbGetInterviewSessionDetails,
  dbUpdateInterviewSessionStatus,
  dbSaveInterviewMessages,
  dbSaveInterviewProbe,
  dbGetUninjectedProbes,
  dbSaveInterviewRecording,
  dbSaveInterviewGuide,
  dbGetInterviewData,
  dbGetInterviewMessages,
  dbDeleteInterviewSession,
  dbRenameInterviewSession,
} from "@/apps/db-worker/src/services/study/interviewService.ts";

// POST /study/interview/init
export const postInterviewInit = withErrorHandler(async (req, res) => {
  const { studyId, sessionCount } = req.body || {};

  if (!requireBodyFields(req.body || {}, ["studyId"], res)) {
    return;
  }

  const interview = await dbInitInterview(studyId, sessionCount || 1);
  return sendSuccess(res, interview);
}, "POST /study/interview/init");

// POST /study/interview/session/init
export const postInterviewSessionInit = withErrorHandler(async (req, res) => {
  const { interviewId } = req.body || {};

  if (!requireBodyFields(req.body || {}, ["interviewId"], res)) {
    return;
  }

  const session = await dbInitInterviewSession(interviewId);
  return sendSuccess(res, session);
}, "POST /study/interview/session/init");

// GET /study/interview/session/details
export const getInterviewSessionDetails = withErrorHandler(
  async (req, res) => {
    const sessionId = getParam<string>(req, "sessionId");

    if (!sessionId) {
      return sendError(res, "sessionId is required");
    }

    const session = await dbGetInterviewSessionDetails(sessionId);
    if (!session) {
      return sendError(res, "Session not found", 404);
    }
    return sendSuccess(res, session);
  },
  "GET /study/interview/session/details",
);

// GET /study/interview/session/token
export const getInterviewSessionByToken = withErrorHandler(
  async (req, res) => {
    const token = getParam<string>(req, "token");

    if (!token) {
      return sendError(res, "Token is required");
    }

    const data = await dbGetInterviewSessionByToken(token);

    if (!data) {
      return sendError(res, "Interview session not found", 404);
    }

    return sendSuccess(res, data);
  },
  "GET /study/interview/session/token",
);

// PATCH /study/interview/session/status
export const patchInterviewSessionStatus = withErrorHandler(
  async (req, res) => {
    const { sessionId, status, startedAt, completedAt } = req.body || {};

    if (!requireBodyFields(req.body || {}, ["sessionId", "status"], res)) {
      return;
    }

    const session = await dbUpdateInterviewSessionStatus({
      sessionId,
      status,
      startedAt: startedAt ? new Date(startedAt) : undefined,
      completedAt: completedAt ? new Date(completedAt) : undefined,
    });
    return sendSuccess(res, session);
  },
  "PATCH /study/interview/session/status",
);

// POST /study/interview/session/messages
export const postInterviewSessionMessages = withErrorHandler(
  async (req, res) => {
    const { sessionId, messages } = req.body || {};

    if (!requireBodyFields(req.body || {}, ["sessionId", "messages"], res)) {
      return;
    }

    const result = await dbSaveInterviewMessages(sessionId, messages);
    return sendSuccess(res, result);
  },
  "POST /study/interview/session/messages",
);

// POST /study/interview/session/probe
export const postInterviewSessionProbe = withErrorHandler(
  async (req, res) => {
    const { sessionId, text } = req.body || {};

    if (!requireBodyFields(req.body || {}, ["sessionId", "text"], res)) {
      return;
    }

    const probe = await dbSaveInterviewProbe(sessionId, text);
    return sendSuccess(res, probe);
  },
  "POST /study/interview/session/probe",
);

// GET /study/interview/session/probes
export const getInterviewSessionProbes = withErrorHandler(
  async (req, res) => {
    const sessionId = getParam<string>(req, "sessionId", "session-id");

    if (!sessionId) {
      return sendError(res, "Session ID is required");
    }

    const probes = await dbGetUninjectedProbes(sessionId);
    return sendSuccess(res, probes);
  },
  "GET /study/interview/session/probes",
);

// PATCH /study/interview/session/recording
export const patchInterviewSessionRecording = withErrorHandler(
  async (req, res) => {
    const { sessionId, recordingKey } = req.body || {};

    if (
      !requireBodyFields(req.body || {}, ["sessionId", "recordingKey"], res)
    ) {
      return;
    }

    const session = await dbSaveInterviewRecording(sessionId, recordingKey);
    return sendSuccess(res, session);
  },
  "PATCH /study/interview/session/recording",
);

// POST /study/interview/guide
export const postInterviewGuide = withErrorHandler(async (req, res) => {
  const { studyId, goal, rawDiscussionGuide, systemPrompt, questions, studyName } =
    req.body || {};

  if (!requireBodyFields(req.body || {}, ["studyId"], res)) {
    return;
  }

  const interview = await dbSaveInterviewGuide(studyId, {
    goal,
    rawDiscussionGuide,
    systemPrompt,
    questions,
    studyName,
  });
  return sendSuccess(res, interview);
}, "POST /study/interview/guide");

// GET /study/interview/data
export const getInterviewData = withErrorHandler(async (req, res) => {
  const studyId = getParam<string>(req, "studyId", "study-id");

  if (!studyId) {
    return sendError(res, "Study ID is required");
  }

  const data = await dbGetInterviewData(studyId);
  return sendSuccess(res, data);
}, "GET /study/interview/data");

// GET /study/interview/session/messages
export const getInterviewSessionMessages = withErrorHandler(
  async (req, res) => {
    const sessionId = getParam<string>(req, "sessionId", "session-id");
    const afterId = getParam<string>(req, "afterId", "after-id");

    if (!sessionId) {
      return sendError(res, "Session ID is required");
    }

    const messages = await dbGetInterviewMessages(
      sessionId,
      afterId || undefined,
    );
    return sendSuccess(res, messages);
  },
  "GET /study/interview/session/messages",
);

export const deleteInterviewSession = withErrorHandler(async (req, res) => {
  const sessionId = requireParam(
    req,
    res,
    "sessionId",
    "Session ID",
    "session-id",
  );
  if (!sessionId) return;

  const result = await dbDeleteInterviewSession(sessionId);
  sendSuccess(res, result);
}, "DELETE /study/interview/session");

// PATCH /study/interview/session/name
export const patchInterviewSessionName = withErrorHandler(
  async (req, res) => {
    const { sessionId, name } = req.body || {};

    if (!requireBodyFields(req.body || {}, ["sessionId", "name"], res)) {
      return;
    }

    const session = await dbRenameInterviewSession(sessionId, name);
    return sendSuccess(res, session);
  },
  "PATCH /study/interview/session/name",
);
