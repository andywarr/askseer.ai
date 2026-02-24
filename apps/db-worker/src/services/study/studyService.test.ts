import { describe, it, expect, vi, beforeEach } from "vitest";
import prisma from "@/apps/db-worker/src/services/db.ts";
import {
  dbInitStudy,
  dbFinalizeStudy,
  dbGetStudy,
  dbGetStudies,
  dbDeleteStudy,
  dbUpdateStudyVisibility,
  dbRegenerateStudyShareToken,
  dbGetStudyByShareToken,
} from "../index.ts";

// Mock environment variables
process.env.AWS_BUCKET = "test-bucket";

describe("studyService - Study Operations", () => {
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
        include: {
          files: true,
          createdByUser: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
              imageKey: true,
              status: true,
            },
          },
          lastModifiedByUser: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
              imageKey: true,
              status: true,
            },
          },
        },
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
              _count: {
                select: {
                  cognitiveWalkthroughs: true,
                  heuristicEvaluations: true,
                },
              },
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
          qualitativeAnalysis: {
            select: {
              coverImageKey: true,
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
              _count: {
                select: {
                  cognitiveWalkthroughs: true,
                  heuristicEvaluations: true,
                },
              },
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
          qualitativeAnalysis: {
            select: {
              coverImageKey: true,
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

describe("studyService - Study Sharing Operations", () => {
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
      vi.mocked(prisma.study.update).mockReset();
      vi.mocked(prisma.study.findUnique).mockResolvedValue({
        ...mockStudy,
        createdByUserId: "other-user",
        team: { companyId: null },
      } as any);
      vi.mocked(prisma.teamMembership.findUnique).mockResolvedValue(null);

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
      vi.mocked(prisma.study.update).mockReset();
      vi.mocked(prisma.study.findUnique).mockResolvedValue({
        ...mockStudy,
        createdByUserId: "other-user",
        team: { companyId: null },
      } as any);
      vi.mocked(prisma.teamMembership.findUnique).mockResolvedValue(null);

      await expect(
        dbRegenerateStudyShareToken({
          studyId: "study-123",
          userId: "unauthorized-user",
        })
      ).rejects.toThrow("User not authorized to access study");
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
