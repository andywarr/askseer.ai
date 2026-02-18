import { describe, it, expect } from "vitest";
import {
  useTeamPermissions,
  canRenameTeam,
  canInviteToTeam,
} from "./use-team-permissions";
import { renderHook } from "@testing-library/react";
import type { Team } from "./types";

// Mock team data factory
function createMockTeam(overrides: Partial<Team> = {}): Team {
  return {
    id: "team-1",
    name: "Test Team",
    description: null,
    joinPolicy: "INVITE_ONLY",
    isPersonal: false,
    isDefaultForCompany: false,
    credits: 100,
    createdAt: "2024-01-01T00:00:00Z",
    memberCount: 2,
    members: [
      {
        id: "member-1",
        teamId: "team-1",
        userId: "user-1",
        role: "OWNER",
        joinedAt: "2024-01-01T00:00:00Z",
        user: {
          id: "user-1",
          name: "Owner User",
          email: "owner@example.com",
          image: null,
        },
      },
      {
        id: "member-2",
        teamId: "team-1",
        userId: "user-2",
        role: "MEMBER",
        joinedAt: "2024-01-02T00:00:00Z",
        user: {
          id: "user-2",
          name: "Member User",
          email: "member@example.com",
          image: null,
        },
      },
    ],
    ...overrides,
  };
}

describe("useTeamPermissions hook", () => {
  it("should return null permissions when team is null", () => {
    const { result } = renderHook(() =>
      useTeamPermissions(null, "user-1", false)
    );

    expect(result.current.currentTeamRole).toBeNull();
    expect(result.current.canRename).toBe(false);
    expect(result.current.canInvite).toBe(false);
    expect(result.current.canUpdateJoinPolicy).toBe(false);
    expect(result.current.canRemoveMembers).toBe(false);
    expect(result.current.canChangeRoles).toBe(false);
  });

  it("should grant all permissions to company admin (canEdit=true)", () => {
    const team = createMockTeam();
    const { result } = renderHook(() =>
      useTeamPermissions(team, "user-3", true) // user-3 is not in team
    );

    expect(result.current.canRename).toBe(true);
    expect(result.current.canInvite).toBe(true);
    expect(result.current.canUpdateJoinPolicy).toBe(true);
    expect(result.current.canRemoveMembers).toBe(true);
    expect(result.current.canChangeRoles).toBe(true);
  });

  it("should grant admin permissions to team OWNER", () => {
    const team = createMockTeam();
    const { result } = renderHook(() =>
      useTeamPermissions(team, "user-1", false) // user-1 is OWNER
    );

    expect(result.current.currentTeamRole).toBe("OWNER");
    expect(result.current.canRename).toBe(true);
    expect(result.current.canInvite).toBe(true);
    expect(result.current.canUpdateJoinPolicy).toBe(true);
    expect(result.current.canRemoveMembers).toBe(true);
    expect(result.current.canChangeRoles).toBe(true);
  });

  it("should grant admin permissions to team ADMIN", () => {
    const team = createMockTeam({
      members: [
        {
          id: "member-1",
          teamId: "team-1",
          userId: "user-1",
          role: "ADMIN",
          joinedAt: "2024-01-01T00:00:00Z",
          user: {
            id: "user-1",
            name: "Admin User",
            email: "admin@example.com",
            image: null,
          },
        },
      ],
    });
    const { result } = renderHook(() =>
      useTeamPermissions(team, "user-1", false)
    );

    expect(result.current.currentTeamRole).toBe("ADMIN");
    expect(result.current.canRename).toBe(true);
    expect(result.current.canInvite).toBe(true);
    expect(result.current.canUpdateJoinPolicy).toBe(true);
    expect(result.current.canRemoveMembers).toBe(true);
    expect(result.current.canChangeRoles).toBe(true);
  });

  it("should deny permissions to regular MEMBER", () => {
    const team = createMockTeam();
    const { result } = renderHook(() =>
      useTeamPermissions(team, "user-2", false) // user-2 is MEMBER
    );

    expect(result.current.currentTeamRole).toBe("MEMBER");
    expect(result.current.canRename).toBe(false);
    expect(result.current.canInvite).toBe(false);
    expect(result.current.canUpdateJoinPolicy).toBe(false);
    expect(result.current.canRemoveMembers).toBe(false);
    expect(result.current.canChangeRoles).toBe(false);
  });

  it("should deny invite permission for personal teams", () => {
    const team = createMockTeam({ isPersonal: true });
    const { result } = renderHook(() =>
      useTeamPermissions(team, "user-1", false)
    );

    expect(result.current.canInvite).toBe(false);
    expect(result.current.canUpdateJoinPolicy).toBe(false);
    expect(result.current.canRemoveMembers).toBe(false);
    expect(result.current.canChangeRoles).toBe(false);
  });

  it("should deny join policy change for default company team", () => {
    const team = createMockTeam({ isDefaultForCompany: true });
    const { result } = renderHook(() =>
      useTeamPermissions(team, "user-1", false)
    );

    expect(result.current.canUpdateJoinPolicy).toBe(false);
  });
});

describe("canRenameTeam utility", () => {
  it("should return true for company admin", () => {
    const team = createMockTeam();
    expect(canRenameTeam(team, "user-3", true)).toBe(true);
  });

  it("should return true for team owner", () => {
    const team = createMockTeam();
    expect(canRenameTeam(team, "user-1", false)).toBe(true);
  });

  it("should return false for regular member", () => {
    const team = createMockTeam();
    expect(canRenameTeam(team, "user-2", false)).toBe(false);
  });
});

describe("canInviteToTeam utility", () => {
  it("should return false for personal teams", () => {
    const team = createMockTeam({ isPersonal: true });
    expect(canInviteToTeam(team, "user-1", true)).toBe(false);
  });

  it("should return true for company admin on non-personal team", () => {
    const team = createMockTeam();
    expect(canInviteToTeam(team, "user-3", true)).toBe(true);
  });

  it("should return true for team admin on non-personal team", () => {
    const team = createMockTeam();
    expect(canInviteToTeam(team, "user-1", false)).toBe(true);
  });

  it("should return false for regular member", () => {
    const team = createMockTeam();
    expect(canInviteToTeam(team, "user-2", false)).toBe(false);
  });
});
