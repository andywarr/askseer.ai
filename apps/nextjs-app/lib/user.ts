import "server-only";

import { cache } from "react";
import { isAuthenticated } from "@/apps/nextjs-app/lib/dal";
import { getUser } from "@/apps/nextjs-app/lib/data";
import { logger } from "@/apps/shared/logger.ts";
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
