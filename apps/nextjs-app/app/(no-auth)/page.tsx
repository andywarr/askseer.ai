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

export default async function Home() {
  const session = await auth();
  const headersList = await headers();

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
    <div className="animate-gradient min-h-screen w-full bg-linear-to-r from-red-400 via-pink-500 to-blue-500 bg-size-[400%_400%]">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col items-center p-8">
        <GlobalHeader activePage="home" primaryCta="signIn" theme="dark" />
        <div className="mt-16 w-full max-w-max min-w-80 p-2 text-white">
          {/* <h1 className="mb-4 text-8xl drop-shadow-lg">Seer</h1> */}
          <h3 className="mt-16 scroll-m-20 text-2xl font-semibold tracking-tight">
            AI-Assisted Research
          </h3>
          <p className="mt-8 mb-8 max-w-xs leading-7 not-first:mt-6">
            Save hours on research with the click of a button
          </p>
          <ResendSignIn />
          <Separator className="mt-4" />
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
}
