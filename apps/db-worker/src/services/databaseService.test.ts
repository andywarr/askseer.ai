import { describe, it, expect, vi, beforeEach } from "vitest";
import prisma from "@/apps/db-worker/src/services/db.ts";
import {
  dbInitStudy,
  dbFinalizeStudy,
  dbGetStudy,
  dbGetStudies,
  dbDeleteStudy,
  dbPostCognitiveWalkthrough,
  dbPostHeuristicEvaluation,
  dbGetStarredStudyIds,
  dbIsStudyStarred,
  dbToggleStudyStar,
} from "./databaseService.ts";

// Mock environment variables
process.env.AWS_BUCKET = "test-bucket";

describe("databaseService - Study Operations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("dbInitStudy", () => {
    it("should create a new study with valid data", async () => {
      const mockStudy = {
        id: "study-123",
        createdByUserId: "user-123",
        teamId: "team-123",
        name: "Test Study",
        type: "HEURISTIC_EVALUATION",
        jobData: { init: true },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.study.create).mockResolvedValue(mockStudy as any);

      const result = await dbInitStudy({
        userId: "user-123",
        teamId: "team-123",
        name: "Test Study",
        type: "HEURISTIC_EVALUATION",
      });

      expect(prisma.study.create).toHaveBeenCalledWith({
        data: {
          createdByUserId: "user-123",
          teamId: "team-123",
          name: "Test Study",
          type: "HEURISTIC_EVALUATION",
          jobData: { init: true },
        },
      });
      expect(result).toEqual(mockStudy);
    });

    it("should create a cognitive walkthrough study", async () => {
      const mockStudy = {
        id: "study-456",
        createdByUserId: "user-123",
        teamId: "team-123",
        name: "CW Study",
        type: "COGNITIVE_WALKTHROUGH",
        jobData: { init: true },
      };

      vi.mocked(prisma.study.create).mockResolvedValue(mockStudy as any);

      const result = await dbInitStudy({
        userId: "user-123",
        teamId: "team-123",
        name: "CW Study",
        type: "COGNITIVE_WALKTHROUGH",
      });

      expect(prisma.study.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: "COGNITIVE_WALKTHROUGH",
        }),
      });
      expect(result.type).toBe("COGNITIVE_WALKTHROUGH");
    });

    it("should create a persona study", async () => {
      const mockStudy = {
        id: "study-789",
        createdByUserId: "user-123",
        teamId: "team-123",
        name: "Persona Study",
        type: "PERSONA",
        jobData: { init: true },
      };

      vi.mocked(prisma.study.create).mockResolvedValue(mockStudy as any);

      await dbInitStudy({
        userId: "user-123",
        teamId: "team-123",
        name: "Persona Study",
        type: "PERSONA",
      });

      expect(prisma.study.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: "PERSONA",
        }),
      });
    });

    it("should throw error for invalid study type", async () => {
      vi.mocked(prisma.study.create).mockRejectedValue(
        new Error("Invalid study type: INVALID")
      );

      await expect(
        dbInitStudy({
          userId: "user-123",
          teamId: "team-123",
          name: "Test Study",
          type: "INVALID",
        })
      ).rejects.toThrow();
    });

    it("should throw error on database failure", async () => {
      vi.mocked(prisma.study.create).mockRejectedValue(
        new Error("Database error")
      );

      await expect(
        dbInitStudy({
          userId: "user-123",
          teamId: "team-123",
          name: "Test Study",
          type: "HEURISTIC_EVALUATION",
        })
      ).rejects.toThrow("Database error");
    });
  });

  describe("dbFinalizeStudy", () => {
    it("should finalize study with files", async () => {
      const mockExisting = { id: "study-123", jobData: { init: true } };
      const mockUpdated = {
        id: "study-123",
        files: [
          { id: "file-1", key: "uploads/file1.png", originalName: "file1.png" },
        ],
        jobData: { init: false, type: "HEURISTIC_EVALUATION" },
      };

      vi.mocked(prisma.study.findUnique).mockResolvedValue(mockExisting as any);
      vi.mocked(prisma.study.update).mockResolvedValue(mockUpdated as any);

      const result = await dbFinalizeStudy({
        studyId: "study-123",
        files: [
          {
            name: "file1.png",
            key: "uploads/file1.png",
            size: 1024,
            type: "image/png",
          },
        ],
        jobData: { init: false, type: "HEURISTIC_EVALUATION" } as any,
      });

      expect(prisma.study.findUnique).toHaveBeenCalledWith({
        where: { id: "study-123" },
        select: { id: true, jobData: true },
      });
      expect(prisma.study.update).toHaveBeenCalled();
      expect(result.files).toHaveLength(1);
    });

    it("should throw error if study not found", async () => {
      vi.mocked(prisma.study.findUnique).mockResolvedValue(null);

      await expect(
        dbFinalizeStudy({
          studyId: "nonexistent",
          files: [],
          jobData: {} as any,
        })
      ).rejects.toThrow("Study not found");
    });

    it("should handle multiple files", async () => {
      const mockExisting = { id: "study-123", jobData: { init: true } };
      const mockUpdated = {
        id: "study-123",
        files: [
          { id: "file-1", key: "uploads/file1.png" },
          { id: "file-2", key: "uploads/file2.jpg" },
          { id: "file-3", key: "uploads/file3.gif" },
        ],
      };

      vi.mocked(prisma.study.findUnique).mockResolvedValue(mockExisting as any);
      vi.mocked(prisma.study.update).mockResolvedValue(mockUpdated as any);

      const result = await dbFinalizeStudy({
        studyId: "study-123",
        files: [
          {
            name: "file1.png",
            key: "uploads/file1.png",
            size: 1024,
            type: "image/png",
          },
          {
            name: "file2.jpg",
            key: "uploads/file2.jpg",
            size: 2048,
            type: "image/jpeg",
          },
          {
            name: "file3.gif",
            key: "uploads/file3.gif",
            size: 512,
            type: "image/gif",
          },
        ],
        jobData: {} as any,
      });

      expect(result.files).toHaveLength(3);
    });
  });

  describe("dbGetStudy", () => {
    it("should return study for owner", async () => {
      const mockStudy = {
        id: "study-123",
        name: "Test Study",
        createdByUserId: "user-123",
        files: [],
      };

      vi.mocked(prisma.study.findFirst).mockResolvedValue(mockStudy as any);

      const result = await dbGetStudy("study-123", "user-123");

      expect(prisma.study.findFirst).toHaveBeenCalledWith({
        where: {
          id: "study-123",
          OR: [
            { createdByUserId: "user-123" },
            {
              team: {
                memberships: {
                  some: {
                    userId: "user-123",
                    status: "ACTIVE",
                  },
                },
              },
            },
          ],
        },
        include: { files: true },
      });
      expect(result).toEqual(mockStudy);
    });

    it("should return null for unauthorized user", async () => {
      vi.mocked(prisma.study.findFirst).mockResolvedValue(null);

      const result = await dbGetStudy("study-123", "other-user");

      expect(result).toBeNull();
    });

    it("should include files in result", async () => {
      const mockStudy = {
        id: "study-123",
        files: [
          { id: "file-1", key: "uploads/file1.png" },
          { id: "file-2", key: "uploads/file2.jpg" },
        ],
      };

      vi.mocked(prisma.study.findFirst).mockResolvedValue(mockStudy as any);

      const result = await dbGetStudy("study-123", "user-123");

      expect(result?.files).toHaveLength(2);
    });
  });

  describe("dbGetStudies", () => {
    it("should return studies created by user", async () => {
      const mockStudies = [
        { id: "study-1", name: "Study 1", type: "HEURISTIC_EVALUATION" },
        { id: "study-2", name: "Study 2", type: "COGNITIVE_WALKTHROUGH" },
      ];

      vi.mocked(prisma.study.findMany).mockResolvedValue(mockStudies as any);

      const result = await dbGetStudies("user-123");

      expect(prisma.study.findMany).toHaveBeenCalledWith({
        where: { createdByUserId: "user-123" },
        orderBy: [{ createdAt: "desc" }],
        include: expect.any(Object),
      });
      expect(result).toHaveLength(2);
    });

    it("should filter by team when teamId provided", async () => {
      const mockStudies = [
        { id: "study-1", name: "Team Study", teamId: "team-123" },
      ];

      vi.mocked(prisma.study.findMany).mockResolvedValue(mockStudies as any);

      await dbGetStudies("user-123", "team-123");

      expect(prisma.study.findMany).toHaveBeenCalledWith({
        where: {
          teamId: "team-123",
          team: {
            memberships: {
              some: {
                userId: "user-123",
                status: "ACTIVE",
              },
            },
          },
        },
        orderBy: [{ createdAt: "desc" }],
        include: expect.any(Object),
      });
    });

    it("should filter out old persona versions", async () => {
      const mockStudies = [
        { id: "study-1", type: "PERSONA", persona: { isLatest: true } },
        { id: "study-2", type: "PERSONA", persona: { isLatest: false } },
        { id: "study-3", type: "HEURISTIC_EVALUATION", persona: null },
      ];

      vi.mocked(prisma.study.findMany).mockResolvedValue(mockStudies as any);

      const result = await dbGetStudies("user-123");

      // Should filter out study-2 (old persona version)
      expect(result).toHaveLength(2);
      expect(result.map((s: any) => s.id)).toContain("study-1");
      expect(result.map((s: any) => s.id)).toContain("study-3");
    });
  });

  describe("dbDeleteStudy", () => {
    it("should delete study when user is owner", async () => {
      // Mock getStudyManagementContext dependencies
      const mockStudy = {
        id: "study-123",
        createdByUserId: "user-123",
        teamId: "team-123",
        team: { companyId: null },
      };

      vi.mocked(prisma.study.findUnique).mockResolvedValue(mockStudy as any);
      vi.mocked(prisma.teamMembership.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.persona.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.study.delete).mockResolvedValue(mockStudy as any);

      await expect(
        dbDeleteStudy("study-123", "user-123")
      ).resolves.not.toThrow();

      expect(prisma.study.delete).toHaveBeenCalledWith({
        where: { id: "study-123" },
      });
    });

    it("should throw 403 when user is not authorized", async () => {
      // Mock unauthorized scenario - user is not owner, not team admin, not company admin
      const mockStudy = {
        id: "study-123",
        createdByUserId: "other-user",
        teamId: "team-123",
        team: { companyId: null },
      };

      vi.mocked(prisma.study.findUnique).mockResolvedValue(mockStudy as any);
      vi.mocked(prisma.teamMembership.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.companyMembership.findFirst).mockResolvedValue(null);

      await expect(dbDeleteStudy("study-123", "user-123")).rejects.toThrow(
        "User not authorized to delete study"
      );
    });

    it("should prevent deletion of persona with related studies", async () => {
      const mockStudy = {
        id: "study-123",
        createdByUserId: "user-123",
        teamId: "team-123",
        team: { companyId: null },
      };

      vi.mocked(prisma.study.findUnique).mockResolvedValue(mockStudy as any);
      vi.mocked(prisma.teamMembership.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.persona.findUnique).mockResolvedValue({
        id: "persona-1",
        studyId: "study-123",
        heuristicEvaluations: [{ id: "he-1" }],
        cognitiveWalkthroughs: [],
      } as any);

      await expect(dbDeleteStudy("study-123", "user-123")).rejects.toThrow(
        "Cannot delete persona with related studies"
      );
    });

    it("should allow team admin to delete study", async () => {
      const mockStudy = {
        id: "study-123",
        createdByUserId: "other-user",
        teamId: "team-123",
        team: { companyId: null },
      };

      vi.mocked(prisma.study.findUnique).mockResolvedValue(mockStudy as any);
      vi.mocked(prisma.teamMembership.findUnique).mockResolvedValue({
        teamId: "team-123",
        userId: "user-123",
        status: "ACTIVE",
        role: "ADMIN",
      } as any);
      vi.mocked(prisma.persona.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.study.delete).mockResolvedValue(mockStudy as any);

      await expect(
        dbDeleteStudy("study-123", "user-123")
      ).resolves.not.toThrow();
    });

    it("should throw 404 when study not found", async () => {
      vi.mocked(prisma.study.findUnique).mockResolvedValue(null);

      await expect(dbDeleteStudy("nonexistent", "user-123")).rejects.toThrow(
        "Study not found"
      );
    });
  });
});

