/**
 * Zod validation schemas for request bodies.
 * These provide type-safe validation with clear error messages.
 */
import { z } from "zod";

// ============================================================================
// Heuristic Evaluation Schemas
// ============================================================================

export const CreateHEResultSchema = z.object({
  heuristicEvaluationId: z.string().min(1, "heuristicEvaluationId is required"),
  heuristicId: z.string().min(1, "heuristicId is required"),
  step: z.number().int().positive("step must be a positive integer"),
  fileId: z.string().min(1, "fileId is required"),
  reason: z.string().min(1, "reason is required"),
  severity: z.number().int().min(0).max(4, "severity must be between 0 and 4"),
  source: z.enum(["AI", "HUMAN", "AI_HUMAN"]),
  userId: z.string().optional(),
});

export const UpdateHEResultSchema = z.object({
  issue: z.string().optional(),
  severity: z.number().int().min(0).max(4).optional().nullable(),
  rating: z.enum(["GOOD", "BAD"]).optional().nullable(),
  userId: z.string().optional(),
});

export const CreateHERecommendationSchema = z.object({
  resultId: z.string().min(1, "resultId is required"),
  recommendation: z.string().min(1, "recommendation is required"),
  source: z.enum(["AI", "HUMAN", "AI_HUMAN"]),
  userId: z.string().optional(),
});

// ============================================================================
// Cognitive Walkthrough Schemas
// ============================================================================

export const CreateCWIssueSchema = z.object({
  stepId: z.string().min(1, "stepId is required"),
  issueType: z.string().min(1, "issueType is required"),
  issue: z.string().min(1, "issue is required"),
  source: z.enum(["AI", "HUMAN", "AI_HUMAN"]),
  userId: z.string().optional(),
});

export const CreateCWRecommendationSchema = z.object({
  issueId: z.string().min(1, "issueId is required"),
  recommendation: z.string().min(1, "recommendation is required"),
  source: z.enum(["AI", "HUMAN", "AI_HUMAN"]),
  userId: z.string().optional(),
});

// ============================================================================
// Heuristic Family Management Schemas
// ============================================================================

export const CreateHeuristicFamilySchema = z.object({
  name: z.string().min(1, "name is required").max(100),
  key: z.string().min(1, "key is required").max(50),
  description: z.string().optional(),
  companyId: z.string().min(1, "companyId is required"),
  userId: z.string().min(1, "userId is required"),
});

export const UpdateHeuristicFamilySchema = z.object({
  name: z.string().max(100).optional(),
  description: z.string().optional(),
  userId: z.string().min(1, "userId is required"),
  companyId: z.string().min(1, "companyId is required"),
});

export const CreateHeuristicSchema = z.object({
  heuristicFamilyId: z.string().min(1, "heuristicFamilyId is required"),
  heuristic: z.string().min(1, "heuristic is required"),
  category: z.string().optional(),
  label: z.string().optional(),
  description: z.string().optional(),
  userId: z.string().min(1, "userId is required"),
  companyId: z.string().min(1, "companyId is required"),
});

export const CreateHeuristicExampleSchema = z.object({
  heuristicId: z.string().min(1, "heuristicId is required"),
  title: z.string().optional(),
  description: z.string().min(1, "description is required"),
  userId: z.string().min(1, "userId is required"),
  companyId: z.string().min(1, "companyId is required"),
  createdById: z.string().optional(),
});

// ============================================================================
// Team Schemas
// ============================================================================

export const CreateTeamSchema = z.object({
  companyId: z.string().min(1, "companyId is required"),
  userId: z.string().min(1, "userId is required"),
  name: z.string().min(1, "name is required"),
  members: z.array(z.object({
    userId: z.string(),
    role: z.enum(["OWNER", "ADMIN", "MEMBER", "VIEWER"]),
  })).optional(),
});

export const AddTeamMembersSchema = z.object({
  teamId: z.string().min(1, "teamId is required"),
  invitedById: z.string().min(1, "invitedById is required"),
  members: z.array(z.object({
    userId: z.string().min(1),
    role: z.enum(["ADMIN", "MEMBER", "VIEWER"]),
  })).min(1, "At least one member is required"),
});

// ============================================================================
// Notification Schemas
// ============================================================================

export const CreateNotificationSchema = z.object({
  userId: z.string().min(1, "userId is required"),
  type: z.string().min(1, "type is required"),
  audience: z.enum(["USER", "ADMIN"]).optional(),
  title: z.string().min(1, "title is required"),
  message: z.string().optional().nullable(),
  actionUrl: z.string().optional().nullable(),
  metadata: z.record(z.unknown()).optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable(),
});

// ============================================================================
// Study Schemas
// ============================================================================

export const InitStudySchema = z.object({
  userId: z.string().min(1, "userId is required"),
  teamId: z.string().min(1, "teamId is required"),
  name: z.string().optional(),
  type: z.enum(["HEURISTIC_EVALUATION", "COGNITIVE_WALKTHROUGH", "PERSONA"]),
});

export const UpdateStudyVisibilitySchema = z.object({
  studyId: z.string().min(1, "studyId is required"),
  visibility: z.enum(["PRIVATE", "TEAM", "COMPANY"]),
  userId: z.string().min(1, "userId is required"),
});

// Export types for use in controllers
export type CreateHEResult = z.infer<typeof CreateHEResultSchema>;
export type CreateHeuristicFamily = z.infer<typeof CreateHeuristicFamilySchema>;
export type CreateHeuristic = z.infer<typeof CreateHeuristicSchema>;
export type CreateNotification = z.infer<typeof CreateNotificationSchema>;
export type InitStudy = z.infer<typeof InitStudySchema>;
