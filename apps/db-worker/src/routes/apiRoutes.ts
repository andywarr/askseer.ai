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
  getCognitiveWalkthrough,
  getFiles,
  getHeuristics,
  getHeuristicEvaluation,
  getStudies,
  getStudy,
  getUser,
  postCognitiveWalkthrough,
  postHeuristicEvaluation,
  postStudy,
  postStudyAttempts,
  postStudyStatus,
  postUpdateCredits,
  updateCWIssue,
  updateCWRecommendation,
  updateHEResult,
  updateHERecommendation,
  updateStudyName,
  createCWRecommendation,
  createHERecommendation,
  createHEResult,
  createCWIssue,
  updateUserName,
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
router.get("/cognitiveWalkthrough", getCognitiveWalkthrough);
router.get("/cwquestions", getCWQuestion);
router.get("/files", getFiles);
router.get("/heuristics", getHeuristics);
router.get("/heuristicEvaluation", getHeuristicEvaluation);
router.get("/studies", getStudies);
router.get("/study", getStudy);
router.get("/user", getUser);

// Post routes
router.post("/cognitiveWalkthrough", postCognitiveWalkthrough);
router.post("/heuristicEvaluation", postHeuristicEvaluation);
router.post("/study", postStudy);
router.post("/studyAttempts", postStudyAttempts);
router.post("/studyStatus", postStudyStatus);
router.post("/updateCredits", postUpdateCredits);
router.post("/cognitiveWalkthrough/recommendations", createCWRecommendation);
router.post("/cognitiveWalkthrough/issues", createCWIssue);
router.post("/heuristicEvaluation/recommendations", createHERecommendation);
router.post("/heuristicEvaluation/results", createHEResult);

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
router.patch("/study/name", updateStudyName);
router.patch("/user/name", updateUserName);

export default router;
