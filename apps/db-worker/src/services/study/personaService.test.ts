import { describe, it, expect, vi, beforeEach } from "vitest";
import prisma from "@/apps/db-worker/src/services/db.ts";
import {
  dbGetPersonaBasicInfo,
  dbListPersonas,
} from "../index.ts";

// Mock the studyService functions used by personaService
vi.mock("./studyService.ts", () => ({
  dbUpdateStudyStatus: vi.fn().mockResolvedValue(undefined),
  dbUpdateStudyName: vi.fn().mockResolvedValue(undefined),
}));

describe("personaService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("dbGetPersonaBasicInfo", () => {
    it("should return persona basic info when found", async () => {
      const mockStudy = {
        id: "study-123",
        persona: {
          id: "persona-123",
          name: "Test Persona",
          data: { description: "A test persona" },
          photoFile: { key: "uploads/photo.jpg" },
        },
      };

      vi.mocked(prisma.study.findUnique).mockResolvedValue(mockStudy as any);

      const result = await dbGetPersonaBasicInfo("study-123");

      expect(prisma.study.findUnique).toHaveBeenCalledWith({
        where: { id: "study-123" },
        select: {
          id: true,
          persona: {
            select: {
              id: true,
              name: true,
              data: true,
              photoFile: { select: { key: true } },
            },
          },
        },
      });
      expect(result).toEqual({
        id: "persona-123",
        name: "Test Persona",
        description: "A test persona",
        photoKey: "uploads/photo.jpg",
      });
    });

    it("should return null when persona not found", async () => {
      vi.mocked(prisma.study.findUnique).mockResolvedValue({
        id: "study-123",
        persona: null,
      } as any);

      const result = await dbGetPersonaBasicInfo("study-123");

      expect(result).toBeNull();
    });

    it("should handle nested data structure", async () => {
      const mockStudy = {
        id: "study-123",
        persona: {
          id: "persona-123",
          name: "Nested Persona",
          data: { data: { description: "Nested description" } },
          photoFile: null,
        },
      };

      vi.mocked(prisma.study.findUnique).mockResolvedValue(mockStudy as any);

      const result = await dbGetPersonaBasicInfo("study-123");

      expect(result?.description).toBe("Nested description");
      expect(result?.photoKey).toBeNull();
    });
  });

  describe("dbListPersonas", () => {
    it("should return personas for team member", async () => {
      vi.mocked(prisma.teamMembership.findUnique).mockResolvedValue({
        id: "membership-123",
      } as any);
      vi.mocked(prisma.study.findMany).mockResolvedValue([
        {
          id: "study-1",
          name: "Persona 1",
          files: [],
          persona: { id: "p1", photoFile: null, coverFile: null },
        },
        {
          id: "study-2",
          name: "Persona 2",
          files: [],
          persona: { id: "p2", photoFile: null, coverFile: null },
        },
      ] as any);

      const result = await dbListPersonas("user-123", "team-123");

      expect(prisma.teamMembership.findUnique).toHaveBeenCalledWith({
        where: { teamId_userId: { teamId: "team-123", userId: "user-123" } },
        select: { id: true },
      });
      expect(result).toHaveLength(2);
    });

    it("should return empty array when user is not team member", async () => {
      vi.mocked(prisma.teamMembership.findUnique).mockResolvedValue(null);

      const result = await dbListPersonas("user-123", "team-123");

      expect(result).toHaveLength(0);
      expect(prisma.study.findMany).not.toHaveBeenCalled();
    });

    it("should filter for latest persona versions only", async () => {
      vi.mocked(prisma.teamMembership.findUnique).mockResolvedValue({
        id: "membership-123",
      } as any);
      vi.mocked(prisma.study.findMany).mockResolvedValue([]);

      await dbListPersonas("user-123", "team-123");

      expect(prisma.study.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            persona: { isLatest: true },
          }),
        })
      );
    });
  });
});