describe("databaseService - Cognitive Walkthrough", () => {
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

    it("should create cognitive walkthrough with steps and issues", async () => {
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
      vi.mocked(prisma.cognitiveWalkthrough.create).mockRejectedValue(
        new Error("Database error")
      );

      await expect(dbPostCognitiveWalkthrough(mockCWData)).rejects.toThrow(
        "Database error"
      );
    });
  });
});

describe("databaseService - Heuristic Evaluation", () => {
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

    it("should create heuristic evaluation with results", async () => {
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
          results: {
            create: expect.arrayContaining([
              expect.objectContaining({
                violated: true,
                reason: "No loading indicator",
                severity: 3,
                step: 1,
              }),
            ]),
          },
        }),
      });
    });

    it("should delete existing evaluation before creating new one", async () => {
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

    it("should handle non-violated heuristic without recommendations", async () => {
      const dataWithNoViolation = {
        studyData: mockHEData.studyData,
        results: [
          {
            id: "heuristic-1",
            heuristic: "Visibility of system status",
            violated: false,
            reason: "Loading state is clearly shown",
            severity: undefined,
            recommendations: [],
            fileId: "file-1",
            step: 1,
          },
        ],
      };

      vi.mocked(prisma.heuristicEvaluation.deleteMany).mockResolvedValue({
        count: 0,
      });
      vi.mocked(prisma.heuristicEvaluation.create).mockResolvedValue({
        id: "he-123",
      } as any);
      vi.mocked(prisma.study.update).mockResolvedValue({
        id: "study-123",
      } as any);

      await dbPostHeuristicEvaluation(dataWithNoViolation);

      expect(prisma.heuristicEvaluation.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          results: {
            create: expect.arrayContaining([
              expect.objectContaining({
                violated: false,
                recommendations: undefined,
              }),
            ]),
          },
        }),
      });
    });

    it("should handle multiple results across files", async () => {
      const dataWithMultipleResults = {
        studyData: mockHEData.studyData,
        results: [
          {
            id: "h1",
            heuristic: "Visibility",
            violated: true,
            reason: "Issue 1",
            severity: 3,
            recommendations: [{ recommendation: "Fix 1" }],
            fileId: "file-1",
            step: 1,
          },
          {
            id: "h2",
            heuristic: "Feedback",
            violated: false,
            reason: "Good",
            severity: undefined,
            recommendations: [],
            fileId: "file-1",
            step: 2,
          },
          {
            id: "h1",
            heuristic: "Visibility",
            violated: true,
            reason: "Issue 2",
            severity: 2,
            recommendations: [{ recommendation: "Fix 2" }],
            fileId: "file-2",
            step: 1,
          },
        ],
      };

      vi.mocked(prisma.heuristicEvaluation.deleteMany).mockResolvedValue({
        count: 0,
      });
      vi.mocked(prisma.heuristicEvaluation.create).mockResolvedValue({
        id: "he-123",
      } as any);
      vi.mocked(prisma.study.update).mockResolvedValue({
        id: "study-123",
      } as any);

      await dbPostHeuristicEvaluation(dataWithMultipleResults);

      expect(prisma.heuristicEvaluation.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          results: {
            create: expect.arrayContaining([
              expect.objectContaining({ step: 1 }),
              expect.objectContaining({ step: 2 }),
            ]),
          },
        }),
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
      vi.mocked(prisma.heuristicEvaluation.deleteMany).mockResolvedValue({
        count: 0,
      });
      vi.mocked(prisma.heuristicEvaluation.create).mockRejectedValue(
        new Error("Database error")
      );

      await expect(dbPostHeuristicEvaluation(mockHEData)).rejects.toThrow(
        "Database error"
      );
    });
  });
});

