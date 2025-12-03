// Next imports
import Link from "next/link";
import { headers } from "next/headers";

// Lib imports
import { logger } from "@/apps/shared/logger";

// UI component imports
import { Button } from "@/apps/nextjs-app/components/ui/button";

// Custom components
import { GlobalHeader } from "@/apps/nextjs-app/components/global-header";

export default async function DemoPage() {
  const headersList = await headers();

  // Log demo page view
  logger.info("Demo page viewed", {
    page: "/demo",
    action: "view",
    userAgent: headersList.get("user-agent"),
    referer: headersList.get("referer"),
  });

  return (
    <div className="min-h-screen w-full bg-white">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col items-center p-8">
        <GlobalHeader theme="light" />

        {/* Demo Request Section */}
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <h1 className="scroll-m-20 text-4xl font-extrabold tracking-tight md:text-5xl">
            Request a Demo
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-zinc-600 md:text-xl">
            See how Seer can help improve your products. Schedule a personalized
            demo with our team.
          </p>
          <div className="mt-10">
            <Button size="lg" asChild>
              <a href="mailto:demo@askseer.ai">Contact us</a>
            </Button>
          </div>
          <p className="mt-6 text-sm text-zinc-500">
            Or email us directly at{" "}
            <a
              href="mailto:demo@askseer.ai"
              className="underline hover:text-zinc-900"
            >
              demo@askseer.ai
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
