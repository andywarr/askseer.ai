import { describe, it, expect } from "vitest";
import {
  createTeamSchema,
  addMembersSchema,
  updateTeamNameSchema,
  updateTeamDescriptionSchema,
} from "./schemas";

describe("createTeamSchema", () => {
  it("should accept valid team data", () => {
    const result = createTeamSchema.safeParse({
      name: "Engineering Team",
      members: [
        { userId: "user-1", role: "ADMIN" },
        { userId: "user-2", role: "MEMBER" },
      ],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Engineering Team");
      expect(result.data.members).toHaveLength(2);
    }
  });

  it("should reject team name shorter than 3 characters", () => {
    const result = createTeamSchema.safeParse({
      name: "AB",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0].message).toContain("at least 3");
    }
  });

  it("should reject team name longer than 50 characters", () => {
    const result = createTeamSchema.safeParse({
      name: "A".repeat(51),
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0].message).toContain("at most 50");
    }
  });

  it("should trim whitespace from team name", () => {
    const result = createTeamSchema.safeParse({
      name: "  Trimmed Team  ",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Trimmed Team");
    }
  });

  it("should accept empty members array", () => {
    const result = createTeamSchema.safeParse({
      name: "Solo Team",
      members: [],
    });

    expect(result.success).toBe(true);
  });

  it("should reject invalid member role", () => {
    const result = createTeamSchema.safeParse({
      name: "Test Team",
      members: [{ userId: "user-1", role: "INVALID" }],
    });

    expect(result.success).toBe(false);
  });
});

describe("addMembersSchema", () => {
  it("should accept valid add members data", () => {
    const result = addMembersSchema.safeParse({
      teamId: "team-1",
      teamName: "Engineering",
      members: [{ userId: "user-1", role: "MEMBER" }],
    });

    expect(result.success).toBe(true);
  });

  it("should require at least one member", () => {
    const result = addMembersSchema.safeParse({
      teamId: "team-1",
      teamName: "Engineering",
      members: [],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0].message).toContain("At least one member");
    }
  });

  it("should require teamId", () => {
    const result = addMembersSchema.safeParse({
      teamId: "",
      teamName: "Engineering",
      members: [{ userId: "user-1", role: "MEMBER" }],
    });

    expect(result.success).toBe(false);
  });
});

describe("updateTeamNameSchema", () => {
  it("should accept valid team name", () => {
    const result = updateTeamNameSchema.safeParse({
      name: "New Team Name",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("New Team Name");
    }
  });

  it("should trim whitespace", () => {
    const result = updateTeamNameSchema.safeParse({
      name: "  Padded Name  ",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Padded Name");
    }
  });
});

describe("updateTeamDescriptionSchema", () => {
  it("should accept valid description", () => {
    const result = updateTeamDescriptionSchema.safeParse({
      description: "A great team for building things",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.description).toBe("A great team for building things");
    }
  });

  it("should convert empty string to null", () => {
    const result = updateTeamDescriptionSchema.safeParse({
      description: "",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.description).toBeNull();
    }
  });

  it("should convert whitespace-only to null", () => {
    const result = updateTeamDescriptionSchema.safeParse({
      description: "   ",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.description).toBeNull();
    }
  });

  it("should accept null", () => {
    const result = updateTeamDescriptionSchema.safeParse({
      description: null,
    });

    expect(result.success).toBe(true);
  });

  it("should reject description longer than 500 characters", () => {
    const result = updateTeamDescriptionSchema.safeParse({
      description: "A".repeat(501),
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0].message).toContain("at most 500");
    }
  });
});
