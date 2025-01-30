import express from "express";
import { getStudies } from "../controllers/databaseController.ts";

const router = express.Router();

router.get("/studies", getStudies);

export default router;
