// NextAuth imports
import { signIn } from "@/apps/nextjs-app/auth";

// Lib imports
import { logger } from "@/apps/shared/logger";

// UI component imports
import { Button } from "@/apps/nextjs-app/components/ui/button";

export function GoogleSignIn() {
  return (
    <form
      action={async () => {
        "use server";

        // Log Google sign-in attempt
        logger.debug("Google sign-in attempted", {
          page: "/",
          action: "sign_in",
          method: "google",
        });

        try {
          await signIn("google", { redirectTo: "/studies" });

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
      }}
    >
      <Button size="sm" className="mt-4 inline-block" type="submit">
        Sign in with Google
      </Button>
    </form>
  );
}
