import { describe, it, expect, vi, beforeEach } from "vitest";
import prisma from "@/apps/db-worker/src/services/db.ts";
import {
  dbAdjustTeamBalance,
  dbConsumeBalanceForStudy,
  dbRefundBalanceForStudy,
  dbGetBalanceLedger,
} from "../index.ts";

// Mock notification service
vi.mock("../../user/notificationService.ts", () => ({
  dbCreateNotification: vi.fn().mockResolvedValue({}),
}));

describe("balanceService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("dbAdjustTeamBalance", () => {
    it("should adjust balance and create ledger entry", async () => {
      vi.mocked(prisma.balanceLedger.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.team.findUnique).mockResolvedValue({
        balanceCents: 10000,
        companyId: null,
        name: "Test Team",
        autoRefillThreshold: 1000,
        memberships: [],
      } as any);

      const mockTransaction = vi.fn().mockImplementation(async (fn) => {
        const tx = {
          team: {
            update: vi
              .fn()
              .mockResolvedValue({ id: "team-123", balanceCents: 11000 }),
          },
          balanceLedger: {
            create: vi.fn().mockResolvedValue({}),
          },
        };
        return fn(tx);
      });
      vi.mocked(prisma.$transaction).mockImplementation(mockTransaction);

      const result = await dbAdjustTeamBalance({
        teamId: "team-123",
        amountCents: 1000,
        byUserId: "user-123",
        reason: "test adjustment",
      });

      expect(result).toEqual({ id: "team-123", balanceCents: 11000 });
      expect(mockTransaction).toHaveBeenCalled();
    });

    it("should be idempotent for Stripe purchases", async () => {
      vi.mocked(prisma.balanceLedger.findFirst).mockResolvedValue({
        id: "ledger-existing",
        teamId: "team-123",
        reason: "stripe_purchase:pi_123",
      } as any);
      vi.mocked(prisma.team.findUnique).mockResolvedValue({
        id: "team-123",
        balanceCents: 10000,
      } as any);

      const result = await dbAdjustTeamBalance({
        teamId: "team-123",
        amountCents: 5000,
        reason: "stripe_purchase:pi_123",
      });

      expect(result).toEqual({ id: "team-123", balanceCents: 10000 });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("should throw error on database failure", async () => {
      vi.mocked(prisma.balanceLedger.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.team.findUnique).mockResolvedValue({
        balanceCents: 10000,
        companyId: null,
        name: "Test Team",
        autoRefillThreshold: 1000,
        memberships: [],
      } as any);
      vi.mocked(prisma.$transaction).mockRejectedValue(
        new Error("Database error")
      );

      await expect(
        dbAdjustTeamBalance({
          teamId: "team-123",
          amountCents: 1000,
        })
      ).rejects.toThrow("Database error");
    });
  });

  describe("dbConsumeBalanceForStudy", () => {
    it("should consume evaluation study cost from balance", async () => {
      vi.mocked(prisma.study.findUnique).mockResolvedValue({
        id: "study-123",
        teamId: "team-123",
        type: "HEURISTIC_EVALUATION",
        team: { companyId: null },
      } as any);
      vi.mocked(prisma.balanceLedger.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.team.findUnique).mockResolvedValue({
        balanceCents: 5000,
        companyId: null,
        name: "Test Team",
        autoRefillThreshold: 1000,
        memberships: [],
      } as any);

      const mockTransaction = vi.fn().mockImplementation(async (fn) => {
        const tx = {
          team: {
            update: vi
              .fn()
              .mockResolvedValue({ id: "team-123", balanceCents: 4501 }),
          },
          balanceLedger: {
            create: vi.fn().mockResolvedValue({}),
          },
        };
        return fn(tx);
      });
      vi.mocked(prisma.$transaction).mockImplementation(mockTransaction);

      const result = await dbConsumeBalanceForStudy("study-123", "user-123");

      expect(result.balanceCents).toBe(4501);
      expect(result.teamId).toBe("team-123");
    });

    it("should consume persona study cost from balance (lower cost)", async () => {
      vi.mocked(prisma.study.findUnique).mockResolvedValue({
        id: "study-456",
        teamId: "team-123",
        type: "PERSONA",
        team: { companyId: null },
      } as any);
      vi.mocked(prisma.balanceLedger.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.team.findUnique).mockResolvedValue({
        balanceCents: 5000,
        companyId: null,
        name: "Test Team",
        autoRefillThreshold: 1000,
        memberships: [],
      } as any);

      const mockTransaction = vi.fn().mockImplementation(async (fn) => {
        const tx = {
          team: {
            update: vi
              .fn()
              .mockResolvedValue({ id: "team-123", balanceCents: 4751 }),
          },
          balanceLedger: {
            create: vi.fn().mockResolvedValue({}),
          },
        };
        return fn(tx);
      });
      vi.mocked(prisma.$transaction).mockImplementation(mockTransaction);

      const result = await dbConsumeBalanceForStudy("study-456", "user-123");

      // Persona cost should be 249 cents ($2.49), not 499 cents ($4.99)
      expect(result.balanceCents).toBe(4751);
      expect(result.teamId).toBe("team-123");
    });

    it("should throw error when study not found", async () => {
      vi.mocked(prisma.study.findUnique).mockResolvedValue(null);

      await expect(
        dbConsumeBalanceForStudy("nonexistent", "user-123")
      ).rejects.toThrow("Study not found");
    });
  });

  describe("dbRefundBalanceForStudy", () => {
    it("should refund study cost to balance", async () => {
      vi.mocked(prisma.study.findUnique).mockResolvedValue({
        id: "study-123",
        teamId: "team-123",
        type: "HEURISTIC_EVALUATION",
        team: { companyId: null },
      } as any);
      vi.mocked(prisma.balanceLedger.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.team.findUnique).mockResolvedValue({
        balanceCents: 4501,
        companyId: null,
        name: "Test Team",
        autoRefillThreshold: 1000,
        memberships: [],
      } as any);

      const mockTransaction = vi.fn().mockImplementation(async (fn) => {
        const tx = {
          team: {
            update: vi
              .fn()
              .mockResolvedValue({ id: "team-123", balanceCents: 5000 }),
          },
          balanceLedger: {
            create: vi.fn().mockResolvedValue({}),
          },
        };
        return fn(tx);
      });
      vi.mocked(prisma.$transaction).mockImplementation(mockTransaction);

      const result = await dbRefundBalanceForStudy("study-123", "user-123");

      expect(result).toEqual({ id: "team-123", balanceCents: 5000 });
    });

    it("should throw error when study not found", async () => {
      vi.mocked(prisma.study.findUnique).mockResolvedValue(null);

      await expect(
        dbRefundBalanceForStudy("nonexistent", "user-123")
      ).rejects.toThrow("Study not found");
    });
  });

  describe("dbGetBalanceLedger", () => {
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
          amountCents: -499,
          reason: "consume_study",
          createdAt: new Date(),
          team: { id: "team-123", name: "Test Team", isPersonal: false },
          study: {
            id: "study-1",
            name: "Study 1",
            type: "HEURISTIC_EVALUATION",
          },
          byUser: {
            id: "user-123",
            name: "Test User",
            email: "test@example.com",
          },
        },
      ];

      vi.mocked(prisma.balanceLedger.count).mockResolvedValue(1);
      vi.mocked(prisma.balanceLedger.findMany).mockResolvedValue(
        mockEntries as any
      );

      const result = await dbGetBalanceLedger(baseParams);

      expect(prisma.balanceLedger.findMany).toHaveBeenCalledWith({
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
      vi.mocked(prisma.balanceLedger.count).mockResolvedValue(10);
      vi.mocked(prisma.balanceLedger.findMany).mockResolvedValue([]);

      await dbGetBalanceLedger({
        ...baseParams,
        isCompanyAdmin: true,
        companyId: "company-123",
      });

      expect(prisma.balanceLedger.findMany).toHaveBeenCalledWith({
        where: { team: { companyId: "company-123" } },
        include: expect.any(Object),
        orderBy: { createdAt: "desc" },
        skip: 0,
        take: 20,
      });
    });

    it("should return empty when user has no team access", async () => {
      const result = await dbGetBalanceLedger({
        ...baseParams,
        teamIds: [],
        isCompanyAdmin: false,
      });

      expect(result.entries).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(prisma.balanceLedger.findMany).not.toHaveBeenCalled();
    });

    it("should support sorting by amountCents", async () => {
      vi.mocked(prisma.balanceLedger.count).mockResolvedValue(0);
      vi.mocked(prisma.balanceLedger.findMany).mockResolvedValue([]);

      await dbGetBalanceLedger({
        ...baseParams,
        sortBy: "amountCents",
        sortOrder: "asc",
      });

      expect(prisma.balanceLedger.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { amountCents: "asc" },
        })
      );
    });

    it("should support sorting by teamName", async () => {
      vi.mocked(prisma.balanceLedger.count).mockResolvedValue(0);
      vi.mocked(prisma.balanceLedger.findMany).mockResolvedValue([]);

      await dbGetBalanceLedger({
        ...baseParams,
        sortBy: "teamName",
        sortOrder: "asc",
      });

      expect(prisma.balanceLedger.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { team: { name: "asc" } },
        })
      );
    });

    it("should handle pagination correctly", async () => {
      vi.mocked(prisma.balanceLedger.count).mockResolvedValue(100);
      vi.mocked(prisma.balanceLedger.findMany).mockResolvedValue([]);

      const result = await dbGetBalanceLedger({
        ...baseParams,
        page: 3,
        pageSize: 10,
      });

      expect(prisma.balanceLedger.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20,
          take: 10,
        })
      );
      expect(result.totalPages).toBe(10);
    });
  });
});
