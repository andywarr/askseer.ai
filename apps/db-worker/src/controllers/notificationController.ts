/**
 * Notification-related controller handlers.
 */
import type { NextFunction, Request, Response } from "express";
import { handleServiceError, sendSuccess, sendError } from "./utils.ts";
import {
  dbCreateNotification,
  dbGetUserNotifications,
  dbGetUnreadNotificationCount,
  dbMarkNotificationAsRead,
  dbMarkAllNotificationsAsRead,
  dbDeleteNotification,
} from "@/apps/db-worker/src/services/databaseService.ts";

export const getNotifications = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.query.userId as string;
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;
    const unreadOnly = req.query.unreadOnly === "true";

    if (!userId) {
      return sendError(res, "userId is required");
    }

    const data = await dbGetUserNotifications(userId, {
      page,
      pageSize,
      unreadOnly,
    });
    return sendSuccess(res, data);
  } catch (error) {
    handleServiceError(error, res, next, "GET /notifications");
    return;
  }
};

export const getNotificationsUnreadCount = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.query.userId as string;

    if (!userId) {
      return sendError(res, "userId is required");
    }

    const count = await dbGetUnreadNotificationCount(userId);
    return sendSuccess(res, { count });
  } catch (error) {
    handleServiceError(error, res, next, "GET /notifications/unread-count");
    return;
  }
};

export const postNotification = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
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

    if (!userId || !type || !title) {
      return sendError(res, "userId, type, and title are required");
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
  } catch (error) {
    handleServiceError(error, res, next, "POST /notifications");
    return;
  }
};

export const postNotificationMarkRead = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
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
  } catch (error) {
    handleServiceError(error, res, next, "POST /notifications/:id/read");
    return;
  }
};

export const postNotificationsMarkAllRead = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.body.userId as string;

    if (!userId) {
      return sendError(res, "userId is required");
    }

    const result = await dbMarkAllNotificationsAsRead(userId);
    return sendSuccess(res, result);
  } catch (error) {
    handleServiceError(error, res, next, "POST /notifications/mark-all-read");
    return;
  }
};

export const deleteNotification = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const notificationId =
      req.params.id || (req.query.notificationId as string);
    const userId = (req.query.userId as string) || (req.body.userId as string);

    if (!notificationId || !userId) {
      return sendError(res, "notificationId and userId are required");
    }

    const result = await dbDeleteNotification(notificationId, userId);
    if (!result) {
      return sendError(res, "Notification not found", 404);
    }
    return sendSuccess(res);
  } catch (error) {
    handleServiceError(error, res, next, "DELETE /notifications/:id");
    return;
  }
};
