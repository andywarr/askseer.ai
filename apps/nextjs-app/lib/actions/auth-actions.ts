"use server";

import { auth, signIn, signOut } from "@/apps/nextjs-app/auth";
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
    // NEXT_REDIRECT is expected behavior for successful sign-out with redirect
    if (
      error instanceof Error &&
      (error.message === "NEXT_REDIRECT" ||
        error.message.includes("NEXT_REDIRECT"))
    ) {
      logger.info("User signed out successfully", { userId });
      throw error;
    }

    logger.error("Error during sign out", {
      userId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    // Re-throw to let Next.js handle the error
    throw error;
  }
}

export async function googleSignInServerAction(formData: FormData): Promise<void> {
  const redirectTarget =
    (formData.get("redirectTo") as string) || "/studies";

  // Log Google sign-in attempt
  logger.debug("Google sign-in attempted", {
    page: "/",
    action: "sign_in",
    method: "google",
  });

  try {
    await signIn("google", { redirectTo: redirectTarget });

    logger.info("Google sign-in successful", {
      page: "/",
      action: "sign_in",
      method: "google",
    });
  } catch (error) {
    // NEXT_REDIRECT is expected behavior for successful sign-in with redirect
    if (
      error instanceof Error &&
      (error.message === "NEXT_REDIRECT" ||
        error.message.includes("NEXT_REDIRECT"))
    ) {
      throw error; // Success case - user will be redirected
    }

    // Log actual errors (network issues, OAuth failures, etc.)
    logger.error("Google sign-in failed", {
      page: "/",
      action: "sign_in",
      method: "google",
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