describe("databaseService - Starred Studies", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("dbGetStarredStudyIds", () => {
    it("should return starred study IDs for a user", async () => {
      const mockStarredStudies = [
        { studyId: "study-1" },
        { studyId: "study-2" },
        { studyId: "study-3" },
      ];

      vi.mocked(prisma.starredStudy.findMany).mockResolvedValue(
        mockStarredStudies as any
      );

      const result = await dbGetStarredStudyIds("user-123");

      expect(prisma.starredStudy.findMany).toHaveBeenCalledWith({
        where: { userId: "user-123" },
        select: { studyId: true },
      });
      expect(result).toEqual(["study-1", "study-2", "study-3"]);
    });

    it("should return empty array when user has no starred studies", async () => {
      vi.mocked(prisma.starredStudy.findMany).mockResolvedValue([]);

      const result = await dbGetStarredStudyIds("user-123");

      expect(result).toEqual([]);
    });

    it("should throw error on database failure", async () => {
      vi.mocked(prisma.starredStudy.findMany).mockRejectedValue(
        new Error("Database error")
      );

      await expect(dbGetStarredStudyIds("user-123")).rejects.toThrow(
        "Database error"
      );
    });
  });

  describe("dbIsStudyStarred", () => {
    it("should return true when study is starred", async () => {
      vi.mocked(prisma.starredStudy.findUnique).mockResolvedValue({
        id: "starred-1",
        userId: "user-123",
        studyId: "study-123",
        createdAt: new Date(),
      } as any);

      const result = await dbIsStudyStarred("user-123", "study-123");

      expect(prisma.starredStudy.findUnique).toHaveBeenCalledWith({
        where: {
          userId_studyId: {
            userId: "user-123",
            studyId: "study-123",
          },
        },
      });
      expect(result).toBe(true);
    });

    it("should return false when study is not starred", async () => {
      vi.mocked(prisma.starredStudy.findUnique).mockResolvedValue(null);

      const result = await dbIsStudyStarred("user-123", "study-123");

      expect(result).toBe(false);
    });

    it("should throw error on database failure", async () => {
      vi.mocked(prisma.starredStudy.findUnique).mockRejectedValue(
        new Error("Database error")
      );

      await expect(dbIsStudyStarred("user-123", "study-123")).rejects.toThrow(
        "Database error"
      );
    });
  });

  describe("dbToggleStudyStar", () => {
    it("should unstar a study that is currently starred", async () => {
      // Mock isStudyStarred to return true
      vi.mocked(prisma.starredStudy.findUnique).mockResolvedValue({
        id: "starred-1",
        userId: "user-123",
        studyId: "study-123",
        createdAt: new Date(),
      } as any);

      vi.mocked(prisma.starredStudy.delete).mockResolvedValue({} as any);

      const result = await dbToggleStudyStar("user-123", "study-123");

      expect(prisma.starredStudy.delete).toHaveBeenCalledWith({
        where: {
          userId_studyId: {
            userId: "user-123",
            studyId: "study-123",
          },
        },
      });
      expect(result).toEqual({ success: true, isStarred: false });
    });

    it("should star a study that is not currently starred", async () => {
      // Mock isStudyStarred to return false
      vi.mocked(prisma.starredStudy.findUnique).mockResolvedValue(null);

      // Mock study lookup with team membership
      vi.mocked(prisma.study.findUnique).mockResolvedValue({
        id: "study-123",
        createdByUserId: "user-123",
        team: {
          memberships: [{ userId: "user-123", status: "ACTIVE" }],
        },
      } as any);

      vi.mocked(prisma.starredStudy.create).mockResolvedValue({
        id: "starred-1",
        userId: "user-123",
        studyId: "study-123",
        createdAt: new Date(),
      } as any);

      const result = await dbToggleStudyStar("user-123", "study-123");

      expect(prisma.starredStudy.create).toHaveBeenCalledWith({
        data: {
          userId: "user-123",
          studyId: "study-123",
        },
      });
      expect(result).toEqual({ success: true, isStarred: true });
    });

    it("should throw 404 error when study does not exist", async () => {
      vi.mocked(prisma.starredStudy.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.study.findUnique).mockResolvedValue(null);

      await expect(
        dbToggleStudyStar("user-123", "nonexistent-study")
      ).rejects.toMatchObject({
        message: "Study not found",
        status: 404,
      });
    });

    it("should throw 403 error when user is not authorized", async () => {
      vi.mocked(prisma.starredStudy.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.study.findUnique).mockResolvedValue({
        id: "study-123",
        createdByUserId: "other-user",
        team: {
          memberships: [], // User is not a team member
        },
      } as any);

      await expect(
        dbToggleStudyStar("user-123", "study-123")
      ).rejects.toMatchObject({
        message: "User not authorized to star this study",
        status: 403,
      });
    });

    it("should allow creator to star even without team membership", async () => {
      vi.mocked(prisma.starredStudy.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.study.findUnique).mockResolvedValue({
        id: "study-123",
        createdByUserId: "user-123", // User is the creator
        team: {
          memberships: [], // Not a team member but is creator
        },
      } as any);

      vi.mocked(prisma.starredStudy.create).mockResolvedValue({
        id: "starred-1",
        userId: "user-123",
        studyId: "study-123",
        createdAt: new Date(),
      } as any);

      const result = await dbToggleStudyStar("user-123", "study-123");

      expect(result).toEqual({ success: true, isStarred: true });
    });

    it("should handle P2025 error gracefully when unstarring", async () => {
      vi.mocked(prisma.starredStudy.findUnique).mockResolvedValue({
        id: "starred-1",
        userId: "user-123",
        studyId: "study-123",
        createdAt: new Date(),
      } as any);

      const notFoundError: any = new Error("Record not found");
      notFoundError.code = "P2025";
      vi.mocked(prisma.starredStudy.delete).mockRejectedValue(notFoundError);

      const result = await dbToggleStudyStar("user-123", "study-123");

      expect(result).toEqual({ success: true, isStarred: false });
    });

    it("should handle P2002 error gracefully when starring (already starred)", async () => {
      vi.mocked(prisma.starredStudy.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.study.findUnique).mockResolvedValue({
        id: "study-123",
        createdByUserId: "user-123",
        team: { memberships: [] },
      } as any);

      const uniqueConstraintError: any = new Error(
        "Unique constraint violation"
      );
      uniqueConstraintError.code = "P2002";
      vi.mocked(prisma.starredStudy.create).mockRejectedValue(
        uniqueConstraintError
      );

      const result = await dbToggleStudyStar("user-123", "study-123");

      expect(result).toEqual({ success: true, isStarred: true });
    });
  });
});
