import { z } from "zod";
import {
  TEAM_NAME_MIN_LENGTH,
  TEAM_NAME_MAX_LENGTH,
} from "@/apps/shared/constants";

/**
 * Schema for member role assignment
 */
export const memberRoleSchema = z.enum(["ADMIN", "MEMBER"]);

/**
 * Schema for a member to be added to a team
 */
export const getTeamMemberInputSchema = (t: any) =>
  z.object({
    userId: z.string().min(1, t("validation.userIdRequired")),
    role: memberRoleSchema,
    email: z.string().email().optional(),
  });

export const teamMemberInputSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  role: memberRoleSchema,
  email: z.string().email().optional(),
});

/**
 * Schema for creating a new team
 */
export const getCreateTeamSchema = (t: any) =>
  z.object({
    name: z
      .string()
      .min(
        TEAM_NAME_MIN_LENGTH,
        t("validation.teamNameMin", { min: TEAM_NAME_MIN_LENGTH })
      )
      .max(
        TEAM_NAME_MAX_LENGTH,
        t("validation.teamNameMax", { max: TEAM_NAME_MAX_LENGTH })
      )
      .transform((val) => val.trim()),
    members: z.array(getTeamMemberInputSchema(t)).optional().default([]),
  });

export const createTeamSchema = z.object({
  name: z
    .string()
    .min(TEAM_NAME_MIN_LENGTH, `Team name must be at least ${TEAM_NAME_MIN_LENGTH} characters`)
    .max(TEAM_NAME_MAX_LENGTH, `Team name must be at most ${TEAM_NAME_MAX_LENGTH} characters`)
    .transform((val) => val.trim()),
  members: z.array(teamMemberInputSchema).optional().default([]),
});

/**
 * Schema for adding members to an existing team
 */
export const getAddMembersSchema = (t: any) =>
  z.object({
    teamId: z.string().min(1, t("validation.teamIdRequired")),
    teamName: z.string().min(1, t("validation.teamNameRequired")),
    members: z
      .array(getTeamMemberInputSchema(t))
      .min(1, t("validation.membersRequired")),
  });

export const addMembersSchema = z.object({
  teamId: z.string().min(1, "Team ID is required"),
  teamName: z.string().min(1, "Team name is required"),
  members: z
    .array(teamMemberInputSchema)
    .min(1, "At least one member must be selected"),
});

/**
 * Schema for updating a team name
 */
export const getUpdateTeamNameSchema = (t: any) =>
  z.object({
    name: z
      .string()
      .min(
        TEAM_NAME_MIN_LENGTH,
        t("validation.teamNameMin", { min: TEAM_NAME_MIN_LENGTH })
      )
      .max(
        TEAM_NAME_MAX_LENGTH,
        t("validation.teamNameMax", { max: TEAM_NAME_MAX_LENGTH })
      )
      .transform((val) => val.trim()),
  });

export const updateTeamNameSchema = z.object({
  name: z
    .string()
    .min(TEAM_NAME_MIN_LENGTH, `Team name must be at least ${TEAM_NAME_MIN_LENGTH} characters`)
    .max(TEAM_NAME_MAX_LENGTH, `Team name must be at most ${TEAM_NAME_MAX_LENGTH} characters`)
    .transform((val) => val.trim()),
});

/**
 * Schema for updating a team description
 */
export const getUpdateTeamDescriptionSchema = (t: any) =>
  z.object({
    description: z
      .string()
      .max(500, t("validation.descriptionMax", { max: 500 }))
      .transform((val) => val.trim() || null)
      .nullable(),
  });

export const updateTeamDescriptionSchema = z.object({
  description: z
    .string()
    .max(500, "Description must be at most 500 characters")
    .transform((val) => val.trim() || null)
    .nullable(),
});

// Type exports for use in components
export type MemberRole = z.infer<typeof memberRoleSchema>;
export type TeamMemberInput = z.infer<typeof teamMemberInputSchema>;
export type CreateTeamInput = z.infer<typeof createTeamSchema>;
export type AddMembersInput = z.infer<typeof addMembersSchema>;
export type UpdateTeamNameInput = z.infer<typeof updateTeamNameSchema>;
export type UpdateTeamDescriptionInput = z.infer<typeof updateTeamDescriptionSchema>;
