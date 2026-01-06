"use server";

import { auth, signOut } from "@/apps/nextjs-app/auth";
import { logger } from "@/apps/shared/logger";

export async function signOutServerAction() {
  try {
    // Try to get user for logging, but don't require it for sign out
    const session = await auth();

    logger.debug("User signing out", {
      userId: session?.user?.id,
    });

    await signOut();

    logger.info("User signed out successfully", {
      userId: session?.user?.id,
    });
  } catch (error) {
    logger.error("Error during sign out", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    // Still call signOut even if there's an error getting user info
    await signOut();
  }
}
