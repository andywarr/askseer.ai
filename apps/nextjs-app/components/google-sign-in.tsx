// NextAuth imports
import { signIn } from "@/apps/nextjs-app/auth";

// Lib imports
import { logger } from "@/apps/shared/logger";

// UI component imports
import { Button } from "@/apps/nextjs-app/components/ui/button";

type GoogleSignInProps = {
  isInAppBrowser?: boolean;
};

export function GoogleSignIn({ isInAppBrowser = false }: GoogleSignInProps) {
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
      <Button
        size="sm"
        className="mt-4 inline-block"
        type="submit"
        disabled={isInAppBrowser}
        aria-disabled={isInAppBrowser}
      >
        Sign in with Google
      </Button>
      {isInAppBrowser ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Google sign-in isn&apos;t available inside this app&apos;s browser.
          To continue, open this link in your device&apos;s default browser.
        </p>
      ) : null}
    </form>
  );
}
