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
import { GlobalHeader } from "@/apps/nextjs-app/components/layout/global-header";
import { GlobalFooter } from "@/apps/nextjs-app/components/layout/global-footer";

// React and hooks
import { useState, useEffect } from "react";

// next-intl imports
import { useTranslations, useLocale } from "next-intl";

// Client-side logging utility
import {
  clientLogger,
  logPageView,
} from "@/apps/nextjs-app/lib/utils/client-logger";

// Pricing constants
import {
  PERSONAL_MIN_STUDY_COST_CENTS,
  COMPANY_MIN_STUDY_COST_CENTS,
} from "@/apps/shared/constants";

// Icon imports
import {
  Check,
  User,
  Building2,
  ChevronDown,
} from "lucide-react";

export default function Page() {
  const router = useRouter();
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const t = useTranslations("PricingPage");
  const locale = useLocale();

  const individualFeatures = t.raw("plans.individual.features") as string[];
  const teamFeatures = t.raw("plans.team.features") as string[];

  const faqs = [
    {
      question: t("faq.questions.study.q"),
      answer: t("faq.questions.study.a"),
    },
    {
      question: t("faq.questions.billing.q"),
      answer: t("faq.questions.billing.a"),
    },
    {
      question: t("faq.questions.difference.q"),
      answer: t("faq.questions.difference.a", {
        personalCost: new Intl.NumberFormat(locale, {
          style: "currency",
          currency: "USD",
        }).format(PERSONAL_MIN_STUDY_COST_CENTS / 100),
        companyCost: new Intl.NumberFormat(locale, {
          style: "currency",
          currency: "USD",
        }).format(COMPANY_MIN_STUDY_COST_CENTS / 100),
      }),
    },
    {
      question: t("faq.questions.try.q"),
      answer: t("faq.questions.try.a"),
    },
    {
      question: t("faq.questions.expire.q"),
      answer: t("faq.questions.expire.a"),
    },
    {
      question: t("faq.questions.limits.q"),
      answer: t("faq.questions.limits.a"),
    },
    {
      question: t("faq.questions.setup.q"),
      answer: t("faq.questions.setup.a"),
    },
    {
      question: t("faq.questions.upgrade.q"),
      answer: t("faq.questions.upgrade.a"),
    },
    {
      question: t("faq.questions.methods.q"),
      answer: t("faq.questions.methods.a"),
    },
    {
      question: t("faq.questions.secure.q"),
      answer: t("faq.questions.secure.a"),
    },
  ];

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

  const handleRequestDemo = () => {
    clientLogger.info("Request demo clicked", {
      page: "/pricing",
      action: "request_demo_click",
    });
    router.push("/demo");
  };

  return (
    <div className="flex min-h-screen w-full flex-col">
      {/* Hero Section with gradient background */}
      <div className="relative bg-gradient-to-b from-pink-100/30 via-white to-white">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(139,92,246,0.15),transparent)]" />
        <div className="relative mx-auto flex max-w-5xl flex-col items-center p-8">
          <GlobalHeader activePage="pricing" theme="light" />

          {/* Hero Content */}
          <div className="mt-16 flex flex-col items-center text-center md:mt-24 lg:mt-32">
            <h1 className="scroll-m-20 text-4xl font-extrabold tracking-tight md:text-5xl lg:text-6xl">
              {t("hero.title")}
            </h1>
            <p className="mt-6 max-w-2xl text-lg text-zinc-600 md:text-xl">
              {t("hero.description")}
            </p>
          </div>

          {/* Pricing Cards */}
          <div className="mt-16 grid w-full max-w-4xl grid-cols-1 gap-8 md:grid-cols-2">
            {/* Individual Plan */}
            <Card className="relative flex flex-col overflow-hidden border-zinc-200 transition-all hover:border-violet-300 hover:shadow-lg">
              <div className="absolute top-0 right-0 h-32 w-32 translate-x-8 -translate-y-8 rounded-full bg-violet-100 opacity-50" />
              <CardHeader className="relative">
                <div className="mb-2 flex items-center gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-100 text-violet-600">
                    <User className="h-5 w-5" />
                  </div>
                  <CardTitle className="text-xl">{t("plans.individual.title")}</CardTitle>
                </div>
                <CardDescription>
                  {t("plans.individual.description")}
                </CardDescription>
              </CardHeader>
              <CardContent className="relative">
                <div className="mb-6">
                  <span className="text-sm text-zinc-500">{t("plans.individual.from")}</span>
                  <div>
                    <span className="text-4xl font-bold">
                      {new Intl.NumberFormat(locale, {
                        style: "currency",
                        currency: "USD",
                      }).format(PERSONAL_MIN_STUDY_COST_CENTS / 100)}
                    </span>
                    <span className="text-zinc-500">{t("plans.individual.perStudy")}</span>
                  </div>
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
              <CardFooter className="relative mt-auto">
                <Button
                  className="w-full"
                  size="lg"
                  onClick={() => handleGetStarted("individual")}
                >
                  {t("plans.individual.cta")}
                </Button>
              </CardFooter>
            </Card>

            {/* Team Plan */}
            <Card className="relative flex flex-col overflow-hidden border-2 border-emerald-500 transition-all hover:shadow-lg">
              <div className="absolute top-0 right-0 h-32 w-32 translate-x-8 -translate-y-8 rounded-full bg-emerald-100 opacity-50" />
              <CardHeader className="relative">
                <div className="mb-2 flex items-center gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <CardTitle className="text-xl">{t("plans.team.title")}</CardTitle>
                </div>
                <CardDescription>
                  {t("plans.team.description")}
                </CardDescription>
              </CardHeader>
              <CardContent className="relative">
                <div className="mb-6">
                  <span className="text-sm text-zinc-500">{t("plans.team.from")}</span>
                  <div>
                    <span className="text-4xl font-bold">
                      {new Intl.NumberFormat(locale, {
                        style: "currency",
                        currency: "USD",
                      }).format(COMPANY_MIN_STUDY_COST_CENTS / 100)}
                    </span>
                    <span className="text-zinc-500">{t("plans.team.perStudy")}</span>
                  </div>
                </div>
                <p className="mb-3 text-sm font-medium text-zinc-700">
                  {t("plans.team.featuresHeader")}
                </p>
                <ul className="space-y-3">
                  {teamFeatures.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                      <span className="text-sm text-zinc-700">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter className="relative mt-auto">
                <Button
                  className="w-full bg-emerald-600 hover:bg-emerald-700"
                  size="lg"
                  onClick={() => handleGetStarted("team")}
                >
                  {t("plans.team.cta")}
                </Button>
              </CardFooter>
            </Card>
          </div>

          {/* Free trial callout */}
          <div className="mt-12 text-center">
            <p className="text-lg text-zinc-600 md:text-xl">
              {t("freeTrial.part1")}
              <span className="font-semibold text-zinc-900">
                {t("freeTrial.boldFreeStudies")}
              </span>{" "}
              {t("freeTrial.part2")}
            </p>
          </div>
        </div>
      </div>

      {/* How It Works Section */}
      <div className="bg-zinc-50 py-16">
        <div className="mx-auto flex max-w-5xl flex-col items-center px-8 text-center">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            {t("howItWorks.title")}
          </h2>
          <p className="mt-4 max-w-2xl text-lg text-zinc-600">
            {t("howItWorks.subtitle")}
          </p>

          <div className="mt-12 grid w-full grid-cols-1 gap-8 md:grid-cols-3">
            <div className="relative rounded-2xl bg-white p-8 shadow-sm">
              <div className="absolute -top-4 left-1/2 flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full bg-pink-500 text-sm font-bold text-white">
                1
              </div>
              <h3 className="mt-4 text-lg font-semibold">{t("howItWorks.step1.title")}</h3>
              <p className="mt-2 text-sm text-zinc-600">
                {t("howItWorks.step1.description")}
              </p>
            </div>

            <div className="relative rounded-2xl bg-white p-8 shadow-sm">
              <div className="absolute -top-4 left-1/2 flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full bg-pink-500 text-sm font-bold text-white">
                2
              </div>
              <h3 className="mt-4 text-lg font-semibold">{t("howItWorks.step2.title")}</h3>
              <p className="mt-2 text-sm text-zinc-600">
                {t("howItWorks.step2.description")}
              </p>
            </div>

            <div className="relative rounded-2xl bg-white p-8 shadow-sm">
              <div className="absolute -top-4 left-1/2 flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full bg-pink-500 text-sm font-bold text-white">
                3
              </div>
              <h3 className="mt-4 text-lg font-semibold">{t("howItWorks.step3.title")}</h3>
              <p className="mt-2 text-sm text-zinc-600">
                {t("howItWorks.step3.description")}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* FAQ Section */}
      <div className="bg-zinc-50 py-16">
        <div className="mx-auto flex max-w-3xl flex-col items-center px-8">
          <h2 className="text-center text-3xl font-bold tracking-tight md:text-4xl">
            {t("faq.title")}
          </h2>
          <p className="mt-4 text-center text-lg text-zinc-600">
            {t("faq.subtitle")}
          </p>

          <div className="mt-12 w-full divide-y divide-zinc-200 overflow-hidden rounded-xl border border-zinc-200">
            {faqs.map((faq, index) => (
              <div key={index} className="bg-white">
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
              {t("cta.title")}
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-zinc-600">
              {t("cta.description")}
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button size="lg" asChild>
                <Link href="/signin">{t("cta.ctaFree")}</Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/demo">{t("cta.ctaDemo")}</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <GlobalFooter />
    </div>
  );
}
