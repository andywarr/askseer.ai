import express from "express";
import { getAllData } from "../controllers/databaseController.ts";

const router = express.Router();

router.get("/data", getAllData);

export default router;
