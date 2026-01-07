"use server";

import { auth, signOut } from "@/apps/nextjs-app/auth";
import { logger } from "@/apps/shared/logger";

export async function signOutServerAction(): Promise<void> {
  let userId: string | undefined;

  try {
    const session = await auth();
    userId = session?.user?.id;
  } catch (error) {
    // Session fetch failed, but we can still attempt sign out
    logger.warn("Failed to get session during sign out", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  try {
    logger.debug("User signing out", { userId });

    await signOut();

    logger.info("User signed out successfully", { userId });
  } catch (error) {
    logger.error("Error during sign out", {
      userId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    // Re-throw to let Next.js handle the error
    throw error;
  }
}
