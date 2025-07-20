import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import apiRoutes from "@/apps/db-worker/src/routes/apiRoutes.ts";
import { errorHandler } from "@/apps/db-worker/src/middleware/errorHandler.ts";
import { logger } from "@/apps/db-worker/src/logger.ts";

dotenv.config();

const app = express();

// Logging middleware
app.use((req, _res, next) => {
  logger.info("Incoming request", {
    method: req.method,
    url: req.url,
    userAgent: req.get("User-Agent"),
    ip: req.ip,
  });
  next();
});

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));
app.use("/api", apiRoutes);
app.use(errorHandler); // Global error handler

export default app;
