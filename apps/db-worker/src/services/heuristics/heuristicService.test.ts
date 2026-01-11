import { describe, it, expect, vi, beforeEach } from "vitest";
import prisma from "@/apps/db-worker/src/services/db.ts";
import {
  dbCreateHeuristic,
  dbUpdateHeuristic,
  dbDeleteHeuristic,
  dbGetHeuristic,
  dbGetHeuristics,
} from "../index.ts";

describe("heuristicService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("dbCreateHeuristic", () => {
    it("should create heuristic in company-owned family", async () => {
      vi.mocked(prisma.heuristicFamily.findUnique).mockResolvedValue({
        id: "fam-123",
        companyId: "company-123",
      } as any);
      vi.mocked(prisma.heuristic.create).mockResolvedValue({
        id: "h-new",
        heuristic: "New heuristic",
      } as any);

      const result = await dbCreateHeuristic({
        heuristicFamilyId: "fam-123",
        heuristic: "New heuristic",
        companyId: "company-123",
        createdById: "user-123",
      });

      expect(prisma.heuristic.create).toHaveBeenCalledWith({
        data: {
          heuristicFamilyId: "fam-123",
          category: undefined,
          label: undefined,
          heuristic: "New heuristic",
          createdById: "user-123",
        },
      });
      expect(result.id).toBe("h-new");
    });

    it("should throw error when family not found", async () => {
      vi.mocked(prisma.heuristicFamily.findUnique).mockResolvedValue(null);

      await expect(
        dbCreateHeuristic({
          heuristicFamilyId: "nonexistent",
          heuristic: "Test",
        })
      ).rejects.toThrow("Heuristic family not found");
    });

    it("should throw error for global families", async () => {
      vi.mocked(prisma.heuristicFamily.findUnique).mockResolvedValue({
        id: "fam-123",
        companyId: null, // global family
      } as any);

      await expect(
        dbCreateHeuristic({
          heuristicFamilyId: "fam-123",
          heuristic: "Test",
        })
      ).rejects.toThrow("Cannot add heuristics to global families");
    });

    it("should throw error for wrong company", async () => {
      vi.mocked(prisma.heuristicFamily.findUnique).mockResolvedValue({
        id: "fam-123",
        companyId: "other-company",
      } as any);

      await expect(
        dbCreateHeuristic({
          heuristicFamilyId: "fam-123",
          heuristic: "Test",
          companyId: "my-company",
        })
      ).rejects.toThrow("Access denied to this heuristic family");
    });
  });

  describe("dbUpdateHeuristic", () => {
    it("should update heuristic in company-owned family", async () => {
      vi.mocked(prisma.heuristic.findUnique).mockResolvedValue({
        id: "h-123",
        family: { id: "fam-123", companyId: "company-123" },
      } as any);
      vi.mocked(prisma.heuristic.update).mockResolvedValue({
        id: "h-123",
        heuristic: "Updated",
      } as any);

      const result = await dbUpdateHeuristic("h-123", {
        heuristic: "Updated",
        companyId: "company-123",
      });

      expect(result.heuristic).toBe("Updated");
    });

    it("should throw error when heuristic not found", async () => {
      vi.mocked(prisma.heuristic.findUnique).mockResolvedValue(null);

      await expect(dbUpdateHeuristic("nonexistent", {})).rejects.toThrow(
        "Heuristic not found"
      );
    });

    it("should throw error for global heuristics", async () => {
      vi.mocked(prisma.heuristic.findUnique).mockResolvedValue({
        id: "h-123",
        family: { id: "fam-123", companyId: null },
      } as any);

      await expect(dbUpdateHeuristic("h-123", {})).rejects.toThrow(
        "Cannot modify global heuristics"
      );
    });
  });

  describe("dbDeleteHeuristic", () => {
    it("should delete company-owned heuristic", async () => {
      vi.mocked(prisma.heuristic.findUnique).mockResolvedValue({
        id: "h-123",
        family: { id: "fam-123", companyId: "company-123" },
      } as any);
      vi.mocked(prisma.heuristic.delete).mockResolvedValue({} as any);

      await dbDeleteHeuristic("h-123", "company-123");

      expect(prisma.heuristic.delete).toHaveBeenCalledWith({
        where: { id: "h-123" },
      });
    });

    it("should throw error when heuristic not found", async () => {
      vi.mocked(prisma.heuristic.findUnique).mockResolvedValue(null);

      await expect(dbDeleteHeuristic("nonexistent")).rejects.toThrow(
        "Heuristic not found"
      );
    });
  });

  describe("dbGetHeuristic", () => {
    it("should return heuristic with examples for company user", async () => {
      vi.mocked(prisma.heuristic.findUnique).mockResolvedValue({
        id: "h-123",
        heuristic: "Test heuristic",
        family: { id: "fam-123", companyId: "company-123" },
        examples: [{ id: "ex-1", example: "Example 1" }],
      } as any);

      const result = await dbGetHeuristic("h-123", "company-123");

      expect(result?.examples).toHaveLength(1);
    });

    it("should filter examples for non-company user", async () => {
      vi.mocked(prisma.heuristic.findUnique).mockResolvedValue({
        id: "h-123",
        heuristic: "Test heuristic",
        family: { id: "fam-123", companyId: "company-123" },
        examples: [{ id: "ex-1", example: "Example 1" }],
      } as any);

      const result = await dbGetHeuristic("h-123", "other-company");

      expect(result?.examples).toHaveLength(0);
    });

    it("should return null when heuristic not found", async () => {
      vi.mocked(prisma.heuristic.findUnique).mockResolvedValue(null);

      const result = await dbGetHeuristic("nonexistent");

      expect(result).toBeNull();
    });
  });

  describe("dbGetHeuristics", () => {
    it("should return heuristics by family key", async () => {
      vi.mocked(prisma.heuristicFamily.findUnique).mockResolvedValue({
        id: "fam-123",
        key: "nielsen",
        companyId: null,
        heuristics: [
          { id: "h-1", heuristic: "Visibility" },
          { id: "h-2", heuristic: "Match" },
        ],
      } as any);

      const result = await dbGetHeuristics("nielsen");

      expect(result).toHaveLength(2);
    });

    it("should throw error when neither key nor id provided", async () => {
      await expect(dbGetHeuristics()).rejects.toThrow(
        "Either familyKey or familyId must be provided"
      );
    });

    it("should return empty array when family is hidden for company", async () => {
      vi.mocked(prisma.companyHeuristicVisibility.findFirst).mockResolvedValue({
        companyId: "company-123",
        heuristicFamilyId: "fam-123",
        isHidden: true,
      } as any);

      const result = await dbGetHeuristics("nielsen", undefined, "company-123");

      expect(result).toHaveLength(0);
    });

    it("should return empty array when accessing other company's family", async () => {
      vi.mocked(prisma.companyHeuristicVisibility.findFirst).mockResolvedValue(
        null
      );
      vi.mocked(prisma.heuristicFamily.findUnique).mockResolvedValue({
        id: "fam-123",
        key: "custom",
        companyId: "other-company",
        heuristics: [],
      } as any);

      const result = await dbGetHeuristics("custom", undefined, "my-company");

      expect(result).toHaveLength(0);
    });
  });
});
