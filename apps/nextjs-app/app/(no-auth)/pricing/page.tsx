"use client";

// Nextjs imports
import Link from "next/link";
import { useRouter } from "next/navigation";

// Shadcn UI components
import { Button } from "@/apps/nextjs-app/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/apps/nextjs-app/components/ui/card";
import { Badge } from "@/apps/nextjs-app/components/ui/badge";

// Custom components
import { GlobalHeader } from "@/apps/nextjs-app/components/global-header";
import { GlobalFooter } from "@/apps/nextjs-app/components/global-footer";

// React and hooks
import { useState, useEffect } from "react";

// Client-side logging utility
import { clientLogger, logPageView } from "@/apps/nextjs-app/lib/client-logger";

// Pricing constants
import {
  PERSONAL_CREDIT_PRICE,
  COMPANY_CREDIT_PRICE,
} from "@/apps/shared/constants";

// Icon imports
import {
  Check,
  User,
  Building2,
  ChevronDown,
  Sparkles,
  SlidersHorizontal,
  Users,
  Plug,
  Shield,
} from "lucide-react";

// FAQ data
const faqs = [
  {
    question: "What is a study?",
    answer:
      "A study is a single analysis of your product using AI. This includes heuristic evaluations, cognitive walkthroughs, and persona-based assessments. Each study consumes one credit.",
  },
  {
    question: "How do credits work?",
    answer:
      "Credits are used to run studies. Each study costs one credit. Buy credits and use them whenever you're ready — they never expire and there are no minimums.",
  },
  {
    question: "What's the difference between Individual and Team pricing?",
    answer:
      "Individual pricing ($4.99/study) is for personal use. Team pricing ($19.99/study) includes company and team management features, custom heuristics, and collaboration tools designed for organizations.",
  },
  {
    question: "Can I try Seer before purchasing?",
    answer:
      "Yes! Every new user gets 3 free credits to run studies at no cost. Experience the full platform before committing.",
  },
  {
    question: "Do unused credits expire?",
    answer:
      "No, your credits never expire. Use them at your own pace — they'll be waiting whenever you need them.",
  },
  {
    question: "Can I upgrade from Individual to Team?",
    answer:
      "Absolutely! You can upgrade to a Team plan at any time. Contact us to set up your company account and start collaborating with your team.",
  },
  {
    question: "What payment methods do you accept?",
    answer:
      "We accept all major credit cards. For enterprise billing or invoicing, please contact payments@askseer.ai.",
  },
  {
    question: "Is my data secure?",
    answer:
      "Yes. All data is encrypted in transit and at rest. Your uploads and data are never used to train AI models. Enterprise-grade security protects your sensitive designs.",
  },
];

// Feature lists
const individualFeatures = [
  "AI-powered heuristic evaluations",
  "Cognitive walkthrough analysis",
  "Persona-based assessments",
  "Figma integration",
  "Export reports",
  "3 free credits to start",
];

const teamFeatures = [
  "Everything in Individual, plus:",
  "Company & team management",
  "Custom heuristics",
  "Shared team personas",
  "Collaboration tools",
  "Centralized billing",
  "Priority support",
];

