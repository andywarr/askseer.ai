import express from "express";
import {
  getNotifications,
  getNotificationsUnreadCount,
  postNotification,
  postNotificationMarkRead,
  postNotificationsMarkAllRead,
  deleteNotification,
} from "@/apps/db-worker/src/controllers/databaseController.ts";

const router = express.Router();

// GET routes
router.get("/", getNotifications);
router.get("/unread-count", getNotificationsUnreadCount);

// POST routes
router.post("/", postNotification);
router.post("/:id/read", postNotificationMarkRead);
router.post("/mark-all-read", postNotificationsMarkAllRead);

// DELETE routes
router.delete("/:id", deleteNotification);

export default router;
