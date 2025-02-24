// Express imports
import express from "express";

// Function imports
import {
  deleteStudy,
  getCWQuestion,
  getHeuristics,
  getStudies,
  getStudy,
  getUser,
  postCognitiveWalkthrough,
  postHeuristicEvaluation,
  postStudy,
  postStudyStatus,
  postUpdateCredits,
} from "@/apps/db-worker/src/controllers/databaseController.ts";

const router = express.Router();

// Delete routes
router.delete("/study", deleteStudy);

// Get routes
router.get("/cwquestions", getCWQuestion);
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

export default router;
