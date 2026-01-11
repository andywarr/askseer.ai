import { describe, it, expect, vi, beforeEach } from "vitest";
import prisma from "@/apps/db-worker/src/services/db.ts";
import {
  dbAddTeamMembers,
  dbRemoveTeamMember,
  dbUpdateTeamMemberRole,
} from "../index.ts";

describe("teamMembershipService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("dbAddTeamMembers", () => {
    it("should return empty array when no members provided", async () => {
      const result = await dbAddTeamMembers({
        teamId: "team-123",
        members: [],
        invitedById: "user-123",
      });

      expect(result).toEqual([]);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("should add members when authorized as team admin", async () => {
      const mockTransaction = vi.fn().mockImplementation(async (fn) => {
        const tx = {
          team: {
            findUnique: vi.fn().mockResolvedValue({
              id: "team-123",
              companyId: "company-123",
              isPersonal: false,
            }),
          },
          teamMembership: {
            findUnique: vi.fn().mockResolvedValue({ role: "ADMIN" }),
            findMany: vi.fn().mockResolvedValue([]),
            create: vi.fn().mockResolvedValue({ id: "mem-1", userId: "new-user" }),
          },
          companyMembership: {
            findMany: vi
              .fn()
              .mockResolvedValue([{ userId: "new-user" }]),
          },
        };
        return fn(tx);
      });
      vi.mocked(prisma.$transaction).mockImplementation(mockTransaction);

      const result = await dbAddTeamMembers({
        teamId: "team-123",
        members: [{ userId: "new-user", role: "MEMBER" as any }],
        invitedById: "admin-user",
      });

      expect(result).toHaveLength(1);
    });

    it("should throw error for personal teams", async () => {
      const mockTransaction = vi.fn().mockImplementation(async (fn) => {
        const tx = {
          team: {
            findUnique: vi.fn().mockResolvedValue({
              id: "team-123",
              companyId: "company-123",
              isPersonal: true,
            }),
          },
        };
        return fn(tx);
      });
      vi.mocked(prisma.$transaction).mockImplementation(mockTransaction);

      await expect(
        dbAddTeamMembers({
          teamId: "team-123",
          members: [{ userId: "new-user", role: "MEMBER" as any }],
          invitedById: "admin-user",
        })
      ).rejects.toThrow("Cannot invite members to personal teams");
    });

    it("should throw error when team not found", async () => {
      const mockTransaction = vi.fn().mockImplementation(async (fn) => {
        const tx = {
          team: {
            findUnique: vi.fn().mockResolvedValue(null),
          },
        };
        return fn(tx);
      });
      vi.mocked(prisma.$transaction).mockImplementation(mockTransaction);

      await expect(
        dbAddTeamMembers({
          teamId: "nonexistent",
          members: [{ userId: "new-user", role: "MEMBER" as any }],
          invitedById: "admin-user",
        })
      ).rejects.toThrow("Team not found");
    });
  });

  describe("dbRemoveTeamMember", () => {
    it("should remove member when authorized", async () => {
      const mockTransaction = vi.fn().mockImplementation(async (fn) => {
        const tx = {
          team: {
            findUnique: vi.fn().mockResolvedValue({
              id: "team-123",
              companyId: "company-123",
              isPersonal: false,
            }),
          },
          teamMembership: {
            findUnique: vi
              .fn()
              .mockResolvedValueOnce({ id: "mem-1" }) // target member
              .mockResolvedValueOnce({ role: "ADMIN" }), // requester
            delete: vi.fn().mockResolvedValue({}),
          },
        };
        return fn(tx);
      });
      vi.mocked(prisma.$transaction).mockImplementation(mockTransaction);

      const result = await dbRemoveTeamMember({
        teamId: "team-123",
        userId: "target-user",
        requestedById: "admin-user",
      });

      expect(result).toEqual({ success: true });
    });

    it("should throw error when team not found", async () => {
      const mockTransaction = vi.fn().mockImplementation(async (fn) => {
        const tx = {
          team: {
            findUnique: vi.fn().mockResolvedValue(null),
          },
        };
        return fn(tx);
      });
      vi.mocked(prisma.$transaction).mockImplementation(mockTransaction);

      await expect(
        dbRemoveTeamMember({
          teamId: "nonexistent",
          userId: "target-user",
          requestedById: "admin-user",
        })
      ).rejects.toThrow("Team not found");
    });

    it("should throw error for personal teams", async () => {
      const mockTransaction = vi.fn().mockImplementation(async (fn) => {
        const tx = {
          team: {
            findUnique: vi.fn().mockResolvedValue({
              id: "team-123",
              companyId: null,
              isPersonal: true,
            }),
          },
        };
        return fn(tx);
      });
      vi.mocked(prisma.$transaction).mockImplementation(mockTransaction);

      await expect(
        dbRemoveTeamMember({
          teamId: "team-123",
          userId: "target-user",
          requestedById: "admin-user",
        })
      ).rejects.toThrow("Cannot remove members from personal teams");
    });

    it("should throw error when user not a member", async () => {
      const mockTransaction = vi.fn().mockImplementation(async (fn) => {
        const tx = {
          team: {
            findUnique: vi.fn().mockResolvedValue({
              id: "team-123",
              companyId: "company-123",
              isPersonal: false,
            }),
          },
          teamMembership: {
            findUnique: vi.fn().mockResolvedValue(null),
          },
        };
        return fn(tx);
      });
      vi.mocked(prisma.$transaction).mockImplementation(mockTransaction);

      await expect(
        dbRemoveTeamMember({
          teamId: "team-123",
          userId: "target-user",
          requestedById: "admin-user",
        })
      ).rejects.toThrow("User is not a member of this team");
    });
  });

  describe("dbUpdateTeamMemberRole", () => {
    it("should update role when authorized", async () => {
      const mockTransaction = vi.fn().mockImplementation(async (fn) => {
        const tx = {
          team: {
            findUnique: vi.fn().mockResolvedValue({
              id: "team-123",
              companyId: "company-123",
              isPersonal: false,
            }),
          },
          teamMembership: {
            findUnique: vi
              .fn()
              .mockResolvedValueOnce({ id: "mem-1", role: "MEMBER" }) // target
              .mockResolvedValueOnce({ role: "ADMIN" }), // requester
            update: vi.fn().mockResolvedValue({}),
          },
        };
        return fn(tx);
      });
      vi.mocked(prisma.$transaction).mockImplementation(mockTransaction);

      const result = await dbUpdateTeamMemberRole({
        teamId: "team-123",
        userId: "target-user",
        role: "ADMIN" as any,
        requestedById: "admin-user",
      });

      expect(result).toEqual({ success: true });
    });

    it("should throw error when changing own role", async () => {
      const mockTransaction = vi.fn().mockImplementation(async (fn) => {
        const tx = {
          team: {
            findUnique: vi.fn().mockResolvedValue({
              id: "team-123",
              companyId: "company-123",
              isPersonal: false,
            }),
          },
          teamMembership: {
            findUnique: vi.fn().mockResolvedValue({ id: "mem-1", role: "MEMBER" }),
          },
        };
        return fn(tx);
      });
      vi.mocked(prisma.$transaction).mockImplementation(mockTransaction);

      await expect(
        dbUpdateTeamMemberRole({
          teamId: "team-123",
          userId: "same-user",
          role: "ADMIN" as any,
          requestedById: "same-user",
        })
      ).rejects.toThrow("Cannot change your own role");
    });

    it("should throw error for personal teams", async () => {
      const mockTransaction = vi.fn().mockImplementation(async (fn) => {
        const tx = {
          team: {
            findUnique: vi.fn().mockResolvedValue({
              id: "team-123",
              companyId: null,
              isPersonal: true,
            }),
          },
        };
        return fn(tx);
      });
      vi.mocked(prisma.$transaction).mockImplementation(mockTransaction);

      await expect(
        dbUpdateTeamMemberRole({
          teamId: "team-123",
          userId: "target-user",
          role: "ADMIN" as any,
          requestedById: "admin-user",
        })
      ).rejects.toThrow("Cannot change member roles in personal teams");
    });
  });
});
