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

// POST routes
router.post("/attempts", postStudyAttempts);
router.post("/status", postStudyStatus);
router.post("/init", postStudyInit);
router.post("/finalize", postStudyFinalize);
router.post("/toggle-bookmark", postToggleStudyBookmark);
router.post("/regenerate-share-token", postStudyRegenerateShareToken);
router.post("/toggle-share-link", postStudyToggleShareLink);

// PATCH routes
router.patch("/name", updateStudyName);
router.patch("/team", patchStudyTeam);
router.patch("/visibility", patchStudyVisibility);

// DELETE routes
router.delete("/", deleteStudy);

export default router;
