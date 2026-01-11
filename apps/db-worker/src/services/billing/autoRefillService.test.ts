import { describe, it, expect, vi, beforeEach } from "vitest";
import prisma from "@/apps/db-worker/src/services/db.ts";
import {
  dbGetTeamAutoRefillSettings,
  dbUpdateTeamAutoRefillSettings,
  dbUpdateTeamStripeCustomer,
  dbUpdateTeamPaymentMethod,
  dbRemoveTeamPaymentMethod,
  dbGetTeamsNeedingAutoRefill,
} from "../index.ts";

describe("autoRefillService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockTeam = {
    id: "team-123",
    name: "Test Team",
    credits: 100,
    companyId: null,
    isPersonal: false,
    autoRefillEnabled: false,
    autoRefillThreshold: null,
    autoRefillAmount: null,
    stripeCustomerId: null,
    stripePaymentMethodId: null,
    paymentMethodLast4: null,
    paymentMethodBrand: null,
    autoRefillUpdatedAt: null,
    autoRefillUpdatedById: null,
    autoRefillUpdatedBy: null,
  };

  const mockTeamMembership = {
    role: "OWNER",
  };

  describe("dbGetTeamAutoRefillSettings", () => {
    it("should return team auto-refill settings for authorized user", async () => {
      vi.mocked(prisma.team.findUnique)
        .mockResolvedValueOnce({
          id: "team-123",
          companyId: null,
          isPersonal: false,
        } as any)
        .mockResolvedValueOnce(mockTeam as any);
      vi.mocked(prisma.teamMembership.findUnique).mockResolvedValue(
        mockTeamMembership as any
      );

      const result = await dbGetTeamAutoRefillSettings("team-123", "user-123");

      expect(prisma.team.findUnique).toHaveBeenCalledTimes(2);
      expect(prisma.teamMembership.findUnique).toHaveBeenCalledWith({
        where: { teamId_userId: { teamId: "team-123", userId: "user-123" } },
        select: { role: true },
      });
      expect(result).toEqual(mockTeam);
    });

    it("should throw 404 error for non-existent team", async () => {
      vi.mocked(prisma.team.findUnique).mockResolvedValue(null);

      await expect(
        dbGetTeamAutoRefillSettings("nonexistent", "user-123")
      ).rejects.toMatchObject({
        message: "Team not found",
        status: 404,
      });
    });

    it("should throw 403 error for unauthorized user", async () => {
      vi.mocked(prisma.team.findUnique).mockResolvedValue({
        id: "team-123",
        companyId: null,
        isPersonal: false,
      } as any);
      vi.mocked(prisma.teamMembership.findUnique).mockResolvedValue(null);

      await expect(
        dbGetTeamAutoRefillSettings("team-123", "unauthorized-user")
      ).rejects.toMatchObject({
        message: "Not authorized to view team auto-refill settings",
        status: 403,
      });
    });

    it("should allow company admin to view team settings", async () => {
      vi.mocked(prisma.team.findUnique)
        .mockResolvedValueOnce({
          id: "team-123",
          companyId: "company-123",
          isPersonal: false,
        } as any)
        .mockResolvedValueOnce(mockTeam as any);
      vi.mocked(prisma.teamMembership.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.companyMembership.findUnique).mockResolvedValue({
        role: "ADMIN",
        status: "ACTIVE",
        deactivatedAt: null,
      } as any);

      const result = await dbGetTeamAutoRefillSettings(
        "team-123",
        "company-admin"
      );

      expect(prisma.companyMembership.findUnique).toHaveBeenCalledWith({
        where: {
          companyId_userId: {
            companyId: "company-123",
            userId: "company-admin",
          },
        },
        select: {
          role: true,
          status: true,
          deactivatedAt: true,
        },
      });
      expect(result).toEqual(mockTeam);
    });
  });

  describe("dbUpdateTeamAutoRefillSettings", () => {
    it("should enable auto-refill with valid settings", async () => {
      const teamWithPayment = {
        ...mockTeam,
        stripePaymentMethodId: "pm_123",
      };

      vi.mocked(prisma.team.findUnique)
        .mockResolvedValueOnce({
          id: "team-123",
          companyId: null,
          isPersonal: false,
        } as any)
        .mockResolvedValueOnce(teamWithPayment as any);
      vi.mocked(prisma.teamMembership.findUnique).mockResolvedValue(
        mockTeamMembership as any
      );
      vi.mocked(prisma.team.update).mockResolvedValue({
        id: "team-123",
        autoRefillEnabled: true,
        autoRefillThreshold: 10,
        autoRefillAmount: 50,
        autoRefillUpdatedAt: new Date(),
      } as any);

      const result = await dbUpdateTeamAutoRefillSettings({
        teamId: "team-123",
        userId: "user-123",
        autoRefillEnabled: true,
        autoRefillThreshold: 10,
        autoRefillAmount: 50,
      });

      expect(prisma.team.update).toHaveBeenCalledWith({
        where: { id: "team-123" },
        data: {
          autoRefillEnabled: true,
          autoRefillThreshold: 10,
          autoRefillAmount: 50,
          autoRefillUpdatedAt: expect.any(Date),
          autoRefillUpdatedById: "user-123",
        },
        select: {
          id: true,
          autoRefillEnabled: true,
          autoRefillThreshold: true,
          autoRefillAmount: true,
          autoRefillUpdatedAt: true,
        },
      });
      expect(result.autoRefillEnabled).toBe(true);
    });

    it("should disable auto-refill and clear threshold/amount", async () => {
      vi.mocked(prisma.team.findUnique).mockResolvedValue({
        id: "team-123",
        companyId: null,
        isPersonal: false,
      } as any);
      vi.mocked(prisma.teamMembership.findUnique).mockResolvedValue(
        mockTeamMembership as any
      );
      vi.mocked(prisma.team.update).mockResolvedValue({
        id: "team-123",
        autoRefillEnabled: false,
        autoRefillThreshold: null,
        autoRefillAmount: null,
        autoRefillUpdatedAt: new Date(),
      } as any);

      await dbUpdateTeamAutoRefillSettings({
        teamId: "team-123",
        userId: "user-123",
        autoRefillEnabled: false,
      });

      expect(prisma.team.update).toHaveBeenCalledWith({
        where: { id: "team-123" },
        data: {
          autoRefillEnabled: false,
          autoRefillThreshold: null,
          autoRefillAmount: null,
          autoRefillUpdatedAt: expect.any(Date),
          autoRefillUpdatedById: "user-123",
        },
        select: expect.any(Object),
      });
    });

    it("should throw 400 error when enabling without threshold", async () => {
      vi.mocked(prisma.team.findUnique).mockResolvedValue({
        id: "team-123",
        companyId: null,
        isPersonal: false,
      } as any);
      vi.mocked(prisma.teamMembership.findUnique).mockResolvedValue(
        mockTeamMembership as any
      );

      await expect(
        dbUpdateTeamAutoRefillSettings({
          teamId: "team-123",
          userId: "user-123",
          autoRefillEnabled: true,
          autoRefillThreshold: null,
          autoRefillAmount: 50,
        })
      ).rejects.toMatchObject({
        message: "Auto-refill threshold must be a positive number",
        status: 400,
      });
    });

    it("should throw 400 error when enabling without amount", async () => {
      vi.mocked(prisma.team.findUnique).mockResolvedValue({
        id: "team-123",
        companyId: null,
        isPersonal: false,
      } as any);
      vi.mocked(prisma.teamMembership.findUnique).mockResolvedValue(
        mockTeamMembership as any
      );

      await expect(
        dbUpdateTeamAutoRefillSettings({
          teamId: "team-123",
          userId: "user-123",
          autoRefillEnabled: true,
          autoRefillThreshold: 10,
          autoRefillAmount: 0,
        })
      ).rejects.toMatchObject({
        message: "Auto-refill amount must be at least 1 credit",
        status: 400,
      });
    });

    it("should throw 400 error when enabling without payment method", async () => {
      vi.mocked(prisma.team.findUnique)
        .mockResolvedValueOnce({
          id: "team-123",
          companyId: null,
          isPersonal: false,
        } as any)
        .mockResolvedValueOnce({
          stripePaymentMethodId: null,
        } as any);
      vi.mocked(prisma.teamMembership.findUnique).mockResolvedValue(
        mockTeamMembership as any
      );

      await expect(
        dbUpdateTeamAutoRefillSettings({
          teamId: "team-123",
          userId: "user-123",
          autoRefillEnabled: true,
          autoRefillThreshold: 10,
          autoRefillAmount: 50,
        })
      ).rejects.toMatchObject({
        message: "A payment method must be saved before enabling auto-refill",
        status: 400,
      });
    });

    it("should throw 403 error for unauthorized user", async () => {
      vi.mocked(prisma.team.findUnique).mockResolvedValue({
        id: "team-123",
        companyId: null,
        isPersonal: false,
      } as any);
      vi.mocked(prisma.teamMembership.findUnique).mockResolvedValue({
        role: "MEMBER",
      } as any);

      await expect(
        dbUpdateTeamAutoRefillSettings({
          teamId: "team-123",
          userId: "member-user",
          autoRefillEnabled: true,
          autoRefillThreshold: 10,
          autoRefillAmount: 50,
        })
      ).rejects.toMatchObject({
        message: "Not authorized to update team auto-refill settings",
        status: 403,
      });
    });
  });

  describe("dbUpdateTeamStripeCustomer", () => {
    it("should update stripe customer ID", async () => {
      vi.mocked(prisma.team.findUnique).mockResolvedValue({
        id: "team-123",
        companyId: null,
        isPersonal: false,
      } as any);
      vi.mocked(prisma.teamMembership.findUnique).mockResolvedValue(
        mockTeamMembership as any
      );
      vi.mocked(prisma.team.update).mockResolvedValue({
        id: "team-123",
        stripeCustomerId: "cus_123",
      } as any);

      const result = await dbUpdateTeamStripeCustomer({
        teamId: "team-123",
        userId: "user-123",
        stripeCustomerId: "cus_123",
      });

      expect(prisma.team.update).toHaveBeenCalledWith({
        where: { id: "team-123" },
        data: {
          stripeCustomerId: "cus_123",
          autoRefillUpdatedAt: expect.any(Date),
          autoRefillUpdatedById: "user-123",
        },
        select: {
          id: true,
          stripeCustomerId: true,
        },
      });
      expect(result.stripeCustomerId).toBe("cus_123");
    });

    it("should throw 404 error for non-existent team", async () => {
      vi.mocked(prisma.team.findUnique).mockResolvedValue(null);

      await expect(
        dbUpdateTeamStripeCustomer({
          teamId: "nonexistent",
          userId: "user-123",
          stripeCustomerId: "cus_123",
        })
      ).rejects.toMatchObject({
        message: "Team not found",
        status: 404,
      });
    });

    it("should throw 403 error for unauthorized user", async () => {
      vi.mocked(prisma.team.findUnique).mockResolvedValue({
        id: "team-123",
        companyId: null,
        isPersonal: false,
      } as any);
      vi.mocked(prisma.teamMembership.findUnique).mockResolvedValue({
        role: "MEMBER",
      } as any);

      await expect(
        dbUpdateTeamStripeCustomer({
          teamId: "team-123",
          userId: "member-user",
          stripeCustomerId: "cus_123",
        })
      ).rejects.toMatchObject({
        message: "Not authorized to update team payment settings",
        status: 403,
      });
    });
  });

  describe("dbUpdateTeamPaymentMethod", () => {
    it("should update payment method details", async () => {
      vi.mocked(prisma.team.findUnique).mockResolvedValue({
        id: "team-123",
        companyId: null,
        isPersonal: false,
      } as any);
      vi.mocked(prisma.teamMembership.findUnique).mockResolvedValue(
        mockTeamMembership as any
      );
      vi.mocked(prisma.team.update).mockResolvedValue({
        id: "team-123",
        stripePaymentMethodId: "pm_123",
        paymentMethodLast4: "4242",
        paymentMethodBrand: "visa",
      } as any);

      const result = await dbUpdateTeamPaymentMethod({
        teamId: "team-123",
        userId: "user-123",
        stripePaymentMethodId: "pm_123",
        paymentMethodLast4: "4242",
        paymentMethodBrand: "visa",
      });

      expect(prisma.team.update).toHaveBeenCalledWith({
        where: { id: "team-123" },
        data: {
          stripePaymentMethodId: "pm_123",
          paymentMethodLast4: "4242",
          paymentMethodBrand: "visa",
          autoRefillUpdatedAt: expect.any(Date),
          autoRefillUpdatedById: "user-123",
        },
        select: {
          id: true,
          stripePaymentMethodId: true,
          paymentMethodLast4: true,
          paymentMethodBrand: true,
        },
      });
      expect(result.paymentMethodLast4).toBe("4242");
    });

    it("should throw 403 error for unauthorized user", async () => {
      vi.mocked(prisma.team.findUnique).mockResolvedValue({
        id: "team-123",
        companyId: null,
        isPersonal: false,
      } as any);
      vi.mocked(prisma.teamMembership.findUnique).mockResolvedValue(null);

      await expect(
        dbUpdateTeamPaymentMethod({
          teamId: "team-123",
          userId: "unauthorized-user",
          stripePaymentMethodId: "pm_123",
          paymentMethodLast4: "4242",
          paymentMethodBrand: "visa",
        })
      ).rejects.toMatchObject({
        message: "Not authorized to update team payment settings",
        status: 403,
      });
    });
  });

  describe("dbRemoveTeamPaymentMethod", () => {
    it("should remove payment method and disable auto-refill", async () => {
      vi.mocked(prisma.team.findUnique).mockResolvedValue({
        id: "team-123",
        companyId: null,
        isPersonal: false,
      } as any);
      vi.mocked(prisma.teamMembership.findUnique).mockResolvedValue(
        mockTeamMembership as any
      );
      vi.mocked(prisma.team.update).mockResolvedValue({
        id: "team-123",
        autoRefillEnabled: false,
      } as any);

      const result = await dbRemoveTeamPaymentMethod({
        teamId: "team-123",
        userId: "user-123",
      });

      expect(prisma.team.update).toHaveBeenCalledWith({
        where: { id: "team-123" },
        data: {
          stripePaymentMethodId: null,
          paymentMethodLast4: null,
          paymentMethodBrand: null,
          autoRefillEnabled: false,
          autoRefillUpdatedAt: expect.any(Date),
          autoRefillUpdatedById: "user-123",
        },
        select: {
          id: true,
          autoRefillEnabled: true,
        },
      });
      expect(result.autoRefillEnabled).toBe(false);
    });

    it("should throw 403 error for unauthorized user", async () => {
      vi.mocked(prisma.team.findUnique).mockResolvedValue({
        id: "team-123",
        companyId: null,
        isPersonal: false,
      } as any);
      vi.mocked(prisma.teamMembership.findUnique).mockResolvedValue({
        role: "MEMBER",
      } as any);

      await expect(
        dbRemoveTeamPaymentMethod({
          teamId: "team-123",
          userId: "member-user",
        })
      ).rejects.toMatchObject({
        message: "Not authorized to remove team payment method",
        status: 403,
      });
    });
  });

  describe("dbGetTeamsNeedingAutoRefill", () => {
    it("should return team when credits are at or below threshold", async () => {
      const teamNeedingRefill = {
        id: "team-123",
        name: "Test Team",
        credits: 5,
        autoRefillEnabled: true,
        autoRefillThreshold: 10,
        autoRefillAmount: 50,
        stripeCustomerId: "cus_123",
        stripePaymentMethodId: "pm_123",
        companyId: null,
        isPersonal: false,
      };

      vi.mocked(prisma.team.findUnique).mockResolvedValue(
        teamNeedingRefill as any
      );

      const result = await dbGetTeamsNeedingAutoRefill("team-123");

      expect(result).toEqual(teamNeedingRefill);
    });

    it("should return null when credits are above threshold", async () => {
      const teamAboveThreshold = {
        id: "team-123",
        credits: 50,
        autoRefillEnabled: true,
        autoRefillThreshold: 10,
        autoRefillAmount: 50,
        stripeCustomerId: "cus_123",
        stripePaymentMethodId: "pm_123",
      };

      vi.mocked(prisma.team.findUnique).mockResolvedValue(
        teamAboveThreshold as any
      );

      const result = await dbGetTeamsNeedingAutoRefill("team-123");

      expect(result).toBeNull();
    });

    it("should return null when auto-refill is disabled", async () => {
      const teamDisabled = {
        id: "team-123",
        credits: 5,
        autoRefillEnabled: false,
        autoRefillThreshold: 10,
        autoRefillAmount: 50,
        stripeCustomerId: "cus_123",
        stripePaymentMethodId: "pm_123",
      };

      vi.mocked(prisma.team.findUnique).mockResolvedValue(teamDisabled as any);

      const result = await dbGetTeamsNeedingAutoRefill("team-123");

      expect(result).toBeNull();
    });

    it("should return null when no payment method is saved", async () => {
      const teamNoPayment = {
        id: "team-123",
        credits: 5,
        autoRefillEnabled: true,
        autoRefillThreshold: 10,
        autoRefillAmount: 50,
        stripeCustomerId: "cus_123",
        stripePaymentMethodId: null,
      };

      vi.mocked(prisma.team.findUnique).mockResolvedValue(teamNoPayment as any);

      const result = await dbGetTeamsNeedingAutoRefill("team-123");

      expect(result).toBeNull();
    });

    it("should return null for non-existent team", async () => {
      vi.mocked(prisma.team.findUnique).mockResolvedValue(null);

      const result = await dbGetTeamsNeedingAutoRefill("nonexistent");

      expect(result).toBeNull();
    });

    it("should return team when credits exactly equal threshold", async () => {
      const teamAtThreshold = {
        id: "team-123",
        name: "Test Team",
        credits: 10,
        autoRefillEnabled: true,
        autoRefillThreshold: 10,
        autoRefillAmount: 50,
        stripeCustomerId: "cus_123",
        stripePaymentMethodId: "pm_123",
        companyId: null,
        isPersonal: false,
      };

      vi.mocked(prisma.team.findUnique).mockResolvedValue(
        teamAtThreshold as any
      );

      const result = await dbGetTeamsNeedingAutoRefill("team-123");

      expect(result).toEqual(teamAtThreshold);
    });
  });
});
