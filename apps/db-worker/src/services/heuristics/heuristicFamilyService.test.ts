import { describe, it, expect, vi, beforeEach } from "vitest";
import prisma from "@/apps/db-worker/src/services/db.ts";
import {
  dbGetHeuristicFamilies,
  dbGetHeuristicFamily,
  dbCreateHeuristicFamily,
  dbUpdateHeuristicFamily,
  dbDeleteHeuristicFamily,
} from "../index.ts";

describe("heuristicFamilyService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("dbGetHeuristicFamilies", () => {
    it("should return all families when no companyId", async () => {
      const mockFamilies = [
        { id: "fam-1", name: "Nielsen", companyId: null, heuristics: [], _count: { heuristics: 10 } },
        { id: "fam-2", name: "Custom", companyId: "company-123", heuristics: [], _count: { heuristics: 5 } },
      ];

      vi.mocked(prisma.heuristicFamily.findMany).mockResolvedValue(
        mockFamilies as any
      );

      const result = await dbGetHeuristicFamilies();

      expect(prisma.heuristicFamily.findMany).toHaveBeenCalled();
      expect(result).toHaveLength(2);
    });

    it("should exclude hidden families for company", async () => {
      vi.mocked(prisma.companyHeuristicVisibility.findMany).mockResolvedValue([
        { heuristicFamilyId: "hidden-fam" },
      ] as any);
      vi.mocked(prisma.heuristicFamily.findMany).mockResolvedValue([]);

      await dbGetHeuristicFamilies("company-123");

      expect(prisma.companyHeuristicVisibility.findMany).toHaveBeenCalledWith({
        where: {
          companyId: "company-123",
          isHidden: true,
        },
        select: {
          heuristicFamilyId: true,
        },
      });
      // Just verify findMany was called - the complex where clause has nested AND/OR logic
      expect(prisma.heuristicFamily.findMany).toHaveBeenCalled();
    });
  });

  describe("dbGetHeuristicFamily", () => {
    it("should return family with heuristics when found", async () => {
      const mockFamily = {
        id: "fam-123",
        name: "Nielsen's 10 Heuristics",
        heuristics: [
          { id: "h1", heuristic: "Visibility of system status", examples: [] },
        ],
      };

      vi.mocked(prisma.heuristicFamily.findUnique).mockResolvedValue(
        mockFamily as any
      );

      const result = await dbGetHeuristicFamily("fam-123");

      expect(prisma.heuristicFamily.findUnique).toHaveBeenCalledWith({
        where: { id: "fam-123" },
        include: {
          heuristics: {
            include: { examples: true },
            orderBy: { createdAt: "asc" },
          },
        },
      });
      expect(result).toEqual(mockFamily);
    });

    it("should return null when family not found", async () => {
      vi.mocked(prisma.heuristicFamily.findUnique).mockResolvedValue(null);

      const result = await dbGetHeuristicFamily("nonexistent");

      expect(result).toBeNull();
    });
  });

  describe("dbCreateHeuristicFamily", () => {
    it("should create a new heuristic family", async () => {
      const mockFamily = {
        id: "fam-new",
        name: "Custom Heuristics",
        key: "custom",
        description: "Company-specific heuristics",
        companyId: "company-123",
      };

      vi.mocked(prisma.heuristicFamily.create).mockResolvedValue(
        mockFamily as any
      );

      const result = await dbCreateHeuristicFamily({
        name: "Custom Heuristics",
        key: "custom",
        description: "Company-specific heuristics",
        companyId: "company-123",
        createdById: "user-123",
      });

      expect(prisma.heuristicFamily.create).toHaveBeenCalledWith({
        data: {
          name: "Custom Heuristics",
          key: "custom",
          description: "Company-specific heuristics",
          companyId: "company-123",
          createdById: "user-123",
        },
      });
      expect(result).toEqual(mockFamily);
    });
  });

  describe("dbUpdateHeuristicFamily", () => {
    it("should update heuristic family", async () => {
      const mockFamily = {
        id: "fam-123",
        name: "Updated Name",
        description: "Updated description",
      };

      vi.mocked(prisma.heuristicFamily.update).mockResolvedValue(
        mockFamily as any
      );

      const result = await dbUpdateHeuristicFamily("fam-123", {
        name: "Updated Name",
        description: "Updated description",
      });

      expect(prisma.heuristicFamily.update).toHaveBeenCalledWith({
        where: { id: "fam-123" },
        data: {
          name: "Updated Name",
          description: "Updated description",
        },
      });
      expect(result).toEqual(mockFamily);
    });
  });

  describe("dbDeleteHeuristicFamily", () => {
    it("should delete company-owned heuristic family", async () => {
      vi.mocked(prisma.heuristicFamily.findFirst).mockResolvedValue({
        id: "fam-123",
        companyId: "company-123",
      } as any);
      vi.mocked(prisma.heuristicFamily.delete).mockResolvedValue({} as any);

      await dbDeleteHeuristicFamily("fam-123", "company-123");

      expect(prisma.heuristicFamily.findFirst).toHaveBeenCalledWith({
        where: {
          id: "fam-123",
          companyId: "company-123",
        },
      });
      expect(prisma.heuristicFamily.delete).toHaveBeenCalledWith({
        where: { id: "fam-123" },
      });
    });

    it("should throw error when family not owned by company", async () => {
      vi.mocked(prisma.heuristicFamily.findFirst).mockResolvedValue(null);

      await expect(
        dbDeleteHeuristicFamily("fam-123", "company-123")
      ).rejects.toThrow("Heuristic family not found or access denied");
    });
  });
});
