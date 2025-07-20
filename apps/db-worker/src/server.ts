import app from "@/apps/db-worker/src/app.ts";
import { logger } from "@/apps/db-worker/src/logger.ts";

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});
