import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { redirect } from "next/navigation";
import { auth } from "@/apps/nextjs-app/auth";
import { logger } from "@/apps/shared/logger";
import {
  getCompanyByMyDomain,
  getCompanyMembers,
  getCompanyTeams,
  getUserTeams,
} from "@/apps/nextjs-app/lib/data";

// ==========================================
// Types & Interfaces
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
  | { success: true; data: T }
  | { success: false; error: string };

/** ActionResult with validation details for schema parsing errors */
export type ValidationResult<T = undefined> =
  | { success: true; data: T }
  | { success: false; error: string; details?: z.ZodIssue[] };

/** Authenticated user with guaranteed id */
export interface AuthenticatedUser {
  id: string;
  email?: string | null;
}

/** Company user for authorization checks */
interface CompanyUser {
  userId: string;
  role: string;
}

/** Company with users for authorization checks */
interface CompanyWithUsers {
  companyUsers?: CompanyUser[];
}

/** Team member structure from company teams API */
interface TeamMember {
  id: string;
  teamId: string;
  userId: string;
  role: string;
  joinedAt: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
    lastAccessedAt?: string | null;
  };
}

/** Company team structure from API */
interface CompanyTeam {
  id: string;
  name: string;
  isPersonal: boolean;
  isDefaultForCompany: boolean;
  credits: number;
  createdAt: string;
  memberCount: number;
  members: TeamMember[];
}

// ==========================================
// Constants
// ==========================================

// Visibility levels for personas/studies (matches Prisma StudyVisibility enum - uppercase)
export const VISIBILITY_PRIVATE = "PRIVATE" as const;
export const VISIBILITY_TEAM = "TEAM" as const;
export const VISIBILITY_COMPANY = "COMPANY" as const;

// Company member roles (matches Prisma enum - uppercase)
export const ROLE_OWNER = "OWNER" as const;
export const ROLE_ADMIN = "ADMIN" as const;

// ==========================================
// Result Factory Functions
// ==========================================

/**
 * Creates a successful action result.
 */
