// @ts-nocheck

import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { auth } from "@/apps/nextjs-app/auth";
import { logger } from "@/apps/shared/logger";

// ==========================================
// Action Result Types
// ==========================================

/**
 * Standard result type for server actions.
 * Use this for actions that can fail and need to communicate status to the client.
 *
 * Pattern guidelines:
 * - Exported server actions should return ActionResult for consistent error handling
 * - Internal helpers can throw errors (caught by the action's try/catch)
 * - Fire-and-forget operations (cleanup, alerts) can return void and log errors
 */
export type ActionResult<T = undefined> =
  | { success: true; data?: T }
  | { success: false; error: string };

/** ActionResult with validation details for schema parsing errors */
export type ValidationResult<T = undefined> =
  | { success: true; data?: T }
  | { success: false; error: string; details?: z.ZodIssue[] };

/**
 * Creates a successful action result.
 */
export function actionSuccess<T>(data?: T): ActionResult<T> {
  return data !== undefined ? { success: true, data } : { success: true };
}

/**
 * Creates a failed action result.
 */
export function actionError(error: string): ActionResult<never> {
  return { success: false, error };
}

/**
 * Creates a validation error result with optional details.
 */
export function validationError(
  error: string,
  details?: z.ZodIssue[],
): ValidationResult<never> {
  return details
    ? { success: false, error, details }
    : { success: false, error };
}

/** Authenticated user with guaranteed id */
export interface AuthenticatedUser {
  id: string;
  email?: string | null;
}

/**
 * Helper to require authenticated user in server actions.
 * Throws an error if user is not authenticated, which will be caught
 * by the action's error handler and shown to the user.
 */
export async function requireAuth(): Promise<AuthenticatedUser> {
  const session = await auth();
  if (!session?.user?.id) {
    logger.warn("Server action called without authenticated user");
    throw new Error("Your session has expired. Please sign in again.");
  }
  return {
    id: session.user.id,
    email: session.user.email,
  };
}

// ==========================================
// Visibility & Role Constants
// ==========================================

// Visibility levels for personas/studies (matches Prisma StudyVisibility enum - uppercase)
export const VISIBILITY_PRIVATE = "PRIVATE" as const;
export const VISIBILITY_TEAM = "TEAM" as const;
export const VISIBILITY_COMPANY = "COMPANY" as const;

// Company member roles (matches Prisma enum - uppercase)
export const ROLE_OWNER = "OWNER" as const;

// ==========================================
// Utility Functions
// ==========================================

/**
 * Generates a random file name with UUID prefix.
 */
export function generateRandomFileName(originalFileName: string): string {
  const fileExtension = originalFileName.split(".").pop();
  const uniqueId = uuidv4();
  return `${uniqueId}.${fileExtension}`;
}
