import { describe, it, expect, vi, beforeEach } from "vitest";
import prisma from "@/apps/db-worker/src/services/db.ts";
import {
  dbGetTeam,
  dbListUserTeams,
  dbCreateTeam,
  dbUpdateTeamName,
  dbUpdateTeamDescription,
  dbListCompanyTeams,
} from "../index.ts";

describe("teamService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("dbGetTeam", () => {
    it("should return team with active memberships", async () => {
      const mockTeam = {
        id: "team-123",
        name: "Test Team",
        memberships: [
          {
            user: {
              id: "user-1",
              name: "User One",
              email: "user1@example.com",
              image: null,
              status: "ACTIVE",
            },
          },
        ],
      };

      vi.mocked(prisma.team.findUnique).mockResolvedValue(mockTeam as any);

      const result = await dbGetTeam("team-123");

      expect(prisma.team.findUnique).toHaveBeenCalledWith({
        where: { id: "team-123" },
        include: {
          memberships: {
            where: { status: "ACTIVE" },
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  image: true,
                  status: true,
                },
              },
            },
          },
        },
      });
      expect(result).toEqual(mockTeam);
    });

    it("should return null when team not found", async () => {
      vi.mocked(prisma.team.findUnique).mockResolvedValue(null);

      const result = await dbGetTeam("nonexistent");

      expect(result).toBeNull();
    });
  });

  describe("dbListUserTeams", () => {
    it("should return list of user teams", async () => {
      const mockMemberships = [
        {
          role: "OWNER",
          team: {
            id: "team-1",
            name: "Team One",
            isPersonal: false,
            companyId: "company-123",
            credits: 100,
            joinPolicy: "INVITE_ONLY",
            isDefaultForCompany: false,
            company: { id: "company-123", name: "Test Company", disablePersonalTeams: false },
          },
        },
        {
          role: "MEMBER",
          team: {
            id: "team-2",
            name: "Personal",
            isPersonal: true,
            companyId: null,
            credits: 10,
            joinPolicy: "INVITE_ONLY",
            isDefaultForCompany: false,
            company: null,
          },
        },
      ];

      vi.mocked(prisma.teamMembership.findMany).mockResolvedValue(
        mockMemberships as any
      );

      const result = await dbListUserTeams("user-123");

      expect(prisma.teamMembership.findMany).toHaveBeenCalledWith({
        where: { userId: "user-123", status: "ACTIVE" },
        include: expect.any(Object),
        orderBy: { joinedAt: "asc" },
      });
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("Team One");
      expect(result[0].role).toBe("OWNER");
      expect(result[1].isPersonal).toBe(true);
    });

    it("should return empty array when user has no teams", async () => {
      vi.mocked(prisma.teamMembership.findMany).mockResolvedValue([]);

      const result = await dbListUserTeams("user-123");

      expect(result).toHaveLength(0);
    });
  });

  describe("dbCreateTeam", () => {
    it("should create team when user is company admin", async () => {
      vi.mocked(prisma.companyMembership.findUnique).mockResolvedValue({
        role: "ADMIN",
        status: "ACTIVE",
        deactivatedAt: null,
        user: { status: "ACTIVE" },
      } as any);
      vi.mocked(prisma.team.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.team.create).mockResolvedValue({
        id: "team-new",
        name: "New Team",
        companyId: "company-123",
      } as any);

      const result = await dbCreateTeam({
        companyId: "company-123",
        userId: "user-123",
        name: "New Team",
      });

      expect(prisma.team.create).toHaveBeenCalledWith({
        data: {
          companyId: "company-123",
          name: "New Team",
          createdByUserId: "user-123",
        },
      });
      expect(result.name).toBe("New Team");
    });

    it("should throw 403 when user is not company admin", async () => {
      vi.mocked(prisma.companyMembership.findUnique).mockResolvedValue({
        role: "MEMBER",
        status: "ACTIVE",
        deactivatedAt: null,
        user: { status: "ACTIVE" },
      } as any);

      await expect(
        dbCreateTeam({
          companyId: "company-123",
          userId: "user-123",
          name: "New Team",
        })
      ).rejects.toThrow("Not authorized to create teams");
    });

    it("should throw error for reserved team names", async () => {
      vi.mocked(prisma.companyMembership.findUnique).mockResolvedValue({
        role: "ADMIN",
        status: "ACTIVE",
        deactivatedAt: null,
        user: { status: "ACTIVE" },
      } as any);

      await expect(
        dbCreateTeam({
          companyId: "company-123",
          userId: "user-123",
          name: "Personal",
        })
      ).rejects.toThrow("This team name is reserved");
    });

    it("should throw error for duplicate team names", async () => {
      vi.mocked(prisma.companyMembership.findUnique).mockResolvedValue({
        role: "ADMIN",
        status: "ACTIVE",
        deactivatedAt: null,
        user: { status: "ACTIVE" },
      } as any);
      vi.mocked(prisma.team.findFirst).mockResolvedValue({
        id: "existing-team",
      } as any);

      await expect(
        dbCreateTeam({
          companyId: "company-123",
          userId: "user-123",
          name: "Existing Team",
        })
      ).rejects.toThrow("A team with this name already exists");
    });

    it("should throw error for too short team names", async () => {
      vi.mocked(prisma.companyMembership.findUnique).mockResolvedValue({
        role: "ADMIN",
        status: "ACTIVE",
        deactivatedAt: null,
        user: { status: "ACTIVE" },
      } as any);

      await expect(
        dbCreateTeam({
          companyId: "company-123",
          userId: "user-123",
          name: "A",
        })
      ).rejects.toThrow("Team name must be between 2 and 50 characters");
    });
  });

  describe("dbUpdateTeamName", () => {
    it("should update team name for team admin", async () => {
      vi.mocked(prisma.team.findUnique).mockResolvedValue({
        id: "team-123",
        name: "Old Name",
        companyId: "company-123",
        isPersonal: false,
        createdByUserId: "other-user",
      } as any);
      vi.mocked(prisma.teamMembership.findUnique).mockResolvedValue({
        role: "ADMIN",
      } as any);
      vi.mocked(prisma.team.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.team.update).mockResolvedValue({
        id: "team-123",
        name: "New Name",
        companyId: "company-123",
        isPersonal: false,
      } as any);

      const result = await dbUpdateTeamName({
        teamId: "team-123",
        userId: "user-123",
        name: "New Name",
      });

      expect(result.name).toBe("New Name");
    });

    it("should throw 404 when team not found", async () => {
      vi.mocked(prisma.team.findUnique).mockResolvedValue(null);

      await expect(
        dbUpdateTeamName({
          teamId: "nonexistent",
          userId: "user-123",
          name: "New Name",
        })
      ).rejects.toThrow("Team not found");
    });

    it("should throw 403 when user not authorized", async () => {
      vi.mocked(prisma.team.findUnique).mockResolvedValue({
        id: "team-123",
        name: "Old Name",
        companyId: null,
        isPersonal: false,
        createdByUserId: "other-user",
      } as any);
      vi.mocked(prisma.teamMembership.findUnique).mockResolvedValue({
        role: "MEMBER",
      } as any);

      await expect(
        dbUpdateTeamName({
          teamId: "team-123",
          userId: "user-123",
          name: "New Name",
        })
      ).rejects.toThrow("Not authorized to rename this team");
    });

    it("should return unchanged team if name is same", async () => {
      const team = {
        id: "team-123",
        name: "Same Name",
        companyId: null,
        isPersonal: false,
        createdByUserId: "user-123",
      };
      vi.mocked(prisma.team.findUnique).mockResolvedValue(team as any);
      vi.mocked(prisma.teamMembership.findUnique).mockResolvedValue(null);

      const result = await dbUpdateTeamName({
        teamId: "team-123",
        userId: "user-123",
        name: "Same Name",
      });

      expect(prisma.team.update).not.toHaveBeenCalled();
      expect(result).toEqual(team);
    });
  });

  describe("dbUpdateTeamDescription", () => {
    it("should update team description", async () => {
      vi.mocked(prisma.team.findUnique).mockResolvedValue({
        id: "team-123",
        description: "Old description",
        companyId: null,
        isPersonal: false,
        createdByUserId: "user-123",
      } as any);
      vi.mocked(prisma.teamMembership.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.team.update).mockResolvedValue({
        id: "team-123",
        description: "New description",
        companyId: null,
        isPersonal: false,
      } as any);

      const result = await dbUpdateTeamDescription({
        teamId: "team-123",
        userId: "user-123",
        description: "New description",
      });

      expect(result.description).toBe("New description");
    });

    it("should throw 404 when team not found", async () => {
      vi.mocked(prisma.team.findUnique).mockResolvedValue(null);

      await expect(
        dbUpdateTeamDescription({
          teamId: "nonexistent",
          userId: "user-123",
          description: "Description",
        })
      ).rejects.toThrow("Team not found");
    });
  });

  describe("dbListCompanyTeams", () => {
    it("should list all company teams", async () => {
      vi.mocked(prisma.company.findUnique).mockResolvedValue({
        disablePersonalTeams: false,
      } as any);
      vi.mocked(prisma.team.findMany).mockResolvedValue([
        {
          id: "team-1",
          name: "Team One",
          description: null,
          isPersonal: false,
          isDefaultForCompany: true,
          joinPolicy: "AUTO_JOIN",
          credits: 100,
          createdAt: new Date(),
          _count: { memberships: 5 },
          memberships: [],
        },
      ] as any);

      const result = await dbListCompanyTeams("company-123");

      expect(prisma.team.findMany).toHaveBeenCalledWith({
        where: { companyId: "company-123" },
        include: expect.any(Object),
        orderBy: { createdAt: "desc" },
      });
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Team One");
      expect(result[0].memberCount).toBe(5);
    });

    it("should exclude personal teams when disabled", async () => {
      vi.mocked(prisma.company.findUnique).mockResolvedValue({
        disablePersonalTeams: true,
      } as any);
      vi.mocked(prisma.team.findMany).mockResolvedValue([]);

      await dbListCompanyTeams("company-123");

      expect(prisma.team.findMany).toHaveBeenCalledWith({
        where: { companyId: "company-123", isPersonal: false },
        include: expect.any(Object),
        orderBy: { createdAt: "desc" },
      });
    });
  });
});