export function actionSuccess(): ActionResult<undefined>;
export function actionSuccess<T>(data: T): ActionResult<T>;
export function actionSuccess<T>(data?: T): ActionResult<T | undefined> {
  return { success: true, data: data as T };
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

// ==========================================
// Authentication
// ==========================================

/**
 * Helper to require authenticated user in server actions.
 * Redirects to signin if user is not authenticated.
 */
export async function requireAuth(): Promise<AuthenticatedUser> {
  const session = await auth();
  if (!session?.user?.id) {
    logger.warn("Server action called without authenticated user");
    redirect("/signin");
  }
  return {
    id: session.user.id,
    email: session.user.email,
  };
}

// ==========================================
// Role Utilities
// ==========================================

/**
 * Normalize a role string for comparison (uppercase).
 * Handles null/undefined gracefully.
 */
export function normalizeRole(role: string | null | undefined): string {
  return String(role ?? "").toUpperCase();
}

/**
 * Check if a role is an admin-level role (ADMIN or OWNER).
 */
export function isAdminRole(role: string | null | undefined): boolean {
  const normalized = normalizeRole(role);
  return normalized === ROLE_ADMIN || normalized === ROLE_OWNER;
}

// ==========================================
// General Utilities
// ==========================================

/**
 * Generates a random file name with UUID prefix.
 */
export function generateRandomFileName(originalFileName: string): string {
  const fileExtension = originalFileName.split(".").pop();
  const uniqueId = uuidv4();
  return `${uniqueId}.${fileExtension}`;
}

// ==========================================
// Authorization
// ==========================================

// --- Company Admin Helpers ---

/**
 * Checks if a user is an admin for the given company.
 * @param userCompany - Company data with companyUsers array
 * @param userId - The user ID to check
 * @returns true if user is an admin or owner, false otherwise
 */
export function isCompanyAdmin(
  userCompany: CompanyWithUsers | null | undefined,
  userId: string,
): boolean {
  return (
    userCompany?.companyUsers?.some(
      (cu) => cu.userId === userId && isAdminRole(cu.role),
    ) ?? false
  );
}

/**
 * Requires the user to be a company admin.
 * Throws an error if the user is not an admin.
 * @param userCompany - Company data with companyUsers array
 * @param userId - The user ID to check
 * @param errorMessage - Custom error message (optional)
 */
export function requireCompanyAdmin(
  userCompany: CompanyWithUsers | null | undefined,
  userId: string,
  errorMessage = "Only company administrators can perform this action",
): void {
  if (!isCompanyAdmin(userCompany, userId)) {
    throw new Error(errorMessage);
  }
}

// --- Team Admin Helpers ---

/**
 * Check if user owns the personal team.
 */
export function isPersonalTeamOwner(
  userTeams: Array<{ id: string; isPersonal: boolean }>,
  teamId: string,
): boolean {
  return userTeams.some((t) => t.isPersonal && t.id === teamId);
}

/**
 * Check if user has admin access to a non-company team.
 */
export function hasDirectTeamAdminAccess(
  userTeams: Array<{ id: string; role?: string }>,
  teamId: string,
): boolean {
  const team = userTeams.find((t) => t.id === teamId);
  return team ? isAdminRole(team.role) : false;
}

/**
 * Check if user has admin access to a company team.
 */
export async function hasCompanyTeamAdminAccess(
  userId: string,
  teamId: string,
  companyId: string,
): Promise<boolean> {
  const members = await getCompanyMembers(companyId);
  const currentUser = members.find((m) => m.userId === userId);

  if (!currentUser || currentUser.status === "DEACTIVATED") {
    return false;
  }

  const userIsCompanyAdmin = isAdminRole(currentUser.role);
  const companyTeams = await getCompanyTeams(companyId);
  const teamBelongsToCompany = companyTeams.some(
    (t: CompanyTeam) => t.id === teamId,
  );

  // Company admins can access all company teams
  if (userIsCompanyAdmin && teamBelongsToCompany) {
    return true;
  }

  // Check if user is a team-level admin
  const team = companyTeams.find((t: CompanyTeam) => t.id === teamId);
  if (!team) {
    return false;
  }

  const membership = team.members?.find((m: TeamMember) => m.userId === userId);
  return isAdminRole(membership?.role);
}

/**
 * Verify that a user has admin access to a team.
 * Checks personal team ownership, company admin status, and team-level admin status.
 */
export async function verifyTeamAdminAccess(
  userId: string,
  teamId: string,
): Promise<boolean> {
  try {
    const [domainInfo, userTeams] = await Promise.all([
      getCompanyByMyDomain(),
      getUserTeams(userId),
    ]);

    // Personal team owners always have access
    if (isPersonalTeamOwner(userTeams, teamId)) {
      return true;
    }

    // Check company team access if user belongs to a company
    if (domainInfo?.company) {
      return hasCompanyTeamAdminAccess(userId, teamId, domainInfo.company.id);
    }

    // Fall back to direct team membership check
    return hasDirectTeamAdminAccess(userTeams, teamId);
  } catch (error) {
    logger.error("Error verifying team admin access", {
      error,
      userId,
      teamId,
    });
    return false;
  }
}

/**
 * Requires the user to be a team admin.
 * Throws an error if the user does not have admin access to the team.
 * @param userId - The user ID to check
 * @param teamId - The team ID to check access for
 * @param errorMessage - Custom error message (optional)
 */
export async function requireTeamAdmin(
  userId: string,
  teamId: string,
  errorMessage = "Only team administrators can perform this action",
): Promise<void> {
  const hasAccess = await verifyTeamAdminAccess(userId, teamId);
  if (!hasAccess) {
    throw new Error(errorMessage);
  }
}
