import express from "express";
import {
  deleteUserAccount,
  getUser,
  getUserTeams,
  updateUserName,
  updateUserImage,
  updateUserSelectedTeam,
  getCommunicationPreferences,
  updateCommunicationPreferences,
} from "@/apps/db-worker/src/controllers/index.ts";

const router = express.Router();

// GET routes
router.get("/", getUser);
router.get("/teams", getUserTeams);
router.get("/communication-preferences", getCommunicationPreferences);

// PATCH routes
router.patch("/name", updateUserName);
router.patch("/image", updateUserImage);
router.patch("/selected-team", updateUserSelectedTeam);
router.patch("/communication-preferences", updateCommunicationPreferences);

// DELETE routes
router.delete("/", deleteUserAccount);

export default router;
