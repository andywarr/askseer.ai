import express from "express";
import {
  deleteStudy,
  getHeuristics,
  getStudies,
  getStudy,
  getUser,
  postHeuristicEvaluation,
  postStudy,
} from "../controllers/databaseController.ts";

const router = express.Router();

// Delete routes
router.delete("/study", deleteStudy);

// Get routes
router.get("/heuristics", getHeuristics);
router.get("/studies", getStudies);
router.get("/study", getStudy);
router.get("/user", getUser);

// Post routes
router.post("/heuristicEvaluation", postHeuristicEvaluation);
router.post("/study", postStudy);

export default router;
