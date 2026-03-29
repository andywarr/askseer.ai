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

router.patch("/takeaway-recommendations/reorder", patchTakeawayRecommendationsOrder);
router.patch("/takeaway-recommendations/:id", patchStudyTakeawayRecommendation);
router.delete("/takeaway-recommendations/:id", deleteStudyTakeawayRecommendation);
router.post("/takeaway-recommendations", postStudyTakeawayRecommendation);

// PATCH routes
router.patch("/name", updateStudyName);
router.patch("/team", patchStudyTeam);
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

export default router;
