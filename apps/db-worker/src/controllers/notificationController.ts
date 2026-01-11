/**
 * Notification-related controller handlers.
 */

import {
  sendSuccess,
  sendError,
  requireBodyFields,
  withErrorHandler,
} from "./utils.ts";
import {
  dbCreateNotification,
  dbGetUserNotifications,
  dbGetUnreadNotificationCount,
  dbMarkNotificationAsRead,
  dbMarkAllNotificationsAsRead,
  dbDeleteNotification,
} from "@/apps/db-worker/src/services/index.ts";

export const getNotifications = withErrorHandler(async (req, res) => {
  const userId = req.query.userId as string;
  const page = parseInt(req.query.page as string) || 1;
  const pageSize = parseInt(req.query.pageSize as string) || 20;
  const unreadOnly = req.query.unreadOnly === "true";

  if (!userId) {
    return sendError(res, "userId is required");
  }

  const data = await dbGetUserNotifications(userId, { page, pageSize, unreadOnly });
  return sendSuccess(res, data);
}, "GET /notifications");

export const getNotificationsUnreadCount = withErrorHandler(async (req, res) => {
  const userId = req.query.userId as string;

  if (!userId) {
    return sendError(res, "userId is required");
  }

  const count = await dbGetUnreadNotificationCount(userId);
  return sendSuccess(res, { count });
}, "GET /notifications/unread-count");

export const postNotification = withErrorHandler(async (req, res) => {
  const {
    userId,
    type,
    audience,
    title,
    message,
    actionUrl,
    metadata,
    expiresAt,
  } = req.body || {};

  if (!requireBodyFields(req.body || {}, ["userId", "type", "title"], res)) {
    return;
  }

  const data = await dbCreateNotification({
    userId,
    type: type as any,
    audience: audience as any,
    title,
    message: message || null,
    actionUrl: actionUrl || null,
    metadata: metadata || null,
    expiresAt: expiresAt ? new Date(expiresAt) : null,
  });
  return sendSuccess(res, data, 201);
}, "POST /notifications");

export const postNotificationMarkRead = withErrorHandler(async (req, res) => {
  const notificationId = req.params.id || (req.body.notificationId as string);
  const userId = req.body.userId as string;

  if (!notificationId || !userId) {
    return sendError(res, "notificationId and userId are required");
  }

  const result = await dbMarkNotificationAsRead(notificationId, userId);
  if (!result) {
    return sendError(res, "Notification not found", 404);
  }
  return sendSuccess(res);
}, "POST /notifications/:id/read");

export const postNotificationsMarkAllRead = withErrorHandler(async (req, res) => {
  const userId = req.body.userId as string;

  if (!userId) {
    return sendError(res, "userId is required");
  }

  const result = await dbMarkAllNotificationsAsRead(userId);
  return sendSuccess(res, result);
}, "POST /notifications/mark-all-read");

export const deleteNotification = withErrorHandler(async (req, res) => {
  const notificationId = req.params.id || (req.query.notificationId as string);
  const userId = (req.query.userId as string) || (req.body.userId as string);

  if (!notificationId || !userId) {
    return sendError(res, "notificationId and userId are required");
  }

  const result = await dbDeleteNotification(notificationId, userId);
  if (!result) {
    return sendError(res, "Notification not found", 404);
  }
  return sendSuccess(res);
}, "DELETE /notifications/:id");
