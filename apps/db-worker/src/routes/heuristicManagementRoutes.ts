import express from "express";
import {
  getHeuristicFamilies,
  getHeuristicFamily,
  createHeuristicFamily,
  updateHeuristicFamily,
  deleteHeuristicFamily,
  toggleHeuristicFamilyVisibility,
  getHeuristic,
  createHeuristic,
  updateHeuristic,
  deleteHeuristic,
  createHeuristicExample,
  updateHeuristicExample,
  deleteHeuristicExample,
} from "@/apps/db-worker/src/controllers/index.ts";

const router = express.Router();

// Heuristic Family routes
router.get("/families", getHeuristicFamilies);
router.get("/families/:id", getHeuristicFamily);
router.post("/families", createHeuristicFamily);
router.patch("/families/:id", updateHeuristicFamily);
router.delete("/families/:id", deleteHeuristicFamily);
router.post("/families/:id/visibility", toggleHeuristicFamilyVisibility);

// Heuristic routes
router.get("/:id", getHeuristic);
router.post("/", createHeuristic);
router.patch("/:id", updateHeuristic);
router.delete("/:id", deleteHeuristic);

// Heuristic Example routes
router.post("/examples", createHeuristicExample);
router.patch("/examples/:id", updateHeuristicExample);
router.delete("/examples/:id", deleteHeuristicExample);

export default router;
