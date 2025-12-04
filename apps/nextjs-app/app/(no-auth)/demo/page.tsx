// Next imports
import { headers } from "next/headers";

// Lib imports
import { logger } from "@/apps/shared/logger";

// Custom components
import { GlobalHeader } from "@/apps/nextjs-app/components/global-header";
import { DemoRequestForm } from "@/apps/nextjs-app/components/demo-request-form";

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
        <div className="flex flex-1 flex-col items-center justify-center py-12">
          <DemoRequestForm />
        </div>
      </div>
    </div>
  );
}
