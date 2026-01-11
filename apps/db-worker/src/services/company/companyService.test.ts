import { describe, it, expect, vi, beforeEach } from "vitest";
import prisma from "@/apps/db-worker/src/services/db.ts";
import {
  dbGetCompanyMembership,
  dbGetCompanyByDomain,
  dbUpdateCompanyName,
  dbUpdateCompanyLogo,
  dbListCompanyMembers,
} from "../index.ts";

// Mock S3 service
vi.mock("../../storage/s3Service.ts", () => ({
  deleteS3Objects: vi.fn().mockResolvedValue({ deleted: [], errors: [] }),
}));

// Mock team service
vi.mock("../../team/teamService.ts", () => ({
  addUsersToAutoJoinTeams: vi.fn().mockResolvedValue(undefined),
}));

describe("companyService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("dbGetCompanyMembership", () => {
    it("should return membership when found", async () => {
      const mockMembership = {
        id: "mem-123",
        role: "ADMIN",
        status: "ACTIVE",
        joinedAt: new Date(),
      };

      vi.mocked(prisma.companyMembership.findFirst).mockResolvedValue(
        mockMembership as any
      );

      const result = await dbGetCompanyMembership("company-123", "user-123");

      expect(prisma.companyMembership.findFirst).toHaveBeenCalledWith({
        where: {
          companyId: "company-123",
          userId: "user-123",
          status: "ACTIVE",
        },
        select: {
          id: true,
          role: true,
          status: true,
          joinedAt: true,
        },
      });
      expect(result).toEqual(mockMembership);
    });

    it("should return null when membership not found", async () => {
      vi.mocked(prisma.companyMembership.findFirst).mockResolvedValue(null);

      const result = await dbGetCompanyMembership("company-123", "user-123");

      expect(result).toBeNull();
    });
  });

  describe("dbGetCompanyByDomain", () => {
    it("should return company info when domain exists", async () => {
      vi.mocked(prisma.companyDomain.findUnique).mockResolvedValue({
        id: "domain-123",
        domain: "example.com",
        companyId: "company-123",
        status: "ACTIVE",
        requestedByUserId: "user-123",
      } as any);
      vi.mocked(prisma.company.findUnique).mockResolvedValue({
        id: "company-123",
        name: "Example Co",
        status: "ACTIVE",
        logoKey: null,
        logoUpdatedAt: null,
        autoEnroll: false,
        disablePersonalTeams: false,
      } as any);

      const result = await dbGetCompanyByDomain("example.com");

      expect(result).toMatchObject({
        domain: "example.com",
        companyId: "company-123",
        company: expect.objectContaining({
          id: "company-123",
          name: "Example Co",
        }),
      });
    });

    it("should return null when domain not found", async () => {
      vi.mocked(prisma.companyDomain.findUnique).mockResolvedValue(null);

      const result = await dbGetCompanyByDomain("nonexistent.com");

      expect(result).toBeNull();
    });
  });

  describe("dbUpdateCompanyName", () => {
    it("should update name when user is owner", async () => {
      vi.mocked(prisma.companyMembership.findUnique).mockResolvedValue({
        role: "OWNER",
        status: "ACTIVE",
        deactivatedAt: null,
        user: { status: "ACTIVE" },
      } as any);
      vi.mocked(prisma.company.update).mockResolvedValue({
        id: "company-123",
        name: "New Name",
        updatedAt: new Date(),
      } as any);

      const result = await dbUpdateCompanyName({
        companyId: "company-123",
        userId: "user-123",
        name: "New Name",
      });

      expect(prisma.company.update).toHaveBeenCalledWith({
        where: { id: "company-123" },
        data: { name: "New Name" },
        select: { id: true, name: true, updatedAt: true },
      });
      expect(result.name).toBe("New Name");
    });

    it("should throw error when user is not owner", async () => {
      vi.mocked(prisma.companyMembership.findUnique).mockResolvedValue({
        role: "ADMIN",
        status: "ACTIVE",
        deactivatedAt: null,
        user: { status: "ACTIVE" },
      } as any);

      await expect(
        dbUpdateCompanyName({
          companyId: "company-123",
          userId: "user-123",
          name: "New Name",
        })
      ).rejects.toThrow("Only owners can update company name");
    });
  });

  describe("dbUpdateCompanyLogo", () => {
    it("should update logo when user is owner", async () => {
      vi.mocked(prisma.companyMembership.findUnique).mockResolvedValue({
        role: "OWNER",
        status: "ACTIVE",
        deactivatedAt: null,
        user: { status: "ACTIVE" },
      } as any);
      vi.mocked(prisma.company.update).mockResolvedValue({
        id: "company-123",
      } as any);

      const result = await dbUpdateCompanyLogo({
        companyId: "company-123",
        userId: "user-123",
        logoKey: "uploads/logo.png",
      });

      expect(prisma.company.update).toHaveBeenCalledWith({
        where: { id: "company-123" },
        data: {
          logoKey: "uploads/logo.png",
          logoUpdatedAt: expect.any(Date),
        },
        select: { id: true },
      });
      expect(result.id).toBe("company-123");
    });

    it("should throw error when user is not owner", async () => {
      vi.mocked(prisma.companyMembership.findUnique).mockResolvedValue({
        role: "MEMBER",
        status: "ACTIVE",
        deactivatedAt: null,
        user: { status: "ACTIVE" },
      } as any);

      await expect(
        dbUpdateCompanyLogo({
          companyId: "company-123",
          userId: "user-123",
          logoKey: "uploads/logo.png",
        })
      ).rejects.toThrow("Only owners can update company image");
    });
  });

  describe("dbListCompanyMembers", () => {
    it("should return formatted list of company members", async () => {
      const mockMembers = [
        {
          id: "mem-1",
          role: "OWNER",
          status: "ACTIVE",
          user: {
            id: "user-1",
            name: "John Doe",
            email: "john@example.com",
            sessions: [{ updatedAt: new Date() }],
          },
        },
      ];

      vi.mocked(prisma.companyMembership.findMany).mockResolvedValue(
        mockMembers as any
      );

      const result = await dbListCompanyMembers("company-123");

      expect(prisma.companyMembership.findMany).toHaveBeenCalledWith({
        where: {
          companyId: "company-123",
          status: "ACTIVE",
          deactivatedAt: null,
          user: { status: "ACTIVE" },
        },
        include: expect.any(Object),
        orderBy: { joinedAt: "asc" },
      });
      expect(result).toHaveLength(1);
      expect(result[0].user.lastAccessedAt).toBeDefined();
    });

    it("should return empty array when no members", async () => {
      vi.mocked(prisma.companyMembership.findMany).mockResolvedValue([]);

      const result = await dbListCompanyMembers("company-123");

      expect(result).toHaveLength(0);
    });
  });
});
