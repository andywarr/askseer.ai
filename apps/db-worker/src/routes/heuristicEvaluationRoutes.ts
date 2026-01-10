import express from "express";
import {
  deleteHEResult,
  deleteHERecommendation,
  getHeuristics,
  getHeuristicEvaluation,
  postHeuristicEvaluation,
  updateHEResult,
  updateHERecommendation,
  createHERecommendation,
  createHEResult,
} from "@/apps/db-worker/src/controllers/index.ts";

const router = express.Router();

// GET routes
router.get("/", getHeuristicEvaluation);
router.get("/heuristics", getHeuristics);

// POST routes
router.post("/", postHeuristicEvaluation);
router.post("/recommendations", createHERecommendation);
router.post("/results", createHEResult);

// PATCH routes
router.patch("/issues/:id", updateHEResult);
router.patch("/recommendations/:id", updateHERecommendation);

// DELETE routes
router.delete("/issues/:id", deleteHEResult);
router.delete("/recommendations/:id", deleteHERecommendation);

export default router;
