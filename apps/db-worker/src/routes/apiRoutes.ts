import express from "express";

// Sub-routers
import studyRoutes from "@/apps/db-worker/src/routes/studyRoutes.ts";
import teamRoutes from "@/apps/db-worker/src/routes/teamRoutes.ts";
import companyRoutes from "@/apps/db-worker/src/routes/companyRoutes.ts";
import userRoutes from "@/apps/db-worker/src/routes/userRoutes.ts";
import personaRoutes from "@/apps/db-worker/src/routes/personaRoutes.ts";
import cognitiveWalkthroughRoutes from "@/apps/db-worker/src/routes/cognitiveWalkthroughRoutes.ts";
import heuristicEvaluationRoutes from "@/apps/db-worker/src/routes/heuristicEvaluationRoutes.ts";
import heuristicManagementRoutes from "@/apps/db-worker/src/routes/heuristicManagementRoutes.ts";
import notificationRoutes from "@/apps/db-worker/src/routes/notificationRoutes.ts";

// Standalone controller imports
import { getFiles } from "@/apps/db-worker/src/controllers/databaseController.ts";

const router = express.Router();

// Mount sub-routers
router.use("/study", studyRoutes);
router.use("/team", teamRoutes);
router.use("/company", companyRoutes);
router.use("/user", userRoutes);
router.use("/persona", personaRoutes);
router.use("/cognitive-walkthrough", cognitiveWalkthroughRoutes);
router.use("/heuristic-evaluation", heuristicEvaluationRoutes);
router.use("/heuristics", heuristicManagementRoutes);
router.use("/notifications", notificationRoutes);

// Standalone routes
router.get("/files", getFiles);

export default router;