export default function Page() {
  const router = useRouter();
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // Log pricing page view on mount
  useEffect(() => {
    logPageView("/pricing");
  }, []);

  const handleGetStarted = (plan: "individual" | "team") => {
    clientLogger.info("Pricing CTA clicked", {
      page: "/pricing",
      action: "cta_click",
      plan,
    });
    router.push("/signin");
  };

  const handleContactSales = () => {
    clientLogger.info("Contact sales clicked", {
      page: "/pricing",
      action: "contact_sales_click",
    });
    router.push("/demo");
  };

  return (
    <div className="flex min-h-screen w-full flex-col">
      {/* Hero Section with gradient background */}
      <div className="relative bg-gradient-to-b from-violet-100/30 via-white to-white">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(139,92,246,0.15),transparent)]" />
        <div className="relative mx-auto flex max-w-5xl flex-col items-center p-8">
          <GlobalHeader activePage="pricing" theme="light" />

          {/* Hero Content */}
          <div className="mt-16 flex flex-col items-center text-center md:mt-24">
            <h1 className="scroll-m-20 text-4xl font-extrabold tracking-tight md:text-5xl lg:text-6xl">
              Simple, transparent pricing
            </h1>
            <p className="mt-6 max-w-2xl text-lg text-zinc-600 md:text-xl">
              Pay per study with flexible, usage-based pricing. No subscriptions,
              no commitments — just powerful AI insights when you need them.
            </p>
          </div>

          {/* Pricing Cards */}
          <div className="mt-16 grid w-full max-w-4xl grid-cols-1 gap-8 md:grid-cols-2">
            {/* Individual Plan */}
            <Card className="relative overflow-hidden border-zinc-200 transition-all hover:border-violet-300 hover:shadow-lg">
              <div className="absolute top-0 right-0 h-32 w-32 translate-x-8 -translate-y-8 rounded-full bg-violet-100 opacity-50" />
              <CardHeader className="relative">
                <div className="mb-2 flex items-center gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-100 text-violet-600">
                    <User className="h-5 w-5" />
                  </div>
                  <CardTitle className="text-xl">Individual</CardTitle>
                </div>
                <CardDescription>
                  Perfect for designers, researchers, and product managers
                </CardDescription>
              </CardHeader>
              <CardContent className="relative">
                <div className="mb-6">
                  <span className="text-4xl font-bold">${PERSONAL_CREDIT_PRICE}</span>
                  <span className="text-zinc-500"> / study</span>
                </div>
                <ul className="space-y-3">
                  {individualFeatures.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-5 w-5 shrink-0 text-violet-600" />
                      <span className="text-sm text-zinc-700">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter className="relative">
                <Button
                  className="w-full"
                  size="lg"
                  onClick={() => handleGetStarted("individual")}
                >
                  Get started free
                </Button>
              </CardFooter>
            </Card>

            {/* Team Plan */}
            <Card className="relative overflow-hidden border-2 border-emerald-500 transition-all hover:shadow-lg">
              <div className="absolute top-0 right-0 h-32 w-32 translate-x-8 -translate-y-8 rounded-full bg-emerald-100 opacity-50" />
              <Badge className="absolute top-4 right-4 bg-emerald-500 text-white hover:bg-emerald-500">
                For Teams
              </Badge>
              <CardHeader className="relative">
                <div className="mb-2 flex items-center gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <CardTitle className="text-xl">Team</CardTitle>
                </div>
                <CardDescription>
                  Built for teams and organizations that need collaboration
                </CardDescription>
              </CardHeader>
              <CardContent className="relative">
                <div className="mb-6">
                  <span className="text-4xl font-bold">${COMPANY_CREDIT_PRICE}</span>
                  <span className="text-zinc-500"> / study</span>
                </div>
                <ul className="space-y-3">
                  {teamFeatures.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                      <span className="text-sm text-zinc-700">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter className="relative">
                <Button
                  className="w-full bg-emerald-600 hover:bg-emerald-700"
                  size="lg"
                  onClick={handleContactSales}
                >
                  Contact sales
                </Button>
              </CardFooter>
            </Card>
          </div>

          {/* Free trial callout */}
          <div className="mt-12 text-center">
            <p className="text-zinc-600">
              <Sparkles className="mb-1 mr-1 inline h-4 w-4 text-violet-600" />
              Every new user gets{" "}
              <span className="font-semibold text-zinc-900">3 free credits</span> to
              start — no credit card required.
            </p>
          </div>
        </div>
      </div>

      {/* Features Comparison Section */}
      <div className="bg-white py-16">
        <div className="mx-auto flex max-w-5xl flex-col items-center px-8 text-center">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            Everything you need to validate your product
          </h2>
          <p className="mt-4 max-w-2xl text-lg text-zinc-600">
            Powerful AI tools included with every study. Team plans unlock
            additional collaboration and customization features.
          </p>

          <div className="mt-12 grid w-full grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            {/* Feature 1: AI Analysis */}
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-violet-100 text-violet-600">
                <Sparkles className="h-7 w-7" />
              </div>
              <h3 className="text-lg font-semibold">AI-Powered Analysis</h3>
              <p className="mt-2 text-sm text-zinc-600">
                Get actionable insights in minutes with advanced AI evaluation
                methods.
              </p>
            </div>

            {/* Feature 2: Custom Heuristics */}
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <SlidersHorizontal className="h-7 w-7" />
              </div>
              <h3 className="text-lg font-semibold">Custom Heuristics</h3>
              <p className="mt-2 text-sm text-zinc-600">
                Create and share evaluation criteria tailored to your
                product&apos;s needs.
              </p>
              <Badge variant="secondary" className="mt-2">
                Team Plan
              </Badge>
            </div>

            {/* Feature 3: Team Management */}
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                <Users className="h-7 w-7" />
              </div>
              <h3 className="text-lg font-semibold">Team Management</h3>
              <p className="mt-2 text-sm text-zinc-600">
                Organize your company into teams with shared resources and
                billing.
              </p>
              <Badge variant="secondary" className="mt-2">
                Team Plan
              </Badge>
            </div>

            {/* Feature 4: Integrations */}
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-pink-100 text-pink-600">
                <Plug className="h-7 w-7" />
              </div>
              <h3 className="text-lg font-semibold">Figma Integration</h3>
              <p className="mt-2 text-sm text-zinc-600">
                Import designs directly from Figma and export insights back to
                your workflow.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* How It Works Section */}
      <div className="bg-zinc-50 py-16">
        <div className="mx-auto flex max-w-5xl flex-col items-center px-8 text-center">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            How credits work
          </h2>
          <p className="mt-4 max-w-2xl text-lg text-zinc-600">
            Simple, flexible, and no surprises.
          </p>

          <div className="mt-12 grid w-full grid-cols-1 gap-8 md:grid-cols-3">
            <div className="relative rounded-2xl bg-white p-8 shadow-sm">
              <div className="absolute -top-4 left-1/2 flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full bg-violet-600 text-sm font-bold text-white">
                1
              </div>
              <h3 className="mt-4 text-lg font-semibold">Buy credits</h3>
              <p className="mt-2 text-sm text-zinc-600">
                Purchase credits at your plan&apos;s rate. Buy as many or as few as
                you need — no minimums.
              </p>
            </div>

            <div className="relative rounded-2xl bg-white p-8 shadow-sm">
              <div className="absolute -top-4 left-1/2 flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full bg-violet-600 text-sm font-bold text-white">
                2
              </div>
              <h3 className="mt-4 text-lg font-semibold">Run studies</h3>
              <p className="mt-2 text-sm text-zinc-600">
                Each study uses one credit. Upload your design, select your
                analysis type, and get insights.
              </p>
            </div>

            <div className="relative rounded-2xl bg-white p-8 shadow-sm">
              <div className="absolute -top-4 left-1/2 flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full bg-violet-600 text-sm font-bold text-white">
                3
              </div>
              <h3 className="mt-4 text-lg font-semibold">Never expires</h3>
              <p className="mt-2 text-sm text-zinc-600">
                Your credits stay in your account until you use them. No rush,
                no pressure.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Enterprise Section */}
      <div className="bg-white py-16">
        <div className="mx-auto max-w-5xl px-8">
          <div className="rounded-3xl border border-zinc-200 bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 px-8 py-16 text-center shadow-lg md:px-16">
            <div className="mx-auto flex max-w-2xl flex-col items-center">
              <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10">
                <Shield className="h-8 w-8 text-white" />
              </div>
              <h2 className="text-3xl font-bold tracking-tight text-white md:text-4xl">
                Need enterprise features?
              </h2>
              <p className="mt-4 text-lg text-zinc-300">
                Custom integrations, SSO, advanced security, and dedicated
                support for large organizations.
              </p>
              <Button
                size="lg"
                variant="outline"
                className="mt-8 border-white/20 bg-white/10 text-white hover:bg-white/20"
                onClick={handleContactSales}
              >
                Contact sales
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* FAQ Section */}
      <div className="bg-zinc-50 py-16">
        <div className="mx-auto flex max-w-3xl flex-col items-center px-8">
          <h2 className="text-center text-3xl font-bold tracking-tight md:text-4xl">
            Frequently asked questions
          </h2>
          <p className="mt-4 text-center text-lg text-zinc-600">
            Everything you need to know about pricing and credits.
          </p>

          <div className="mt-12 w-full space-y-4">
            {faqs.map((faq, index) => (
              <div
                key={index}
                className="rounded-xl border border-zinc-200 bg-white"
              >
                <button
                  className="flex w-full items-center justify-between px-6 py-4 text-left"
                  onClick={() => setOpenFaq(openFaq === index ? null : index)}
                >
                  <span className="font-medium text-zinc-900">
                    {faq.question}
                  </span>
                  <ChevronDown
                    className={`h-5 w-5 text-zinc-500 transition-transform ${
                      openFaq === index ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {openFaq === index && (
                  <div className="px-6 pb-4">
                    <p className="text-zinc-600">{faq.answer}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-white py-16">
        <div className="mx-auto max-w-5xl px-8">
          <div className="rounded-3xl border border-zinc-200 bg-gradient-to-br from-violet-50 via-pink-50 to-white px-8 py-16 text-center shadow-lg md:px-16">
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
              Ready to get started?
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-zinc-600">
              Start with 3 free credits and see how Seer can transform your
              product development process.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button size="lg" asChild>
                <Link href="/signin">Get started free</Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/demo">Request a demo</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <GlobalFooter />
    </div>
  );
}
