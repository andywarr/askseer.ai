import express from "express";
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
} from "../controllers/databaseController.ts";

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

export default router;
