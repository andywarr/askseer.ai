import { describe, it, expect, vi, beforeEach } from "vitest";
import prisma from "@/apps/db-worker/src/services/db.ts";
import { dbPostHeuristicEvaluation } from "../index.ts";

describe("heuristicEvaluationService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("dbPostHeuristicEvaluation", () => {
    const mockHEData = {
      studyData: {
        version: 2 as const,
        type: "heuristic_evaluation" as const,
        studyId: "study-123",
        userId: "user-123",
        payload: {
          goal: "Evaluate checkout flow",
          user: "Regular customer",
          context: "Desktop",
          heuristic: "family-123",
        },
      },
      results: [
        {
          id: "heuristic-1",
          heuristic: "Visibility of system status",
          violated: true,
          reason: "No loading indicator",
          severity: 3,
          recommendations: [{ recommendation: "Add loading spinner" }],
          fileId: "file-1",
          step: 1,
        },
      ],
    };

    // Helper to create mock transaction that provides tx with same API as prisma
    const mockTransaction = async (fn: (tx: typeof prisma) => Promise<any>) => {
      return await fn(prisma);
    };

    it("should create heuristic evaluation with results", async () => {
      vi.mocked(prisma.$transaction).mockImplementation(mockTransaction);
      vi.mocked(prisma.heuristicEvaluation.deleteMany).mockResolvedValue({
        count: 0,
      });
      vi.mocked(prisma.heuristicEvaluation.create).mockResolvedValue({
        id: "he-123",
        studyId: "study-123",
      } as any);
      vi.mocked(prisma.study.update).mockResolvedValue({
        id: "study-123",
      } as any);

      await dbPostHeuristicEvaluation(mockHEData);

      expect(prisma.heuristicEvaluation.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          studyId: "study-123",
          goal: "Evaluate checkout flow",
          user: "Regular customer",
          context: "Desktop",
          heuristicFamilyId: "family-123",
        }),
      });
    });

    it("should delete existing evaluation before creating new one", async () => {
      vi.mocked(prisma.$transaction).mockImplementation(mockTransaction);
      vi.mocked(prisma.heuristicEvaluation.deleteMany).mockResolvedValue({
        count: 1,
      });
      vi.mocked(prisma.heuristicEvaluation.create).mockResolvedValue({
        id: "he-123",
      } as any);
      vi.mocked(prisma.study.update).mockResolvedValue({
        id: "study-123",
      } as any);

      await dbPostHeuristicEvaluation(mockHEData);

      expect(prisma.heuristicEvaluation.deleteMany).toHaveBeenCalledWith({
        where: { studyId: "study-123" },
      });
      expect(prisma.heuristicEvaluation.create).toHaveBeenCalled();
    });

    it("should update study status to COMPLETED", async () => {
      vi.mocked(prisma.$transaction).mockImplementation(mockTransaction);
      vi.mocked(prisma.heuristicEvaluation.deleteMany).mockResolvedValue({
        count: 0,
      });
      vi.mocked(prisma.heuristicEvaluation.create).mockResolvedValue({
        id: "he-123",
      } as any);
      vi.mocked(prisma.study.update).mockResolvedValue({
        id: "study-123",
      } as any);

      await dbPostHeuristicEvaluation(mockHEData);

      expect(prisma.study.update).toHaveBeenCalledWith({
        where: { id: "study-123" },
        data: { status: "COMPLETED" },
      });
    });

    it("should resolve personaId from personaStudyId", async () => {
      const dataWithPersona = {
        studyData: {
          ...mockHEData.studyData,
          payload: {
            ...mockHEData.studyData.payload,
            persona: { studyId: "persona-study-123" },
          },
        },
        results: mockHEData.results,
      };

      vi.mocked(prisma.persona.findUnique).mockResolvedValue({
        id: "persona-id-123",
      } as any);
      vi.mocked(prisma.$transaction).mockImplementation(mockTransaction);
      vi.mocked(prisma.heuristicEvaluation.deleteMany).mockResolvedValue({
        count: 0,
      });
      vi.mocked(prisma.heuristicEvaluation.create).mockResolvedValue({
        id: "he-123",
      } as any);
      vi.mocked(prisma.study.update).mockResolvedValue({
        id: "study-123",
      } as any);

      await dbPostHeuristicEvaluation(dataWithPersona);

      expect(prisma.persona.findUnique).toHaveBeenCalledWith({
        where: { studyId: "persona-study-123" },
        select: { id: true },
      });
    });

    it("should throw error when heuristic family is missing", async () => {
      const dataWithoutHeuristic = {
        studyData: {
          ...mockHEData.studyData,
          payload: {
            ...mockHEData.studyData.payload,
            heuristic: undefined,
          },
        },
        results: mockHEData.results,
      };

      await expect(
        dbPostHeuristicEvaluation(dataWithoutHeuristic as any)
      ).rejects.toThrow("Heuristic family ID is required");
    });

    it("should throw error on database failure", async () => {
      vi.mocked(prisma.$transaction).mockRejectedValue(
        new Error("Database error")
      );

      await expect(dbPostHeuristicEvaluation(mockHEData)).rejects.toThrow(
        "Database error"
      );
    });
  });
});
