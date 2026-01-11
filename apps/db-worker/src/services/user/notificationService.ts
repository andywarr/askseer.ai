import prisma from "../db.ts";
import type { NotificationType, NotificationAudience } from "@prisma/client";
import { logger } from "@/apps/shared/logger.ts";

// ============================================================================
// Notification Types
// ============================================================================

export interface CreateNotificationData {
  userId: string;
  type: NotificationType;
  audience?: NotificationAudience;
  title: string;
  message?: string | null;
  actionUrl?: string | null;
  metadata?: Record<string, unknown> | null;
  expiresAt?: Date | null;
}

// ============================================================================
// Create Notification
// ============================================================================

export async function dbCreateNotification(data: CreateNotificationData) {
  try {
    const notification = await prisma.notification.create({
      data: {
        userId: data.userId,
        type: data.type,
        audience: data.audience || "USER",
        title: data.title,
        message: data.message,
        actionUrl: data.actionUrl,
        metadata: data.metadata as any,
        expiresAt: data.expiresAt,
      },
    });

    logger.info("Created notification", {
      notificationId: notification.id,
      userId: data.userId,
      type: data.type,
    });

    return notification;
  } catch (error) {
    logger.error("Failed to create notification", { data, error });
    throw error;
  }
}

// ============================================================================
// Read/List Notifications
// ============================================================================

export async function dbGetUserNotifications(
  userId: string,
  options?: {
    page?: number;
    pageSize?: number;
    unreadOnly?: boolean;
  }
) {
  const page = options?.page ?? 1;
  const pageSize = options?.pageSize ?? 20;
  const skip = (page - 1) * pageSize;

  try {
    const where: { userId: string; isRead?: boolean } = { userId };
    if (options?.unreadOnly) {
      where.isRead = false;
    }

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
      prisma.notification.count({ where }),
    ]);

    logger.info("Fetched user notifications", {
      userId,
      count: notifications.length,
      total,
      page,
      pageSize,
    });

    return {
      notifications,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  } catch (error) {
    logger.error("Failed to fetch user notifications", { userId, error });
    throw error;
  }
}

export async function dbGetUnreadNotificationCount(userId: string) {
  try {
    const count = await prisma.notification.count({
      where: {
        userId,
        isRead: false,
      },
    });

    logger.debug("Fetched unread notification count", { userId, count });
    return count;
  } catch (error) {
    logger.error("Failed to fetch unread notification count", {
      userId,
      error,
    });
    throw error;
  }
}

export async function dbMarkNotificationAsRead(
  notificationId: string,
  userId: string
) {
  try {
    const notification = await prisma.notification.updateMany({
      where: {
        id: notificationId,
        userId, // Ensure user owns this notification
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    if (notification.count === 0) {
      logger.warn("Notification not found or not owned by user", {
        notificationId,
        userId,
      });
      return null;
    }

    logger.info("Marked notification as read", { notificationId, userId });
    return { success: true };
  } catch (error) {
    logger.error("Failed to mark notification as read", {
      notificationId,
      userId,
      error,
    });
    throw error;
  }
}

export async function dbMarkAllNotificationsAsRead(userId: string) {
  try {
    const result = await prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    logger.info("Marked all notifications as read", {
      userId,
      count: result.count,
    });
    return { count: result.count };
  } catch (error) {
    logger.error("Failed to mark all notifications as read", { userId, error });
    throw error;
  }
}

export async function dbDeleteNotification(
  notificationId: string,
  userId: string
) {
  try {
    const result = await prisma.notification.deleteMany({
      where: {
        id: notificationId,
        userId, // Ensure user owns this notification
      },
    });

    if (result.count === 0) {
      logger.warn("Notification not found or not owned by user", {
        notificationId,
        userId,
      });
      return null;
    }

    logger.info("Deleted notification", { notificationId, userId });
    return { success: true };
  } catch (error) {
    logger.error("Failed to delete notification", {
      notificationId,
      userId,
      error,
    });
    throw error;
  }
}
