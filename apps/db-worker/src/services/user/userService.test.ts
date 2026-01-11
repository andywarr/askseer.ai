import { describe, it, expect, vi, beforeEach } from "vitest";
import prisma from "@/apps/db-worker/src/services/db.ts";
import {
  dbGetUser,
  dbUpdateUserName,
  dbUpdateUserImage,
  dbUpdateUserSelectedTeam,
  dbGetCommunicationPreferences,
  dbUpdateCommunicationPreferences,
  dbDeleteUserAccount,
} from "../index.ts";

// Mock S3 service
vi.mock("../storage/s3Service.ts", () => ({
  deleteS3Objects: vi.fn().mockResolvedValue({ deleted: [], errors: [] }),
}));

describe("userService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("dbGetUser", () => {
    it("should return user when found", async () => {
      const mockUser = {
        id: "user-123",
        name: "Test User",
        email: "test@example.com",
      };

      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);

      const result = await dbGetUser("user-123");

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: "user-123" },
      });
      expect(result).toEqual(mockUser);
    });

    it("should return null when user not found", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      const result = await dbGetUser("nonexistent");

      expect(result).toBeNull();
    });

    it("should throw error on database failure", async () => {
      vi.mocked(prisma.user.findUnique).mockRejectedValue(
        new Error("Database error")
      );

      await expect(dbGetUser("user-123")).rejects.toThrow("Database error");
    });
  });

  describe("dbUpdateUserName", () => {
    it("should update user name successfully", async () => {
      const mockUser = {
        id: "user-123",
        name: "New Name",
      };

      vi.mocked(prisma.user.update).mockResolvedValue(mockUser as any);

      const result = await dbUpdateUserName("user-123", "New Name");

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "user-123" },
        data: { name: "New Name" },
      });
      expect(result.name).toBe("New Name");
    });

    it("should throw error on database failure", async () => {
      vi.mocked(prisma.user.update).mockRejectedValue(
        new Error("Database error")
      );

      await expect(dbUpdateUserName("user-123", "New Name")).rejects.toThrow(
        "Database error"
      );
    });
  });

  describe("dbUpdateUserImage", () => {
    it("should update user image with new key", async () => {
      const mockUser = {
        id: "user-123",
        imageKey: "uploads/profile.jpg",
      };

      vi.mocked(prisma.user.update).mockResolvedValue(mockUser as any);

      const result = await dbUpdateUserImage("user-123", "uploads/profile.jpg");

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "user-123" },
        data: {
          imageKey: "uploads/profile.jpg",
          imageUpdatedAt: expect.any(Date),
        },
      });
      expect(result.imageKey).toBe("uploads/profile.jpg");
    });

    it("should set imageKey to null when clearing image", async () => {
      const mockUser = {
        id: "user-123",
        imageKey: null,
      };

      vi.mocked(prisma.user.update).mockResolvedValue(mockUser as any);

      await dbUpdateUserImage("user-123", null);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "user-123" },
        data: {
          imageKey: null,
          imageUpdatedAt: expect.any(Date),
        },
      });
    });
  });

  describe("dbUpdateUserSelectedTeam", () => {
    it("should update selected team for active member", async () => {
      vi.mocked(prisma.teamMembership.findUnique).mockResolvedValue({
        id: "membership-123",
        status: "ACTIVE",
      } as any);
      vi.mocked(prisma.team.findUnique).mockResolvedValue({
        isPersonal: false,
        company: null,
      } as any);
      vi.mocked(prisma.user.update).mockResolvedValue({
        id: "user-123",
        selectedTeamId: "team-123",
      } as any);

      const result = await dbUpdateUserSelectedTeam({
        userId: "user-123",
        teamId: "team-123",
      });

      expect(prisma.teamMembership.findUnique).toHaveBeenCalledWith({
        where: { teamId_userId: { teamId: "team-123", userId: "user-123" } },
        select: { id: true, status: true },
      });
      expect(result.selectedTeamId).toBe("team-123");
    });

    it("should throw error when user is not a member", async () => {
      vi.mocked(prisma.teamMembership.findUnique).mockResolvedValue(null);

      await expect(
        dbUpdateUserSelectedTeam({
          userId: "user-123",
          teamId: "team-123",
        })
      ).rejects.toThrow("User is not a member of the requested team");
    });

    it("should throw error when membership is not active", async () => {
      vi.mocked(prisma.teamMembership.findUnique).mockResolvedValue({
        id: "membership-123",
        status: "PENDING",
      } as any);

      await expect(
        dbUpdateUserSelectedTeam({
          userId: "user-123",
          teamId: "team-123",
        })
      ).rejects.toThrow("User is not a member of the requested team");
    });

    it("should throw error when selecting personal team that is disabled", async () => {
      vi.mocked(prisma.teamMembership.findUnique).mockResolvedValue({
        id: "membership-123",
        status: "ACTIVE",
      } as any);
      vi.mocked(prisma.team.findUnique).mockResolvedValue({
        isPersonal: true,
        company: { disablePersonalTeams: true },
      } as any);

      await expect(
        dbUpdateUserSelectedTeam({
          userId: "user-123",
          teamId: "team-123",
        })
      ).rejects.toThrow("Personal teams are disabled for your company");
    });
  });

  describe("dbGetCommunicationPreferences", () => {
    it("should return communication preferences when found", async () => {
      const mockPrefs = {
        digest: true,
        productUpdates: false,
        promotions: true,
        educational: true,
        feedback: false,
        security: true,
        billing: true,
        policy: true,
        updatedAt: new Date(),
      };

      vi.mocked(prisma.communicationPreferences.findUnique).mockResolvedValue(
        mockPrefs as any
      );

      const result = await dbGetCommunicationPreferences("user-123");

      expect(prisma.communicationPreferences.findUnique).toHaveBeenCalledWith({
        where: { userId: "user-123" },
        select: {
          digest: true,
          productUpdates: true,
          promotions: true,
          educational: true,
          feedback: true,
          security: true,
          billing: true,
          policy: true,
          updatedAt: true,
        },
      });
      expect(result).toEqual(mockPrefs);
    });

    it("should return null when preferences not found", async () => {
      vi.mocked(prisma.communicationPreferences.findUnique).mockResolvedValue(
        null
      );

      const result = await dbGetCommunicationPreferences("user-123");

      expect(result).toBeNull();
    });
  });

  describe("dbUpdateCommunicationPreferences", () => {
    it("should update valid communication preferences", async () => {
      const mockPrefs = {
        digest: false,
        productUpdates: true,
        promotions: false,
        educational: true,
        feedback: true,
        security: true,
        billing: true,
        policy: true,
        updatedAt: new Date(),
      };

      vi.mocked(prisma.communicationPreferences.upsert).mockResolvedValue(
        mockPrefs as any
      );

      const result = await dbUpdateCommunicationPreferences("user-123", {
        digest: false,
        productUpdates: true,
      });

      expect(prisma.communicationPreferences.upsert).toHaveBeenCalledWith({
        where: { userId: "user-123" },
        update: { digest: false, productUpdates: true },
        create: { userId: "user-123", digest: false, productUpdates: true },
        select: expect.any(Object),
      });
      expect(result.digest).toBe(false);
      expect(result.productUpdates).toBe(true);
    });

    it("should throw error when no valid fields provided", async () => {
      await expect(
        dbUpdateCommunicationPreferences("user-123", {} as any)
      ).rejects.toThrow("No valid communication preference fields provided");
    });

    it("should ignore invalid preference keys", async () => {
      const mockPrefs = {
        digest: true,
        productUpdates: true,
        promotions: true,
        educational: true,
        feedback: true,
        security: true,
        billing: true,
        policy: true,
        updatedAt: new Date(),
      };

      vi.mocked(prisma.communicationPreferences.upsert).mockResolvedValue(
        mockPrefs as any
      );

      await dbUpdateCommunicationPreferences("user-123", {
        digest: true,
        invalidKey: false,
      } as any);

      expect(prisma.communicationPreferences.upsert).toHaveBeenCalledWith({
        where: { userId: "user-123" },
        update: { digest: true },
        create: { userId: "user-123", digest: true },
        select: expect.any(Object),
      });
    });
  });

  describe("dbDeleteUserAccount", () => {
    it("should throw 403 when requestedById does not match userId", async () => {
      await expect(
        dbDeleteUserAccount({
          userId: "user-123",
          requestedById: "other-user",
        })
      ).rejects.toMatchObject({
        message: "Not authorized to delete user",
        status: 403,
      });
    });

    it("should throw 404 when user not found", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      await expect(
        dbDeleteUserAccount({
          userId: "user-123",
          requestedById: "user-123",
        })
      ).rejects.toMatchObject({
        message: "User not found",
        status: 404,
      });
    });

    it("should throw 400 when user has active company memberships", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: "user-123",
        companyMemberships: [{ companyId: "company-123" }],
        teamsCreated: [],
      } as any);

      await expect(
        dbDeleteUserAccount({
          userId: "user-123",
          requestedById: "user-123",
        })
      ).rejects.toMatchObject({
        message: "Cannot delete account while you are part of a company.",
        status: 400,
      });
    });

    it("should successfully delete user with no company memberships", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: "user-123",
        companyMemberships: [],
        teamsCreated: [
          {
            id: "team-123",
            studies: [
              { id: "study-1", files: [{ key: "file1.png" }] },
            ],
          },
        ],
      } as any);

      const mockTransaction = vi.fn().mockImplementation(async (fn) => {
        const tx = {
          teamMembership: { deleteMany: vi.fn().mockResolvedValue({}) },
          study: { deleteMany: vi.fn().mockResolvedValue({}) },
          team: { deleteMany: vi.fn().mockResolvedValue({}) },
          communicationPreferences: { deleteMany: vi.fn().mockResolvedValue({}) },
          companyInvite: { deleteMany: vi.fn().mockResolvedValue({}) },
          teamInvite: { deleteMany: vi.fn().mockResolvedValue({}) },
          account: { deleteMany: vi.fn().mockResolvedValue({}) },
          session: { deleteMany: vi.fn().mockResolvedValue({}) },
          user: { delete: vi.fn().mockResolvedValue({}) },
        };
        return fn(tx);
      });
      vi.mocked(prisma.$transaction).mockImplementation(mockTransaction);

      const result = await dbDeleteUserAccount({
        userId: "user-123",
        requestedById: "user-123",
      });

      expect(result.deletedTeams).toBe(1);
      expect(result.deletedStudies).toBe(1);
      expect(result.deletedFiles).toBe(1);
    });
  });
});
