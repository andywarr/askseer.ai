import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import apiRoutes from "@/apps/db-worker/src/routes/apiRoutes.ts";
import { errorHandler } from "@/apps/db-worker/src/middleware/errorHandler.ts";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));
app.use("/api", apiRoutes);
app.use(errorHandler); // Global error handler

export default app;
