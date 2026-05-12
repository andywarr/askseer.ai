import express from "express";
import {
  deleteStudy,
  getStudies,
  getStudy,
  canAccessStudy,
  getStudyByShareToken,
  getStudyShareInfo,
  getStudyPublicRedirectInfo,
  getBookmarkedStudies,
  postStudyAttempts,
  postStudyStatus,
  postStudyInit,
  postStudyFinalize,
  postToggleStudyBookmark,
  updateStudyName,
  patchStudyTeam,
  postTransferStudy,
  patchStudyVisibility,
  postStudyRegenerateShareToken,
  postStudyToggleShareLink,
  postLiveSessionInit,
  getLiveSessionByToken,
  postLiveSessionTag,
  postLiveSessionNote,
  postBackroomMessage,
  getBackroomMessages,
  patchLiveSessionStatus,
  patchLiveSessionName,
  patchLiveSessionRecordingStarted,
  patchLiveSessionInterviewer,
  deleteLiveSession,
  getLiveSessionDetails,
  postLiveSessionTranscript,
  postLiveSessionRecordingFinalize,
  getStudyTldrStatus,
  getStudyTakeaways,
  patchStudyTldrStatus,
  postStudyTakeaways,
  patchStudyTakeaway,
  deleteStudyTakeaway,
  patchStudyTakeawayRecommendation,
  deleteStudyTakeawayRecommendation,
  postStudyTakeawayRecommendation,
  postStudyTakeaway,
  patchStudyTakeawaysOrder,
  patchTakeawayRecommendationsOrder,
  // Interview
  postInterviewInit,
  postInterviewSessionInit,
  getInterviewSessionByToken,
  getInterviewSessionDetails,
  patchInterviewSessionStatus,
  postInterviewSessionMessages,
  postInterviewSessionProbe,
  getInterviewSessionProbes,
  patchInterviewSessionRecording,
  patchInterviewSessionName,
  postInterviewGuide,
  getInterviewData,
  getInterviewSessionMessages,
  deleteInterviewSession,
  patchInterviewPause,
  patchInterviewEndDate,
  patchInterviewStartDate,
  getPausedSessionsDueForReminder,
  getExpiredPausedSessions,
  patchInterviewSessionReminderSent,
  patchBulkExpirePausedSessions,
  getScheduledSessionsForExpiredInterviews,
  patchBulkCancelScheduledSessions,
} from "@/apps/db-worker/src/controllers/index.ts";

const router = express.Router();

// GET routes
router.get("/", getStudy);
router.get("/list", getStudies);
router.get("/access", canAccessStudy);
router.get("/shared", getStudyByShareToken);
router.get("/share-info", getStudyShareInfo);
router.get("/public-redirect", getStudyPublicRedirectInfo);
router.get("/bookmarked", getBookmarkedStudies);
router.get("/live-session/token", getLiveSessionByToken);
router.get("/live-session/details", getLiveSessionDetails);
router.get("/live-session/backroom-messages", getBackroomMessages);
router.get("/tldr-status", getStudyTldrStatus);
router.get("/takeaways", getStudyTakeaways);

// POST routes
router.post("/attempts", postStudyAttempts);
router.post("/status", postStudyStatus);
router.post("/init", postStudyInit);
router.post("/finalize", postStudyFinalize);
router.post("/toggle-bookmark", postToggleStudyBookmark);
router.post("/regenerate-share-token", postStudyRegenerateShareToken);
router.post("/toggle-share-link", postStudyToggleShareLink);
router.post("/live-session/init", postLiveSessionInit);
router.post("/live-session/tag", postLiveSessionTag);
router.post("/live-session/note", postLiveSessionNote);
router.post("/live-session/backroom-message", postBackroomMessage);
router.post("/live-session/transcript", postLiveSessionTranscript);
router.post(
  "/live-session/recording/finalize",
  postLiveSessionRecordingFinalize,
);
router.post("/takeaways", postStudyTakeaways);
router.post("/takeaway", postStudyTakeaway);
router.patch("/takeaways/reorder", patchStudyTakeawaysOrder);
router.patch("/takeaways/:id", patchStudyTakeaway);
router.delete("/takeaways/:id", deleteStudyTakeaway);

router.patch(
  "/takeaway-recommendations/reorder",
  patchTakeawayRecommendationsOrder,
);
router.patch("/takeaway-recommendations/:id", patchStudyTakeawayRecommendation);
router.delete(
  "/takeaway-recommendations/:id",
  deleteStudyTakeawayRecommendation,
);
router.post("/takeaway-recommendations", postStudyTakeawayRecommendation);

// PATCH routes
router.patch("/name", updateStudyName);
router.patch("/team", patchStudyTeam);
router.post("/transfer", postTransferStudy);
router.patch("/visibility", patchStudyVisibility);
router.patch("/live-session/status", patchLiveSessionStatus);
router.patch(
  "/live-session/recording-started",
  patchLiveSessionRecordingStarted,
);
router.patch("/live-session/interviewer", patchLiveSessionInterviewer);
router.patch("/live-session/name", patchLiveSessionName);
router.patch("/tldr-status", patchStudyTldrStatus);

// DELETE routes
router.delete("/", deleteStudy);
router.delete("/live-session", deleteLiveSession);

// Interview routes
router.post("/interview/init", postInterviewInit);
router.post("/interview/session/init", postInterviewSessionInit);
router.get("/interview/session/token", getInterviewSessionByToken);
router.get("/interview/session/details", getInterviewSessionDetails);
router.patch("/interview/session/status", patchInterviewSessionStatus);
router.post("/interview/session/messages", postInterviewSessionMessages);
router.post("/interview/session/probe", postInterviewSessionProbe);
router.get("/interview/session/probes", getInterviewSessionProbes);
router.get("/interview/session/messages", getInterviewSessionMessages);
router.patch("/interview/session/recording", patchInterviewSessionRecording);
router.patch("/interview/session/name", patchInterviewSessionName);
router.post("/interview/guide", postInterviewGuide);
router.get("/interview/data", getInterviewData);
router.delete("/interview/session", deleteInterviewSession);
router.patch("/interview/session/pause", patchInterviewPause);
router.patch("/interview/end-date", patchInterviewEndDate);
router.patch("/interview/start-date", patchInterviewStartDate);
router.get("/interview/session/reminders-due", getPausedSessionsDueForReminder);
router.get("/interview/session/expired", getExpiredPausedSessions);
router.patch(
  "/interview/session/reminder-sent",
  patchInterviewSessionReminderSent,
);
router.patch("/interview/session/bulk-expire", patchBulkExpirePausedSessions);
router.get(
  "/interview/session/scheduled-expired",
  getScheduledSessionsForExpiredInterviews,
);
router.patch(
  "/interview/session/bulk-cancel",
  patchBulkCancelScheduledSessions,
);

export default router;
