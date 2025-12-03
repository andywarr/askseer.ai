// Next imports
import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

// NextAuth imports
import { auth } from "@/apps/nextjs-app/auth";

// Lib imports
import { logger } from "@/apps/shared/logger";

// Component imports
import { GoogleSignIn } from "@/apps/nextjs-app/components/google-sign-in";
import { ResendSignIn } from "@/apps/nextjs-app/components/resend-sign-in";

// UI component imports
import { Separator } from "@/apps/nextjs-app/components/ui/separator";

// Custom components
import { GlobalHeader } from "@/apps/nextjs-app/components/global-header";

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

  // Log login page view
  logger.info("Login page viewed", {
    page: "/login",
    action: "view",
    userAgent,
    referer: headersList.get("referer"),
  });

  return (
    <div className="min-h-screen w-full bg-white">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col items-center p-8">
        <GlobalHeader theme="light" />

        {/* Login Section */}
        <div className="flex flex-1 flex-col items-center justify-center">
          <div className="w-full max-w-sm">
            <h1 className="mb-2 text-center text-3xl font-bold tracking-tight">
              Welcome back
            </h1>
            <p className="mb-8 text-center text-zinc-600">
              Sign in to your account to continue
            </p>

            <div className="rounded-lg border bg-zinc-50 p-6">
              <ResendSignIn />
              <Separator className="my-4" />
              <GoogleSignIn isInAppBrowser={isInAppBrowser} />
            </div>

            <p className="mt-6 text-center text-sm text-zinc-500">
              By signing in you agree to our{" "}
              <Link className="underline hover:text-zinc-900" href="/privacy">
                Privacy Policy
              </Link>{" "}
              and{" "}
              <Link className="underline hover:text-zinc-900" href="/terms">
                Terms of Service
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
