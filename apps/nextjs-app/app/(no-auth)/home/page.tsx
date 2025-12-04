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

// Icon imports
import { ClipboardCheck, Route, Users, Figma } from "lucide-react";

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
        <div className="mt-32 flex w-full flex-col items-center text-center md:mt-40">
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
        <div className="mt-32 flex w-full flex-col items-center text-center md:mt-40">
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

        {/* Capabilities Section */}
        <div className="mt-32 flex w-full flex-col items-center text-center md:mt-40">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            Everything you need to ship better products
          </h2>
          <p className="mt-4 text-lg text-zinc-600">
            Powerful tools to help you understand and improve your user
            experience
          </p>

          <div className="mt-12 grid w-full grid-cols-1 gap-6 md:grid-cols-2">
            {/* Capability 1: Heuristic Evaluation */}
            <div className="group relative overflow-hidden rounded-2xl border border-zinc-200 bg-gradient-to-br from-violet-50 to-white p-8 text-left transition-all hover:border-violet-300 hover:shadow-lg">
              <div className="absolute -top-8 -right-8 h-32 w-32 rounded-full bg-violet-100 opacity-50 transition-transform group-hover:scale-150" />
              <div className="relative">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-violet-100 text-violet-600">
                  <ClipboardCheck className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-semibold">Heuristic Evaluation</h3>
                <p className="mt-2 text-zinc-600">
                  Evaluate your products against proven design best practices
                  and industry standards to identify usability issues before
                  they impact your users.
                </p>
              </div>
            </div>

            {/* Capability 2: Cognitive Walkthroughs */}
            <div className="group relative overflow-hidden rounded-2xl border border-zinc-200 bg-gradient-to-br from-blue-50 to-white p-8 text-left transition-all hover:border-blue-300 hover:shadow-lg">
              <div className="absolute -top-8 -right-8 h-32 w-32 rounded-full bg-blue-100 opacity-50 transition-transform group-hover:scale-150" />
              <div className="relative">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                  <Route className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-semibold">
                  Cognitive Walkthroughs
                </h3>
                <p className="mt-2 text-zinc-600">
                  Assess the usability of your products by simulating user
                  journeys and identifying actionable improvements to streamline
                  the experience.
                </p>
              </div>
            </div>

            {/* Capability 3: AI Personas */}
            <div className="group relative overflow-hidden rounded-2xl border border-zinc-200 bg-gradient-to-br from-amber-50 to-white p-8 text-left transition-all hover:border-amber-300 hover:shadow-lg">
              <div className="absolute -top-8 -right-8 h-32 w-32 rounded-full bg-amber-100 opacity-50 transition-transform group-hover:scale-150" />
              <div className="relative">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
                  <Users className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-semibold">AI Personas</h3>
                <p className="mt-2 text-zinc-600">
                  Create AI-powered personas that represent your users, helping
                  you understand different perspectives and design for diverse
                  needs.
                </p>
              </div>
            </div>

            {/* Capability 4: Figma Integration */}
            <div className="group relative overflow-hidden rounded-2xl border border-zinc-200 bg-gradient-to-br from-pink-50 to-white p-8 text-left transition-all hover:border-pink-300 hover:shadow-lg">
              <div className="absolute -top-8 -right-8 h-32 w-32 rounded-full bg-pink-100 opacity-50 transition-transform group-hover:scale-150" />
              <div className="relative">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-pink-100 text-pink-600">
                  <Figma className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-semibold">Figma Integration</h3>
                <p className="mt-2 text-zinc-600">
                  Import designs directly from Figma and automatically add
                  issues and recommendations as comments, keeping your team
                  aligned in one place.
                </p>
              </div>
            </div>
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
