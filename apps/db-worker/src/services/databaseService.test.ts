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
  dbGetTeamAutoRefillSettings,
  dbUpdateTeamAutoRefillSettings,
  dbUpdateTeamStripeCustomer,
  dbUpdateTeamPaymentMethod,
  dbRemoveTeamPaymentMethod,
  dbGetTeamsNeedingAutoRefill,
  dbUpdateStudyVisibility,
  dbRegenerateStudyShareToken,
  dbGetStudyByShareToken,
} from "./index.ts";

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
        visibility: "TEAM",
      };

      vi.mocked(prisma.team.findUnique).mockResolvedValue({
        isPersonal: false,
      } as any);

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
          visibility: "TEAM",
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

      vi.mocked(prisma.team.findUnique).mockResolvedValue({
        isPersonal: false,
      } as any);

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

      vi.mocked(prisma.team.findUnique).mockResolvedValue({
        isPersonal: false,
      } as any);

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
      vi.mocked(prisma.team.findUnique).mockResolvedValue({
        isPersonal: false,
      } as any);

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
      vi.mocked(prisma.team.findUnique).mockResolvedValue({
        isPersonal: false,
      } as any);

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

      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        teamMemberships: [{ teamId: "team-123", role: "MEMBER" }],
        companyMemberships: [],
      } as any);

      vi.mocked(prisma.study.findFirst).mockResolvedValue(mockStudy as any);

      const result = await dbGetStudy("study-123", "user-123");

      expect(prisma.study.findFirst).toHaveBeenCalledWith({
        where: {
          id: "study-123",
          OR: [
            {
              visibility: "PRIVATE",
              OR: [
                {
                  createdByUserId: "user-123",
                  teamId: { in: ["team-123"] },
                },
              ],
            },
            {
              visibility: "TEAM",
              OR: [
                {
                  teamId: { in: ["team-123"] },
                },
              ],
            },
          ],
        },
        include: { files: true },
      });
      expect(result).toEqual(mockStudy);
    });

    it("should return null for unauthorized user", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        teamMemberships: [],
        companyMemberships: [],
      } as any);

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

      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        teamMemberships: [{ teamId: "team-123", role: "MEMBER" }],
        companyMemberships: [],
      } as any);

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

      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        teamMemberships: [{ teamId: "team-123", role: "MEMBER" }],
        companyMemberships: [],
      } as any);

      vi.mocked(prisma.study.findMany).mockResolvedValue(mockStudies as any);

      const result = await dbGetStudies("user-123");

      expect(prisma.study.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            {
              visibility: "PRIVATE",
              OR: [
                {
                  createdByUserId: "user-123",
                  teamId: { in: ["team-123"] },
                },
              ],
            },
            {
              visibility: "TEAM",
              OR: [
                {
                  teamId: { in: ["team-123"] },
                },
              ],
            },
          ],
        },
        orderBy: [{ createdAt: "desc" }],
        include: {
          files: true,
          createdByUser: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          lastModifiedByUser: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          persona: {
            select: {
              isLatest: true,
            },
          },
          team: {
            select: {
              isPersonal: true,
              company: {
                select: {
                  id: true,
                },
              },
            },
          },
        },
      });
      expect(result).toHaveLength(2);
    });

    it("should filter by team when teamId provided", async () => {
      const mockStudies = [
        { id: "study-1", name: "Team Study", teamId: "team-123" },
      ];

      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        teamMemberships: [{ teamId: "team-123", role: "MEMBER" }],
        companyMemberships: [],
      } as any);

      vi.mocked(prisma.team.findUnique).mockResolvedValue({
        isDefaultForCompany: false,
        companyId: null,
      } as any);

      vi.mocked(prisma.study.findMany).mockResolvedValue(mockStudies as any);

      await dbGetStudies("user-123", "team-123");

      expect(prisma.study.findMany).toHaveBeenCalledWith({
        where: {
          teamId: "team-123",
          OR: [
            {
              visibility: "PRIVATE",
              OR: [
                {
                  createdByUserId: "user-123",
                  teamId: { in: ["team-123"] },
                },
              ],
            },
            {
              visibility: "TEAM",
              OR: [
                {
                  teamId: { in: ["team-123"] },
                },
              ],
            },
          ],
        },
        orderBy: [{ createdAt: "desc" }],
        include: {
          files: true,
          createdByUser: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          lastModifiedByUser: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          persona: {
            select: {
              isLatest: true,
            },
          },
          team: {
            select: {
              isPersonal: true,
              company: {
                select: {
                  id: true,
                },
              },
            },
          },
        },
      });
    });

    it("should filter out old persona versions", async () => {
      const mockStudies = [
        { id: "study-1", type: "PERSONA", persona: { isLatest: true } },
        { id: "study-2", type: "PERSONA", persona: { isLatest: false } },
        { id: "study-3", type: "HEURISTIC_EVALUATION", persona: null },
      ];

      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        teamMemberships: [{ teamId: "team-123", role: "MEMBER" }],
        companyMemberships: [],
      } as any);

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

