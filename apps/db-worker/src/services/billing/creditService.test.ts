import { describe, it, expect, vi, beforeEach } from "vitest";
import prisma from "@/apps/db-worker/src/services/db.ts";
import {
  dbAdjustTeamCredits,
  dbConsumeCreditForStudy,
  dbRefundCreditForStudy,
  dbGetCreditLedger,
} from "../index.ts";

// Mock notification service
vi.mock("../../user/notificationService.ts", () => ({
  dbCreateNotification: vi.fn().mockResolvedValue({}),
}));

describe("creditService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("dbAdjustTeamCredits", () => {
    it("should adjust credits and create ledger entry", async () => {
      vi.mocked(prisma.creditLedger.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.team.findUnique).mockResolvedValue({
        credits: 100,
        name: "Test Team",
        autoRefillThreshold: 10,
        memberships: [],
      } as any);

      const mockTransaction = vi.fn().mockImplementation(async (fn) => {
        const tx = {
          team: {
            update: vi.fn().mockResolvedValue({ id: "team-123", credits: 110 }),
          },
          creditLedger: {
            create: vi.fn().mockResolvedValue({}),
          },
        };
        return fn(tx);
      });
      vi.mocked(prisma.$transaction).mockImplementation(mockTransaction);

      const result = await dbAdjustTeamCredits({
        teamId: "team-123",
        delta: 10,
        byUserId: "user-123",
        reason: "test adjustment",
      });

      expect(result).toEqual({ id: "team-123", credits: 110 });
      expect(mockTransaction).toHaveBeenCalled();
    });

    it("should be idempotent for Stripe purchases", async () => {
      vi.mocked(prisma.creditLedger.findFirst).mockResolvedValue({
        id: "ledger-existing",
        teamId: "team-123",
        reason: "stripe_purchase:pi_123",
      } as any);
      vi.mocked(prisma.team.findUnique).mockResolvedValue({
        id: "team-123",
        credits: 100,
      } as any);

      const result = await dbAdjustTeamCredits({
        teamId: "team-123",
        delta: 50,
        reason: "stripe_purchase:pi_123",
      });

      expect(result).toEqual({ id: "team-123", credits: 100 });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("should throw error on database failure", async () => {
      vi.mocked(prisma.creditLedger.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.team.findUnique).mockResolvedValue({
        credits: 100,
        name: "Test Team",
        autoRefillThreshold: 10,
        memberships: [],
      } as any);
      vi.mocked(prisma.$transaction).mockRejectedValue(
        new Error("Database error")
      );

      await expect(
        dbAdjustTeamCredits({
          teamId: "team-123",
          delta: 10,
        })
      ).rejects.toThrow("Database error");
    });
  });

  describe("dbConsumeCreditForStudy", () => {
    it("should consume 1 credit for a study", async () => {
      vi.mocked(prisma.study.findUnique).mockResolvedValue({
        id: "study-123",
        teamId: "team-123",
      } as any);
      vi.mocked(prisma.creditLedger.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.team.findUnique).mockResolvedValue({
        credits: 50,
        name: "Test Team",
        autoRefillThreshold: 10,
        memberships: [],
      } as any);

      const mockTransaction = vi.fn().mockImplementation(async (fn) => {
        const tx = {
          team: {
            update: vi.fn().mockResolvedValue({ id: "team-123", credits: 49 }),
          },
          creditLedger: {
            create: vi.fn().mockResolvedValue({}),
          },
        };
        return fn(tx);
      });
      vi.mocked(prisma.$transaction).mockImplementation(mockTransaction);

      const result = await dbConsumeCreditForStudy("study-123", "user-123");

      expect(result.credits).toBe(49);
      expect(result.teamId).toBe("team-123");
    });

    it("should throw error when study not found", async () => {
      vi.mocked(prisma.study.findUnique).mockResolvedValue(null);

      await expect(
        dbConsumeCreditForStudy("nonexistent", "user-123")
      ).rejects.toThrow("Study not found");
    });
  });

  describe("dbRefundCreditForStudy", () => {
    it("should refund 1 credit for a study", async () => {
      vi.mocked(prisma.study.findUnique).mockResolvedValue({
        id: "study-123",
        teamId: "team-123",
      } as any);
      vi.mocked(prisma.creditLedger.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.team.findUnique).mockResolvedValue({
        credits: 49,
        name: "Test Team",
        autoRefillThreshold: 10,
        memberships: [],
      } as any);

      const mockTransaction = vi.fn().mockImplementation(async (fn) => {
        const tx = {
          team: {
            update: vi.fn().mockResolvedValue({ id: "team-123", credits: 50 }),
          },
          creditLedger: {
            create: vi.fn().mockResolvedValue({}),
          },
        };
        return fn(tx);
      });
      vi.mocked(prisma.$transaction).mockImplementation(mockTransaction);

      const result = await dbRefundCreditForStudy("study-123", "user-123");

      expect(result).toEqual({ id: "team-123", credits: 50 });
    });

    it("should throw error when study not found", async () => {
      vi.mocked(prisma.study.findUnique).mockResolvedValue(null);

      await expect(
        dbRefundCreditForStudy("nonexistent", "user-123")
      ).rejects.toThrow("Study not found");
    });
  });

  describe("dbGetCreditLedger", () => {
    const baseParams = {
      userId: "user-123",
      isCompanyAdmin: false,
      teamIds: ["team-123"],
      page: 1,
      pageSize: 20,
      sortBy: "createdAt" as const,
      sortOrder: "desc" as const,
    };

    it("should return paginated ledger entries for team admin", async () => {
      const mockEntries = [
        {
          id: "ledger-1",
          teamId: "team-123",
          delta: -1,
          reason: "consume_study",
          createdAt: new Date(),
          team: { id: "team-123", name: "Test Team", isPersonal: false },
          study: { id: "study-1", name: "Study 1", type: "HEURISTIC_EVALUATION" },
          byUser: { id: "user-123", name: "Test User", email: "test@example.com" },
        },
      ];

      vi.mocked(prisma.creditLedger.count).mockResolvedValue(1);
      vi.mocked(prisma.creditLedger.findMany).mockResolvedValue(
        mockEntries as any
      );

      const result = await dbGetCreditLedger(baseParams);

      expect(prisma.creditLedger.findMany).toHaveBeenCalledWith({
        where: { teamId: { in: ["team-123"] } },
        include: expect.any(Object),
        orderBy: { createdAt: "desc" },
        skip: 0,
        take: 20,
      });
      expect(result.entries).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(1);
    });

    it("should return entries for company admin across all company teams", async () => {
      vi.mocked(prisma.creditLedger.count).mockResolvedValue(10);
      vi.mocked(prisma.creditLedger.findMany).mockResolvedValue([]);

      await dbGetCreditLedger({
        ...baseParams,
        isCompanyAdmin: true,
        companyId: "company-123",
      });

      expect(prisma.creditLedger.findMany).toHaveBeenCalledWith({
        where: { team: { companyId: "company-123" } },
        include: expect.any(Object),
        orderBy: { createdAt: "desc" },
        skip: 0,
        take: 20,
      });
    });

    it("should return empty when user has no team access", async () => {
      const result = await dbGetCreditLedger({
        ...baseParams,
        teamIds: [],
        isCompanyAdmin: false,
      });

      expect(result.entries).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(prisma.creditLedger.findMany).not.toHaveBeenCalled();
    });

    it("should support sorting by delta", async () => {
      vi.mocked(prisma.creditLedger.count).mockResolvedValue(0);
      vi.mocked(prisma.creditLedger.findMany).mockResolvedValue([]);

      await dbGetCreditLedger({
        ...baseParams,
        sortBy: "delta",
        sortOrder: "asc",
      });

      expect(prisma.creditLedger.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { delta: "asc" },
        })
      );
    });

    it("should support sorting by teamName", async () => {
      vi.mocked(prisma.creditLedger.count).mockResolvedValue(0);
      vi.mocked(prisma.creditLedger.findMany).mockResolvedValue([]);

      await dbGetCreditLedger({
        ...baseParams,
        sortBy: "teamName",
        sortOrder: "asc",
      });

      expect(prisma.creditLedger.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { team: { name: "asc" } },
        })
      );
    });

    it("should handle pagination correctly", async () => {
      vi.mocked(prisma.creditLedger.count).mockResolvedValue(100);
      vi.mocked(prisma.creditLedger.findMany).mockResolvedValue([]);

      const result = await dbGetCreditLedger({
        ...baseParams,
        page: 3,
        pageSize: 10,
      });

      expect(prisma.creditLedger.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20,
          take: 10,
        })
      );
      expect(result.totalPages).toBe(10);
    });
  });
});
