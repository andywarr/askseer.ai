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

// Icon imports
import {
  Sparkles,
  SlidersHorizontal,
  Plug,
  UserCheck,
  Building2,
  Zap,
  ShieldCheck,
  Lock,
  EyeOff,
} from "lucide-react";

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
    <div className="flex min-h-screen w-full flex-col">
      {/* Hero Section with gradient background */}
      <div className="relative bg-gradient-to-b from-pink-100/30 via-white to-white">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(139,92,246,0.15),transparent)]" />
        <div className="relative mx-auto flex max-w-5xl flex-col items-center p-8">
          <GlobalHeader activePage="home" theme="light" />

          {/* Hero Content */}
          <div className="mt-16 flex flex-1 flex-col items-center justify-center text-center md:mt-24 lg:mt-32">
            <h1 className="scroll-m-20 text-4xl font-extrabold tracking-tight md:text-5xl lg:text-6xl">
              AI-powered product insights
            </h1>
            <p className="mt-6 max-w-2xl text-lg text-zinc-600 md:text-xl">
              Instantly discover what your customers want, what&apos;s working
              and what&apos;s not with your product, allowing you to create
              experiences they will love.
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

      {/* Trusted By Section */}
      <div className="bg-white py-16">
        <div className="mx-auto max-w-5xl px-8">
          <div className="rounded-3xl border border-zinc-200 bg-zinc-50 px-8 py-10 text-center shadow-lg md:px-16">
            <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
              Trusted by world-class teams
            </h2>
            <p className="mt-3 text-base text-zinc-600">
              Product leaders at top companies rely on Seer to ship with
              confidence
            </p>

            {/* Company logos */}
            <div className="mt-8 flex items-center justify-center gap-16">
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
        </div>
      </div>

      {/* Capabilities Section */}
      <div className="bg-white py-16">
        <div className="mx-auto flex max-w-5xl flex-col items-center px-8 text-center">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            Everything you need to ship better products
          </h2>
          <p className="mt-4 text-lg text-zinc-600">
            Powerful AI tools to validate ideas, uncover issues, and build with
            confidence
          </p>

          <div className="mt-12 grid w-full grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {/* Capability 1: AI-Powered Insights */}
            <div className="group relative overflow-hidden rounded-2xl border border-zinc-200 bg-gradient-to-br from-violet-50 to-white p-8 text-left transition-all hover:border-violet-300 hover:shadow-lg">
              <div className="absolute -top-8 -right-8 h-32 w-32 rounded-full bg-violet-100 opacity-50 transition-transform group-hover:scale-150" />
              <div className="relative">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-violet-100 text-violet-600">
                  <Sparkles className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-semibold">
                  Get answers in minutes, not weeks
                </h3>
                <p className="mt-2 text-zinc-600">
                  AI-powered audits and walkthroughs surface usability issues
                  and opportunities instantly—no recruiting or scheduling
                  required.
                </p>
              </div>
            </div>

            {/* Capability 2: Custom Heuristics & Personas */}
            <div className="group relative overflow-hidden rounded-2xl border border-zinc-200 bg-gradient-to-br from-blue-50 to-white p-8 text-left transition-all hover:border-blue-300 hover:shadow-lg">
              <div className="absolute -top-8 -right-8 h-32 w-32 rounded-full bg-blue-100 opacity-50 transition-transform group-hover:scale-150" />
              <div className="relative">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                  <SlidersHorizontal className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-semibold">
                  Tailor insights to your product
                </h3>
                <p className="mt-2 text-zinc-600">
                  Create custom heuristics and personas that match your users
                  and standards. Get feedback that&apos;s relevant to your
                  specific context.
                </p>
              </div>
            </div>

            {/* Capability 3: Figma & Third-Party Integrations */}
            <div className="group relative overflow-hidden rounded-2xl border border-zinc-200 bg-gradient-to-br from-pink-50 to-white p-8 text-left transition-all hover:border-pink-300 hover:shadow-lg">
              <div className="absolute -top-8 -right-8 h-32 w-32 rounded-full bg-pink-100 opacity-50 transition-transform group-hover:scale-150" />
              <div className="relative">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-pink-100 text-pink-600">
                  <Plug className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-semibold">
                  Work where you already are
                </h3>
                <p className="mt-2 text-zinc-600">
                  Connect with Figma and other tools you use daily. Get insights
                  as comments, right in your workflow—no context switching.
                </p>
              </div>
            </div>

            {/* Capability 4: AI-First, Human-in-the-Loop */}
            <div className="group relative overflow-hidden rounded-2xl border border-zinc-200 bg-gradient-to-br from-amber-50 to-white p-8 text-left transition-all hover:border-amber-300 hover:shadow-lg">
              <div className="absolute -top-8 -right-8 h-32 w-32 rounded-full bg-amber-100 opacity-50 transition-transform group-hover:scale-150" />
              <div className="relative">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
                  <UserCheck className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-semibold">
                  AI speed, human judgment
                </h3>
                <p className="mt-2 text-zinc-600">
                  AI surfaces the insights; you decide what matters. Review,
                  refine, and act on findings with full control over every
                  recommendation.
                </p>
              </div>
            </div>

            {/* Capability 5: Team Collaboration */}
            <div className="group relative overflow-hidden rounded-2xl border border-zinc-200 bg-gradient-to-br from-emerald-50 to-white p-8 text-left transition-all hover:border-emerald-300 hover:shadow-lg">
              <div className="absolute -top-8 -right-8 h-32 w-32 rounded-full bg-emerald-100 opacity-50 transition-transform group-hover:scale-150" />
              <div className="relative">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
                  <Building2 className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-semibold">
                  Scale across your organization
                </h3>
                <p className="mt-2 text-zinc-600">
                  Manage teams, share insights, and maintain consistency across
                  projects. Built for growing teams and enterprise needs.
                </p>
              </div>
            </div>

            {/* Capability 6: Fast Iteration */}
            <div className="group relative overflow-hidden rounded-2xl border border-zinc-200 bg-gradient-to-br from-rose-50 to-white p-8 text-left transition-all hover:border-rose-300 hover:shadow-lg">
              <div className="absolute -top-8 -right-8 h-32 w-32 rounded-full bg-rose-100 opacity-50 transition-transform group-hover:scale-150" />
              <div className="relative">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
                  <Zap className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-semibold">
                  Ship with confidence, faster
                </h3>
                <p className="mt-2 text-zinc-600">
                  Catch issues before they reach users. Validate iterations
                  quickly so you can move fast without sacrificing quality.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Data Safety Section */}
      <div className="bg-white py-16">
        <div className="mx-auto flex max-w-5xl flex-col items-center px-8 text-center">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            Your data stays yours
          </h2>
          <p className="mt-4 max-w-2xl text-lg text-zinc-600">
            We take data privacy seriously. Your designs and feedback are never
            used to train AI models—period.
          </p>

          <div className="mt-12 grid w-full grid-cols-1 gap-8 md:grid-cols-3">
            {/* Never trains AI */}
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-zinc-100 text-zinc-600">
                <EyeOff className="h-7 w-7" />
              </div>
              <h3 className="text-lg font-semibold">Never used for training</h3>
              <p className="mt-2 text-sm text-zinc-600">
                Your uploads and data are never used to train AI models. Your
                work remains completely private.
              </p>
            </div>

            {/* Encrypted & Secure */}
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-zinc-100 text-zinc-600">
                <Lock className="h-7 w-7" />
              </div>
              <h3 className="text-lg font-semibold">Encrypted & secure</h3>
              <p className="mt-2 text-sm text-zinc-600">
                All data is encrypted in transit and at rest. Enterprise-grade
                security protects your sensitive designs.
              </p>
            </div>

            {/* You're in control */}
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-zinc-100 text-zinc-600">
                <ShieldCheck className="h-7 w-7" />
              </div>
              <h3 className="text-lg font-semibold">You&apos;re in control</h3>
              <p className="mt-2 text-sm text-zinc-600">
                Delete your data anytime. We don&apos;t retain your uploads
                longer than necessary to provide our service.
              </p>
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
                AI-powered product insights for teams that ship fast.
              </p>
              <p className="mt-4 text-sm text-zinc-500">
                ©{new Date().getFullYear()} Seer. All rights reserved.
              </p>
            </div>

            {/* Product Column */}
            <div className="flex flex-col gap-2 pt-[46px]">
              <Link
                href="/home"
                className="block text-sm text-zinc-700 hover:text-zinc-900 hover:underline"
              >
                Home
              </Link>
              <Link
                href="/pricing"
                className="block text-sm text-zinc-700 hover:text-zinc-900 hover:underline"
              >
                Pricing
              </Link>
            </div>

            {/* Legal Column */}
            <div className="flex flex-col gap-2 pt-[46px]">
              <Link
                href="/privacy"
                className="block text-sm text-zinc-700 hover:text-zinc-900 hover:underline"
              >
                Privacy Policy
              </Link>
              <Link
                href="/terms"
                className="block text-sm text-zinc-700 hover:text-zinc-900 hover:underline"
              >
                Terms of Service
              </Link>
            </div>

            {/* Actions Column */}
            <div className="flex flex-col gap-2 pt-[46px]">
              <Link
                href="/signin"
                className="block text-sm text-zinc-700 hover:text-zinc-900 hover:underline"
              >
                Sign in
              </Link>
              <Link
                href="/demo"
                className="block text-sm text-zinc-700 hover:text-zinc-900 hover:underline"
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
