import "dotenv/config";
import app from "@/apps/db-worker/src/app.ts";
import { logger } from "@/apps/shared/logger.ts";

const PORT = process.env.PORT || 3001;

logger.info("Starting db-worker server", {
  port: PORT,
  nodeEnv: process.env.NODE_ENV || "development",
  timestamp: new Date().toISOString(),
});

// Process-level crash prevention and error logging
process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled promise rejection in db-worker", {
    error: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
  });
});

process.on("uncaughtException", (error) => {
  logger.error("Uncaught exception in db-worker", {
    error: error.message,
    stack: error.stack,
  });
});

const server = app.listen(PORT, () => {
  logger.info(`DB Worker server running successfully`, {
    port: PORT,
    environment: process.env.NODE_ENV || "development",
  });
  if (typeof process.send === "function") {
    process.send("ready");
  }
});

// Graceful shutdown
const shutdown = (signal: string) => {
  logger.info(`Received ${signal}, closing db-worker server gracefully`);
  server.close(() => {
    logger.info("db-worker server closed");
    process.exit(0);
  });
  // Force shutdown if connections do not close in time
  setTimeout(() => {
    logger.warn("db-worker forced shutdown after timeout");
    process.exit(1);
  }, 10000).unref();
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

