// Next imports
import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

// NextAuth imports
import { auth } from "@/apps/nextjs-app/auth";

// Lib imports
import { logger } from "@/apps/shared/logger";

// UI component imports
import { Button } from "@/apps/nextjs-app/components/ui/button";

// Custom components
import { GlobalHeader } from "@/apps/nextjs-app/components/global-header";

export default async function HomePage() {
  const session = await auth();
  const headersList = await headers();
  const userAgent = headersList.get("user-agent") ?? "";

  if (session) {
    redirect("/studies");
  }
  // Log home page view
  logger.info("Landing page viewed", {
    page: "/home",
    action: "view",
    userAgent,
    referer: headersList.get("referer"),
  });

  return (
    <div className="min-h-screen w-full bg-white">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col items-center p-8">
        <GlobalHeader activePage="home" theme="light" />

        {/* Hero Section */}
        <div className="mt-16 flex flex-1 flex-col items-center justify-center text-center md:mt-24 lg:mt-32">
          <h1 className="scroll-m-20 text-4xl font-extrabold tracking-tight md:text-5xl lg:text-6xl">
            Creating better experiences
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-zinc-600 md:text-xl">
            Learn how to improve your products with the click of a button
          </p>
          <div className="mt-10 flex gap-4">
            <Button size="lg" asChild>
              <Link href="/signin">Get started for free</Link>
            </Button>
            <Button size="lg" variant="secondary" asChild>
              <Link href="/demo">Request a demo</Link>
            </Button>
          </div>

          {/* Hero Image */}
          <div className="mt-16 w-full max-w-4xl">
            <Image
              src="/hero.png"
              alt="Seer product screenshot"
              width={1200}
              height={800}
              priority
            />
          </div>
        </div>
      </div>
    </div>
  );
}
