import express from "express";
import {
  deleteCWIssue,
  deleteCWRecommendation,
  getCWQuestion,
  getCognitiveWalkthrough,
  postCognitiveWalkthrough,
  updateCWIssue,
  updateCWRecommendation,
  createCWRecommendation,
  createCWIssue,
} from "@/apps/db-worker/src/controllers/databaseController.ts";

const router = express.Router();

// GET routes
router.get("/", getCognitiveWalkthrough);
router.get("/questions", getCWQuestion);

// POST routes
router.post("/", postCognitiveWalkthrough);
router.post("/recommendations", createCWRecommendation);
router.post("/issues", createCWIssue);

// PATCH routes
router.patch("/issues/:id", updateCWIssue);
router.patch("/recommendations/:id", updateCWRecommendation);

// DELETE routes
router.delete("/issues/:id", deleteCWIssue);
router.delete("/recommendations/:id", deleteCWRecommendation);

export default router;
