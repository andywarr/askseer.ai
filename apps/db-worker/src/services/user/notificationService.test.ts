import { describe, it, expect, vi, beforeEach } from "vitest";
import prisma from "@/apps/db-worker/src/services/db.ts";
import {
  dbCreateNotification,
  dbGetUserNotifications,
  dbGetUnreadNotificationCount,
  dbMarkNotificationAsRead,
  dbMarkAllNotificationsAsRead,
  dbDeleteNotification,
} from "../index.ts";

describe("notificationService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("dbCreateNotification", () => {
    it("should create a notification with required fields", async () => {
      const mockNotification = {
        id: "notif-123",
        userId: "user-123",
        type: "STUDY_COMPLETE",
        audience: "USER",
        title: "Study completed",
        message: null,
        actionUrl: null,
        metadata: null,
        expiresAt: null,
        isRead: false,
        createdAt: new Date(),
      };

      vi.mocked(prisma.notification.create).mockResolvedValue(
        mockNotification as any
      );

      const result = await dbCreateNotification({
        userId: "user-123",
        type: "STUDY_COMPLETE" as any,
        title: "Study completed",
      });

      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: {
          userId: "user-123",
          type: "STUDY_COMPLETE",
          audience: "USER",
          title: "Study completed",
          message: undefined,
          actionUrl: undefined,
          metadata: undefined,
          expiresAt: undefined,
        },
      });
      expect(result.id).toBe("notif-123");
    });

    it("should create a notification with all fields", async () => {
      const mockNotification = {
        id: "notif-123",
        userId: "user-123",
        type: "STUDY_COMPLETE",
        audience: "ADMIN",
        title: "Study completed",
        message: "Your study has finished processing",
        actionUrl: "/evaluation/study-123",
        metadata: { studyId: "study-123" },
        expiresAt: new Date(),
        isRead: false,
        createdAt: new Date(),
      };

      vi.mocked(prisma.notification.create).mockResolvedValue(
        mockNotification as any
      );

      const result = await dbCreateNotification({
        userId: "user-123",
        type: "STUDY_COMPLETE" as any,
        audience: "ADMIN" as any,
        title: "Study completed",
        message: "Your study has finished processing",
        actionUrl: "/evaluation/study-123",
        metadata: { studyId: "study-123" },
      });

      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          audience: "ADMIN",
          message: "Your study has finished processing",
          actionUrl: "/evaluation/study-123",
          metadata: { studyId: "study-123" },
        }),
      });
      expect(result.audience).toBe("ADMIN");
    });

    it("should throw error on database failure", async () => {
      vi.mocked(prisma.notification.create).mockRejectedValue(
        new Error("Database error")
      );

      await expect(
        dbCreateNotification({
          userId: "user-123",
          type: "STUDY_COMPLETE" as any,
          title: "Test",
        })
      ).rejects.toThrow("Database error");
    });
  });

  describe("dbGetUserNotifications", () => {
    it("should return paginated notifications with defaults", async () => {
      const mockNotifications = [
        { id: "notif-1", title: "Notification 1" },
        { id: "notif-2", title: "Notification 2" },
      ];

      vi.mocked(prisma.notification.findMany).mockResolvedValue(
        mockNotifications as any
      );
      vi.mocked(prisma.notification.count).mockResolvedValue(2);

      const result = await dbGetUserNotifications("user-123");

      expect(prisma.notification.findMany).toHaveBeenCalledWith({
        where: { userId: "user-123" },
        orderBy: { createdAt: "desc" },
        skip: 0,
        take: 20,
      });
      expect(result.notifications).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
      expect(result.totalPages).toBe(1);
    });

    it("should support custom pagination", async () => {
      vi.mocked(prisma.notification.findMany).mockResolvedValue([]);
      vi.mocked(prisma.notification.count).mockResolvedValue(100);

      const result = await dbGetUserNotifications("user-123", {
        page: 3,
        pageSize: 10,
      });

      expect(prisma.notification.findMany).toHaveBeenCalledWith({
        where: { userId: "user-123" },
        orderBy: { createdAt: "desc" },
        skip: 20,
        take: 10,
      });
      expect(result.page).toBe(3);
      expect(result.pageSize).toBe(10);
      expect(result.totalPages).toBe(10);
    });

    it("should filter unread only when specified", async () => {
      vi.mocked(prisma.notification.findMany).mockResolvedValue([]);
      vi.mocked(prisma.notification.count).mockResolvedValue(0);

      await dbGetUserNotifications("user-123", { unreadOnly: true });

      expect(prisma.notification.findMany).toHaveBeenCalledWith({
        where: { userId: "user-123", isRead: false },
        orderBy: { createdAt: "desc" },
        skip: 0,
        take: 20,
      });
    });
  });

  describe("dbGetUnreadNotificationCount", () => {
    it("should return count of unread notifications", async () => {
      vi.mocked(prisma.notification.count).mockResolvedValue(5);

      const result = await dbGetUnreadNotificationCount("user-123");

      expect(prisma.notification.count).toHaveBeenCalledWith({
        where: {
          userId: "user-123",
          isRead: false,
        },
      });
      expect(result).toBe(5);
    });

    it("should return 0 when no unread notifications", async () => {
      vi.mocked(prisma.notification.count).mockResolvedValue(0);

      const result = await dbGetUnreadNotificationCount("user-123");

      expect(result).toBe(0);
    });
  });

  describe("dbMarkNotificationAsRead", () => {
    it("should mark notification as read", async () => {
      vi.mocked(prisma.notification.updateMany).mockResolvedValue({ count: 1 });

      const result = await dbMarkNotificationAsRead("notif-123", "user-123");

      expect(prisma.notification.updateMany).toHaveBeenCalledWith({
        where: {
          id: "notif-123",
          userId: "user-123",
        },
        data: {
          isRead: true,
          readAt: expect.any(Date),
        },
      });
      expect(result).toEqual({ success: true });
    });

    it("should return null when notification not found or not owned", async () => {
      vi.mocked(prisma.notification.updateMany).mockResolvedValue({ count: 0 });

      const result = await dbMarkNotificationAsRead("notif-123", "user-123");

      expect(result).toBeNull();
    });
  });

  describe("dbMarkAllNotificationsAsRead", () => {
    it("should mark all unread notifications as read", async () => {
      vi.mocked(prisma.notification.updateMany).mockResolvedValue({ count: 5 });

      const result = await dbMarkAllNotificationsAsRead("user-123");

      expect(prisma.notification.updateMany).toHaveBeenCalledWith({
        where: {
          userId: "user-123",
          isRead: false,
        },
        data: {
          isRead: true,
          readAt: expect.any(Date),
        },
      });
      expect(result).toEqual({ count: 5 });
    });

    it("should return count 0 when no unread notifications", async () => {
      vi.mocked(prisma.notification.updateMany).mockResolvedValue({ count: 0 });

      const result = await dbMarkAllNotificationsAsRead("user-123");

      expect(result).toEqual({ count: 0 });
    });
  });

  describe("dbDeleteNotification", () => {
    it("should delete notification when owned by user", async () => {
      vi.mocked(prisma.notification.deleteMany).mockResolvedValue({ count: 1 });

      const result = await dbDeleteNotification("notif-123", "user-123");

      expect(prisma.notification.deleteMany).toHaveBeenCalledWith({
        where: {
          id: "notif-123",
          userId: "user-123",
        },
      });
      expect(result).toEqual({ success: true });
    });

    it("should return null when notification not found or not owned", async () => {
      vi.mocked(prisma.notification.deleteMany).mockResolvedValue({ count: 0 });

      const result = await dbDeleteNotification("notif-123", "user-123");

      expect(result).toBeNull();
    });

    it("should throw error on database failure", async () => {
      vi.mocked(prisma.notification.deleteMany).mockRejectedValue(
        new Error("Database error")
      );

      await expect(
        dbDeleteNotification("notif-123", "user-123")
      ).rejects.toThrow("Database error");
    });
  });
});
