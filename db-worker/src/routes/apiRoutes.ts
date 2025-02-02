import express from "express";
import {
  getStudies,
  getStudy,
  getUser,
} from "../controllers/databaseController.ts";

const router = express.Router();

router.get("/studies", getStudies);
router.get("/study", getStudy);
router.get("/user", getUser);

export default router;
