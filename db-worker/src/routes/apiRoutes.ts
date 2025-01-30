import express from "express";
import { getStudies, getUser } from "../controllers/databaseController.ts";

const router = express.Router();

router.get("/studies", getStudies);
router.get("/user", getUser);

export default router;
