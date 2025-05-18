// Express imports
import express from "express";

// Function imports
import {
  deleteStudy,
  deleteCWIssue,
  deleteCWRecommendation,
  deleteHEResult,
  deleteHERecommendation,
  getCWQuestion,
  getFiles,
  getHeuristics,
  getStudies,
  getStudy,
  getUser,
  postCognitiveWalkthrough,
  postHeuristicEvaluation,
  postStudy,
  postStudyStatus,
  postUpdateCredits,
  updateCWIssue,
  updateCWRecommendation,
  updateHEResult,
  updateHERecommendation,
} from "@/apps/db-worker/src/controllers/databaseController.ts";

const router = express.Router();

// Delete routes
router.delete("/study", deleteStudy);
router.delete("/cognitiveWalkthrough/issues/:id", deleteCWIssue);
router.delete(
  "/cognitiveWalkthrough/recommendations/:id",
  deleteCWRecommendation
);
router.delete("/heuristicEvaluation/issues/:id", deleteHEResult);
router.delete(
  "/heuristicEvaluation/recommendations/:id",
  deleteHERecommendation
);

// Get routes
router.get("/cwquestions", getCWQuestion);
router.get("/files", getFiles);
router.get("/heuristics", getHeuristics);
router.get("/studies", getStudies);
router.get("/study", getStudy);
router.get("/user", getUser);

// Post routes
router.post("/cognitiveWalkthrough", postCognitiveWalkthrough);
router.post("/heuristicEvaluation", postHeuristicEvaluation);
router.post("/study", postStudy);
router.post("/studyStatus", postStudyStatus);
router.post("/updateCredits", postUpdateCredits);

// Patch routes
router.patch("/cognitiveWalkthrough/issues/:id", updateCWIssue);
router.patch(
  "/cognitiveWalkthrough/recommendations/:id",
  updateCWRecommendation
);
router.patch("/heuristicEvaluation/issues/:id", updateHEResult);
router.patch(
  "/heuristicEvaluation/recommendations/:id",
  updateHERecommendation
);

export default router;
