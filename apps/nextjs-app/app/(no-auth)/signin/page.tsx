// Next imports
import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

// NextAuth imports
import { auth } from "@/apps/nextjs-app/auth";

// Lib imports
import { logger } from "@/apps/shared/logger";

// Component imports
import { GoogleSignIn } from "@/apps/nextjs-app/components/auth/google-sign-in";
import { ResendSignIn } from "@/apps/nextjs-app/components/auth/resend-sign-in";

// UI component imports
import { Separator } from "@/apps/nextjs-app/components/ui/separator";

// Custom components
import { GlobalHeader } from "@/apps/nextjs-app/components/layout/global-header";

export default async function LoginPage() {
  const session = await auth();
  const headersList = await headers();
  const userAgent = headersList.get("user-agent") ?? "";
  const isInAppBrowser =
    /(Instagram|FBAN|FBAV|FB_IAB|Messenger|LinkedIn|TikTok|Twitter|Snapchat|Reddit|Pinterest|MicroMessenger|Line|Slack|Discord)/i.test(
      userAgent,
    );

  if (session) {
    redirect("/studies");
  }

  // Log sign in page view
  logger.info("Sign in page viewed", {
    page: "/signin",
    action: "view",
    userAgent,
    referer: headersList.get("referer"),
  });

  return (
    <div className="animate-gradient min-h-screen w-full bg-linear-to-r from-red-400 via-pink-500 to-blue-500 bg-size-[400%_400%]">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col items-center p-8">
        <GlobalHeader theme="dark" />

        {/* Login Section */}
        <div className="flex flex-1 flex-col items-center justify-center">
          <div className="w-full max-w-sm">
            <div className="rounded-xl border border-white/30 bg-white/20 p-6 shadow-xl backdrop-blur-xl">
              <ResendSignIn />
              <Separator />
              <GoogleSignIn isInAppBrowser={isInAppBrowser} />
            </div>

            <p className="mt-6 text-center text-sm text-white/80">
              By signing in you agree to our{" "}
              <Link className="underline hover:text-white" href="/privacy">
                Privacy Policy
              </Link>{" "}
              and{" "}
              <Link className="underline hover:text-white" href="/terms">
                Terms of Service
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
