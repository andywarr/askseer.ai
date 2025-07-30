// Next imports
import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

// NextAuth imports
import { auth } from "@/apps/nextjs-app/auth";

// Lib imports
import { logger } from "@/apps/nextjs-app/lib/logger";

// Component imports
import { GoogleSignIn } from "@/apps/nextjs-app/components/google-sign-in";
import { ResendSignIn } from "@/apps/nextjs-app/components/resend-sign-in";

// UI component imports
import { Separator } from "@/apps/nextjs-app/components/ui/separator";

// Custom components
import { GlobalHeader } from "@/apps/nextjs-app/components/global-header";

export default async function Home() {
  try {
    const session = await auth();
    const headersList = headers();

    if (session) {
      redirect("/studies");
    }

    // Log home page view
    logger.info("Landing page viewed", {
      page: "/",
      action: "view",
      userAgent: headersList.get("user-agent"),
      referer: headersList.get("referer"),
    });

    return (
      <div className="min-h-screen w-full animate-gradient bg-gradient-to-r from-red-400 via-pink-500 to-blue-500 bg-[length:400%_400%]">
        <div className="mx-auto flex min-h-screen max-w-5xl flex-col items-center p-8">
          <GlobalHeader activePage="home" primaryCta="signIn" theme="dark" />
          <div className="mt-16 w-full min-w-80 max-w-max p-2 text-white">
            {/* <h1 className="mb-4 text-8xl drop-shadow-lg">Seer</h1> */}
            <h3 className="mt-16 scroll-m-20 text-2xl font-semibold tracking-tight">
              AI-Assisted Research
            </h3>
            <p className="mb-8 mt-8 max-w-xs leading-7 [&:not(:first-child)]:mt-6">
              Save hours on research with the click of a button
            </p>
            <ResendSignIn />
            <Separator />
            <GoogleSignIn />
            <p className="mt-4 max-w-xs text-sm">
              By clicking the sign in button you agree to our{" "}
              <Link className="underline" href={"/privacy"}>
                Privacy Policy
              </Link>{" "}
              and{" "}
              <Link className="underline" href={"/terms"}>
                Terms of Service
              </Link>
            </p>
          </div>
        </div>
      </div>
    );
  } catch (error) {
    logger.error("Failed to load home page", {
      page: "/",
      action: "view",
      error: error instanceof Error ? error.message : String(error),
    });
    redirect("/error");
  }
}
