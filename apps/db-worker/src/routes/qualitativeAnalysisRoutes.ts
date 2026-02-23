import express from "express";
import {
  getQualitativeAnalysis,
  postQualitativeAnalysis,
  patchQualitativeAnalysisSummary,
  patchAnalysisInsight,
  deleteAnalysisQuote,
  postAnalysisTag,
  deleteAnalysisTag,
  deleteAnalysisInsight,
  postAnalysisQuote,
  postAnalysisInsight,
} from "@/apps/db-worker/src/controllers/index.ts";

const router = express.Router();

// GET routes
router.get("/", getQualitativeAnalysis);

// POST routes
router.post("/", postQualitativeAnalysis);

// PATCH routes
router.patch("/summary", patchQualitativeAnalysisSummary);
router.patch("/insight", patchAnalysisInsight);

// DELETE routes
router.delete("/quote", deleteAnalysisQuote);
router.delete("/tag", deleteAnalysisTag);
router.delete("/insight", deleteAnalysisInsight);

// POST routes for tags
router.post("/tag", postAnalysisTag);

// POST routes for quotes
router.post("/quote", postAnalysisQuote);

// POST routes for insights
router.post("/insight", postAnalysisInsight);

export default router;