// ============================================================================
// Auto-Refill Operations Tests
// ============================================================================

describe("databaseService - Auto-Refill Operations", () => {
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

describe("databaseService - Study Sharing Operations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("dbUpdateStudyVisibility", () => {
    const mockStudy = {
      id: "study-123",
      teamId: "team-123",
      createdByUserId: "user-123",
      visibility: "TEAM",
      shareToken: null,
    };

    const mockTeamMembership = {
      userId: "user-123",
      teamId: "team-123",
      role: "ADMIN",
      status: "ACTIVE",
    };

    it("should update visibility to PRIVATE for study owner", async () => {
      vi.mocked(prisma.study.findUnique).mockResolvedValue(mockStudy as any);
      vi.mocked(prisma.teamMembership.findFirst).mockResolvedValue(
        mockTeamMembership as any
      );
      vi.mocked(prisma.study.update).mockResolvedValue({
        ...mockStudy,
        visibility: "PRIVATE",
      } as any);

      const result = await dbUpdateStudyVisibility({
        studyId: "study-123",
        visibility: "PRIVATE" as any,
        userId: "user-123",
      });

      expect(result.visibility).toBe("PRIVATE");
      expect(prisma.study.update).toHaveBeenCalledWith({
        where: { id: "study-123" },
        data: expect.objectContaining({
          visibility: "PRIVATE",
          lastModifiedByUserId: "user-123",
        }),
      });
    });

    it("should update visibility to TEAM", async () => {
      vi.mocked(prisma.study.findUnique).mockResolvedValue(mockStudy as any);
      vi.mocked(prisma.teamMembership.findFirst).mockResolvedValue(
        mockTeamMembership as any
      );
      vi.mocked(prisma.study.update).mockResolvedValue({
        ...mockStudy,
        visibility: "TEAM",
      } as any);

      const result = await dbUpdateStudyVisibility({
        studyId: "study-123",
        visibility: "TEAM" as any,
        userId: "user-123",
      });

      expect(result.visibility).toBe("TEAM");
    });

    it("should update visibility to COMPANY when team has companyId", async () => {
      vi.mocked(prisma.study.findUnique).mockResolvedValue(mockStudy as any);
      vi.mocked(prisma.teamMembership.findFirst).mockResolvedValue(
        mockTeamMembership as any
      );
      vi.mocked(prisma.team.findUnique).mockResolvedValue({
        id: "team-123",
        companyId: "company-123",
      } as any);
      vi.mocked(prisma.study.update).mockResolvedValue({
        ...mockStudy,
        visibility: "COMPANY",
      } as any);

      const result = await dbUpdateStudyVisibility({
        studyId: "study-123",
        visibility: "COMPANY" as any,
        userId: "user-123",
      });

      expect(result.visibility).toBe("COMPANY");
    });

    it("should throw error for COMPANY visibility when team has no company", async () => {
      vi.mocked(prisma.study.findUnique).mockResolvedValue(mockStudy as any);
      vi.mocked(prisma.teamMembership.findFirst).mockResolvedValue(
        mockTeamMembership as any
      );
      vi.mocked(prisma.team.findUnique).mockResolvedValue({
        id: "team-123",
        companyId: null,
      } as any);

      await expect(
        dbUpdateStudyVisibility({
          studyId: "study-123",
          visibility: "COMPANY" as any,
          userId: "user-123",
        })
      ).rejects.toThrow(
        "Company visibility requires the study's team to belong to a company"
      );
    });

    it("should throw 403 for unauthorized user", async () => {
      vi.mocked(prisma.study.findUnique).mockResolvedValue({
        ...mockStudy,
        createdByUserId: "other-user",
      } as any);
      vi.mocked(prisma.teamMembership.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.companyMembership.findFirst).mockResolvedValue(null);

      await expect(
        dbUpdateStudyVisibility({
          studyId: "study-123",
          visibility: "PRIVATE" as any,
          userId: "unauthorized-user",
        })
      ).rejects.toThrow("User not authorized to update study visibility");
    });
  });

  describe("dbRegenerateStudyShareToken", () => {
    const mockStudy = {
      id: "study-123",
      teamId: "team-123",
      createdByUserId: "user-123",
      shareToken: "old-token",
    };

    const mockTeamMembership = {
      userId: "user-123",
      teamId: "team-123",
      role: "ADMIN",
      status: "ACTIVE",
    };

    it("should regenerate share token for authorized user", async () => {
      vi.mocked(prisma.study.findUnique).mockResolvedValue(mockStudy as any);
      vi.mocked(prisma.teamMembership.findFirst).mockResolvedValue(
        mockTeamMembership as any
      );
      vi.mocked(prisma.study.update).mockResolvedValue({
        ...mockStudy,
        shareToken: "new-token-123",
      } as any);

      const result = await dbRegenerateStudyShareToken({
        studyId: "study-123",
        userId: "user-123",
      });

      expect(result.shareToken).toBeDefined();
      expect(result.shareToken).not.toBe("old-token");
      expect(prisma.study.update).toHaveBeenCalledWith({
        where: { id: "study-123" },
        data: {
          shareToken: expect.any(String),
          lastModifiedByUserId: "user-123",
        },
      });
    });

    it("should throw 403 for unauthorized user", async () => {
      vi.mocked(prisma.study.findUnique).mockResolvedValue({
        ...mockStudy,
        createdByUserId: "other-user",
      } as any);
      vi.mocked(prisma.teamMembership.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.companyMembership.findFirst).mockResolvedValue(null);

      await expect(
        dbRegenerateStudyShareToken({
          studyId: "study-123",
          userId: "unauthorized-user",
        })
      ).rejects.toThrow("User not authorized to regenerate share token");
    });
  });

  describe("dbGetStudyByShareToken", () => {
    const mockSharedStudy = {
      id: "study-123",
      teamId: "team-123",
      createdByUserId: "user-123",
      visibility: "PRIVATE",
      shareToken: "valid-token",
      name: "Shared Study",
      files: [],
      createdByUser: { id: "user-123", name: "Test User" },
    };

    it("should return study for valid share token", async () => {
      vi.mocked(prisma.study.findUnique).mockResolvedValue(
        mockSharedStudy as any
      );

      const result = await dbGetStudyByShareToken("valid-token");

      expect(result).toBeDefined();
      expect(result?.id).toBe("study-123");
      expect(prisma.study.findUnique).toHaveBeenCalledWith({
        where: { shareToken: "valid-token" },
        include: expect.any(Object),
      });
    });

    it("should return null for non-existent token", async () => {
      vi.mocked(prisma.study.findUnique).mockResolvedValue(null);

      const result = await dbGetStudyByShareToken("invalid-token");

      expect(result).toBeNull();
    });
  });
});
