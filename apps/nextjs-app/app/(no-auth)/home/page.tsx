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
import { CountdownStopwatch } from "@/apps/nextjs-app/components/countdown-stopwatch";

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
    <div className="flex min-h-screen w-full flex-col bg-white">
      <div className="mx-auto flex max-w-5xl flex-1 flex-col items-center p-8">
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

        {/* Research Quality Section */}
        <div className="mt-24 flex w-full flex-col items-center text-center">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            Research-grade quality
          </h2>
          <p className="mt-4 text-lg text-zinc-600">
            Trust by world-class product teams to deliver reliable insights
          </p>

          {/* Company logos */}
          <div className="mt-12 flex items-center justify-center gap-16">
            <Image
              src="/clients/microsoft.png"
              alt="Microsoft"
              width={150}
              height={50}
              className="h-12 w-auto object-contain grayscale"
            />
            <Image
              src="/clients/intuit.png"
              alt="Intuit"
              width={150}
              height={50}
              className="h-12 w-auto object-contain grayscale"
            />
          </div>
        </div>

        {/* Insights in an Instant Section */}
        <div className="mt-24 flex w-full flex-col items-center text-center">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            Insights in an instant
          </h2>
          <p className="mt-4 text-lg text-zinc-600">
            Get actionable feedback in under a minute
          </p>

          <div className="mt-12">
            <CountdownStopwatch />
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="relative w-full">
        {/* Gradient background with top fade */}
        <div className="absolute inset-0 bg-gradient-to-r from-red-400/30 via-pink-500/30 to-blue-500/30" />
        <div className="absolute inset-0 bg-gradient-to-b from-white via-transparent to-transparent" />

        <div className="relative mx-auto max-w-5xl px-8 pt-32 pb-16">
          <div className="grid grid-cols-1 gap-12 md:grid-cols-2 lg:grid-cols-4">
            {/* Brand Column */}
            <div className="flex flex-col">
              <Image
                src="/logo-black.png"
                alt="Seer logo"
                width={32}
                height={30}
                className="mb-4"
              />
              <p className="text-sm text-zinc-600">
                Creating better experiences through AI-powered insights.
              </p>
              <p className="mt-4 text-sm text-zinc-500">
                ©{new Date().getFullYear()} Seer. All rights reserved.
              </p>
            </div>

            {/* Product Column */}
            <div className="flex flex-col gap-2 pt-[46px]">
              <Link
                href="/home"
                className="block text-sm text-zinc-700 hover:text-zinc-900"
              >
                Home
              </Link>
              <Link
                href="/pricing"
                className="block text-sm text-zinc-700 hover:text-zinc-900"
              >
                Pricing
              </Link>
            </div>

            {/* Legal Column */}
            <div className="flex flex-col gap-2 pt-[46px]">
              <Link
                href="/privacy"
                className="block text-sm text-zinc-700 hover:text-zinc-900"
              >
                Privacy Policy
              </Link>
              <Link
                href="/terms"
                className="block text-sm text-zinc-700 hover:text-zinc-900"
              >
                Terms of Service
              </Link>
            </div>

            {/* Actions Column */}
            <div className="flex flex-col gap-2 pt-[46px]">
              <Link
                href="/signin"
                className="block text-sm text-zinc-700 hover:text-zinc-900"
              >
                Sign in
              </Link>
              <Link
                href="/demo"
                className="block text-sm text-zinc-700 hover:text-zinc-900"
              >
                Request a demo
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
