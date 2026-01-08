import "server-only";

import { cache } from "react";
import { isAuthenticated } from "@/apps/nextjs-app/lib/db/dal";
import {
  getUser,
  getCompanyByMyDomain,
  getCompanyMembers,
} from "@/apps/nextjs-app/lib/db/data";
import { logger } from "@/apps/shared/logger";
import { redirect } from "next/navigation";

/**
 * Cached function to get the current authenticated user.
 * This can be called from any server component and will return the same user
 * for the same request due to React's cache function.
 *
 * The authentication and user existence checks are performed here,
 * so individual pages don't need to handle these cases.
 */
export const getCurrentUser = cache(async () => {
  const session = await getCurrentSession();

  const user = await getUser(session.userId);

  if (!user) {
    logger.error("User not found", { userId: session.userId });
    redirect("/error");
  }

  logger.debug("User retrieved successfully", {
    userId: user.id,
  });

  return { user, session };
});

/**
 * Cached function to get only session data for pages that don't need user object.
 * This is more efficient than getCurrentUser() when you only need session.userId.
 *
 * Since the layout calls getCurrentUser(), authentication is already verified,
 * but this function can still be used for pages that only need session data.
 */
export const getCurrentSession = cache(async () => {
  const session = await isAuthenticated();

  if (!session) {
    logger.warn("User session not found", { session });
    redirect("/");
  }

  return session;
});

/**
 * Check if the current user has permission to create personas.
 * Returns true if user is not in a company or if their company membership allows persona creation.
 * Returns false if user is in a company and their membership has canCreatePersonas set to false.
 */
export async function canUserCreatePersonas(userId: string): Promise<boolean> {
  try {
    const domainInfo = await getCompanyByMyDomain();

    // If user is not in a company, they can create personas
    if (!domainInfo.company?.id) {
      return true;
    }

    // Check user's company membership permissions
    const members = await getCompanyMembers(domainInfo.company.id);
    const membership = members.find((member) => member.userId === userId);

    // If membership found, return their permission; otherwise default to true
    return membership?.canCreatePersonas ?? true;
  } catch (error) {
    logger.warn("Unable to determine persona permissions, defaulting to true", {
      userId,
      error,
    });
    // On error, default to allowing persona creation
    return true;
  }
}

/**
 * Check if the current user has permission to purchase credits.
 * Returns true if:
 * - User is not in a company (consumer), OR
 * - User is a company admin/owner, OR
 * - User is a team admin/owner, OR
 * - User is in a company but personal teams are NOT disabled
 */
export async function canUserPurchaseCredits(userId: string): Promise<boolean> {
  try {
    const domainInfo = await getCompanyByMyDomain();

    // If user is not in a company (consumer), they can purchase credits
    if (!domainInfo.company?.id) {
      return true;
    }

    // Import here to avoid circular dependency
    const { getCompanyTeams, getUserTeams, getUserCompanyRole } = await import(
      "@/apps/nextjs-app/lib/db/data"
    );

    const membershipRole = await getUserCompanyRole(
      userId,
      domainInfo.company.id,
    );

    // Company admins/owners can always purchase credits
    if (membershipRole === "ADMIN" || membershipRole === "OWNER") {
      return true;
    }

    // Check if user is a team admin
    const teams = await getCompanyTeams(domainInfo.company.id);
    const isTeamAdmin = teams.some(
      (team: any) =>
        !team.isPersonal &&
        (team.members || []).some(
          (member: any) =>
            member.userId === userId &&
            String(member.role || "").toUpperCase() === "ADMIN",
        ),
    );

    if (isTeamAdmin) {
      return true;
    }

    // Check if personal teams are disabled for this company
    const userTeams = await getUserTeams(userId);
    const personalTeamsDisabled = userTeams.some(
      (team) =>
        team.companyId === domainInfo.company?.id &&
        team.companyPersonalTeamsDisabled,
    );

    // If personal teams are disabled and user is not an admin, they cannot purchase
    return !personalTeamsDisabled;
  } catch (error) {
    logger.warn(
      "Unable to determine credit purchase permissions, defaulting to false",
      {
        userId,
        error,
      },
    );
    // On error, default to not allowing credit purchases to be safe
    return false;
  }
}

/**
 * Check if the current user is an admin of any team or company.
 * This is used to show admin-specific UI like notification filtering.
 */
export async function isUserAdmin(userId: string): Promise<boolean> {
  try {
    const { getUserTeams, getUserCompanyRole } = await import(
      "@/apps/nextjs-app/lib/db/data"
    );

    // Check if user is a team admin/owner
    const userTeams = await getUserTeams(userId);
    const isTeamAdmin = userTeams.some(
      (team) =>
        team.role === "ADMIN" || team.role === "OWNER"
    );

    if (isTeamAdmin) {
      return true;
    }

    // Check if user is a company admin/owner
    const domainInfo = await getCompanyByMyDomain();
    if (domainInfo.company?.id) {
      const role = await getUserCompanyRole(userId, domainInfo.company.id);
      if (role === "ADMIN" || role === "OWNER") {
        return true;
      }
    }

    return false;
  } catch (error) {
    logger.warn("Unable to determine admin status, defaulting to false", {
      userId,
      error,
    });
    return false;
  }
}
