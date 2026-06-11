// NextAuth imports
import { signIn } from "@/apps/nextjs-app/auth";

// Lib imports
import { logger } from "@/apps/shared/logger";

// UI component imports
import { Button } from "@/apps/nextjs-app/components/ui/button";

type GoogleSignInProps = {
  isInAppBrowser?: boolean;
  callbackUrl?: string;
  buttonText: string;
  inAppWarning: string;
};

export function GoogleSignIn({
  isInAppBrowser = false,
  callbackUrl,
  buttonText,
  inAppWarning,
}: GoogleSignInProps) {
  // Determine redirect target - callbackUrl is already validated by parent, default to /studies
  const redirectTo = callbackUrl || "/studies";

  return (
    <form
      action={async (formData: FormData) => {
        "use server";

        // Get the redirect URL from the form data
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
      }}
    >
      <input type="hidden" name="redirectTo" value={redirectTo} />
      <Button
        size="sm"
        className="mt-4 inline-flex items-center gap-2"
        type="submit"
        disabled={isInAppBrowser}
        aria-disabled={isInAppBrowser}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            fill="#4285F4"
          />
          <path
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            fill="#34A853"
          />
          <path
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            fill="#FBBC05"
          />
          <path
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            fill="#EA4335"
          />
        </svg>
        {buttonText}
      </Button>
      {isInAppBrowser ? (
        <p className="text-muted-foreground mt-2 text-xs">
          {inAppWarning}
        </p>
      ) : null}
    </form>
  );
}
