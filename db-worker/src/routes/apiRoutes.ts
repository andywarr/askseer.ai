import express from "express";
import {
  deleteStudy,
  getStudies,
  getStudy,
  getUser,
} from "../controllers/databaseController.ts";

const router = express.Router();

// Delete routes
router.delete("/study", deleteStudy);

// Get routes
router.get("/studies", getStudies);
router.get("/study", getStudy);
router.get("/user", getUser);

export default router;
