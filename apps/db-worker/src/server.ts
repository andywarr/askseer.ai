import "dotenv/config";
import app from "@/apps/db-worker/src/app.ts";
import { logger } from "@/apps/shared/logger.ts";

const PORT = process.env.PORT || 3001;

logger.info("Starting db-worker server", {
  port: PORT,
  nodeEnv: process.env.NODE_ENV || "development",
  timestamp: new Date().toISOString(),
});

app.listen(PORT, () => {
  logger.info(`DB Worker server running successfully`, {
    port: PORT,
    environment: process.env.NODE_ENV || "development",
  });
});
