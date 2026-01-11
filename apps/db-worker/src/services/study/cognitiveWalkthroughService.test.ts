import { describe, it, expect, vi, beforeEach } from "vitest";
import prisma from "@/apps/db-worker/src/services/db.ts";
import { dbPostCognitiveWalkthrough } from "../index.ts";

describe("cognitiveWalkthroughService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("dbPostCognitiveWalkthrough", () => {
    const mockCWData = {
      studyData: {
        version: 2 as const,
        type: "cognitive_walkthrough" as const,
        studyId: "study-123",
        userId: "user-123",
        payload: {
          goal: "Complete checkout",
          user: "First-time shopper",
          context: "Mobile web",
        },
      },
      results: [
        {
          step: 1,
          expected: true,
          results: [
            { questionId: "q1", answer: "Yes, the user can find the cart" },
          ],
          issues: [
            {
              issueType: "WILL_NOT",
              issue: "Cart icon is too small",
              severity: 3,
              recommendations: [
                { recommendation: "Increase cart icon size to 24px" },
              ],
            },
          ],
        },
      ],
    };

    // Helper to create mock transaction that provides tx with same API as prisma
    const mockTransaction = async (fn: (tx: typeof prisma) => Promise<any>) => {
      return await fn(prisma);
    };

    it("should create cognitive walkthrough with steps and issues", async () => {
      vi.mocked(prisma.$transaction).mockImplementation(mockTransaction);
      vi.mocked(prisma.cognitiveWalkthrough.create).mockResolvedValue({
        id: "cw-123",
        studyId: "study-123",
      } as any);
      vi.mocked(prisma.study.update).mockResolvedValue({
        id: "study-123",
      } as any);

      await dbPostCognitiveWalkthrough(mockCWData);

      expect(prisma.cognitiveWalkthrough.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          studyId: "study-123",
          goal: "Complete checkout",
          user: "First-time shopper",
          context: "Mobile web",
          steps: {
            create: expect.arrayContaining([
              expect.objectContaining({
                step: 1,
                expected: true,
                results: {
                  create: expect.any(Array),
                },
                issues: {
                  create: expect.any(Array),
                },
              }),
            ]),
          },
        }),
      });
    });

    it("should update study status to COMPLETED", async () => {
      vi.mocked(prisma.$transaction).mockImplementation(mockTransaction);
      vi.mocked(prisma.cognitiveWalkthrough.create).mockResolvedValue({
        id: "cw-123",
      } as any);
      vi.mocked(prisma.study.update).mockResolvedValue({
        id: "study-123",
      } as any);

      await dbPostCognitiveWalkthrough(mockCWData);

      expect(prisma.study.update).toHaveBeenCalledWith({
        where: { id: "study-123" },
        data: { status: "COMPLETED" },
      });
    });

    it("should resolve personaId from personaStudyId", async () => {
      const dataWithPersona = {
        studyData: {
          ...mockCWData.studyData,
          payload: {
            ...mockCWData.studyData.payload,
            persona: { studyId: "persona-study-123" },
          },
        },
        results: mockCWData.results,
      };

      vi.mocked(prisma.persona.findUnique).mockResolvedValue({
        id: "persona-id-123",
      } as any);
      vi.mocked(prisma.$transaction).mockImplementation(mockTransaction);
      vi.mocked(prisma.cognitiveWalkthrough.create).mockResolvedValue({
        id: "cw-123",
      } as any);
      vi.mocked(prisma.study.update).mockResolvedValue({
        id: "study-123",
      } as any);

      await dbPostCognitiveWalkthrough(dataWithPersona);

      expect(prisma.persona.findUnique).toHaveBeenCalledWith({
        where: { studyId: "persona-study-123" },
        select: { id: true },
      });
      expect(prisma.cognitiveWalkthrough.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          personaId: "persona-id-123",
        }),
      });
    });

    it("should handle multiple steps", async () => {
      const dataWithMultipleSteps = {
        studyData: mockCWData.studyData,
        results: [
          { step: 1, expected: true, results: [], issues: [] },
          { step: 2, expected: true, results: [], issues: [] },
          { step: 3, expected: false, results: [], issues: [] },
        ],
      };

      vi.mocked(prisma.$transaction).mockImplementation(mockTransaction);
      vi.mocked(prisma.cognitiveWalkthrough.create).mockResolvedValue({
        id: "cw-123",
      } as any);
      vi.mocked(prisma.study.update).mockResolvedValue({
        id: "study-123",
      } as any);

      await dbPostCognitiveWalkthrough(dataWithMultipleSteps);

      expect(prisma.cognitiveWalkthrough.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          steps: {
            create: expect.arrayContaining([
              expect.objectContaining({ step: 1 }),
              expect.objectContaining({ step: 2 }),
              expect.objectContaining({ step: 3 }),
            ]),
          },
        }),
      });
    });

    it("should handle step with multiple issues and recommendations", async () => {
      const dataWithIssues = {
        studyData: mockCWData.studyData,
        results: [
          {
            step: 1,
            expected: false,
            results: [],
            issues: [
              {
                issueType: "WILL_NOT",
                issue: "Issue 1",
                severity: 3,
                recommendations: [
                  { recommendation: "Fix 1" },
                  { recommendation: "Fix 2" },
                ],
              },
              {
                issueType: "NOT_ABLE",
                issue: "Issue 2",
                severity: 4,
                recommendations: [{ recommendation: "Fix 3" }],
              },
            ],
          },
        ],
      };

      vi.mocked(prisma.$transaction).mockImplementation(mockTransaction);
      vi.mocked(prisma.cognitiveWalkthrough.create).mockResolvedValue({
        id: "cw-123",
      } as any);
      vi.mocked(prisma.study.update).mockResolvedValue({
        id: "study-123",
      } as any);

      await dbPostCognitiveWalkthrough(dataWithIssues);

      expect(prisma.cognitiveWalkthrough.create).toHaveBeenCalled();
    });

    it("should throw error on database failure", async () => {
      vi.mocked(prisma.$transaction).mockRejectedValue(
        new Error("Database error")
      );

      await expect(dbPostCognitiveWalkthrough(mockCWData)).rejects.toThrow(
        "Database error"
      );
    });
  });
});
