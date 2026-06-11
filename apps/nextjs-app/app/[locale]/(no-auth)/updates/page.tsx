// Next imports
import { headers } from "next/headers";

// Lib imports
import { logger } from "@/apps/shared/logger";

// Custom components
import { GlobalFooter } from "@/apps/nextjs-app/components/layout/global-footer";
import { GlobalHeader } from "@/apps/nextjs-app/components/layout/global-header";

// next-intl imports
import { getTranslations } from "next-intl/server";

import releaseNotes from "./release-notes.generated.json";

type ReleaseNotes = typeof releaseNotes;

function formatHumanDateUtc(date: Date, locale: string) {
  const fmt = new Intl.DateTimeFormat(locale, {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
  return fmt.format(date);
}

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const headersList = await headers();

  logger.info("Release notes page viewed", {
    page: "/notes",
    action: "view",
    userAgent: headersList.get("user-agent"),
    referer: headersList.get("referer"),
  });

  const t = await getTranslations({ locale, namespace: "UpdatesPage" });
  const data = releaseNotes as ReleaseNotes;
  const generatedAt = data.generatedAt ? new Date(data.generatedAt) : null;

  return (
    <div className="flex min-h-screen w-full flex-col">
      {/* Hero Section with gradient background */}
      <div className="relative bg-linear-to-b from-pink-100/30 via-white to-white">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(139,92,246,0.15),transparent)]" />
        <div className="relative mx-auto flex max-w-5xl flex-col items-center p-8">
          <GlobalHeader theme="light" />

          {/* Hero Content */}
          <div className="mt-16 flex flex-col items-center text-center md:mt-24">
            <h1 className="scroll-m-20 text-4xl font-extrabold tracking-tight md:text-5xl lg:text-6xl">
              {t("title")}
            </h1>
            <p className="mt-6 max-w-2xl text-lg text-zinc-600 md:text-xl">
              {t("subtitle")}
            </p>
            {generatedAt && (
              <p className="mt-2 text-sm text-zinc-500">
                {t("lastGenerated", { date: formatHumanDateUtc(generatedAt, locale) })}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="mx-auto flex w-full max-w-5xl flex-col p-8">
        {data.weeks.length === 0 ? (
          <p className="mt-8 leading-7 not-first:mt-6">{t("noNotes")}</p>
        ) : (
          <div className="mt-8 flex flex-col gap-12">
            {data.weeks.map((week) => (
              <section
                key={week.weekStart}
                id={`week-${week.weekStart}`}
                className="scroll-mt-24"
              >
                <h3 className="scroll-m-20 text-2xl font-semibold tracking-tight">
                  {week.label}
                </h3>
                <p className="mt-3 leading-7 text-zinc-600">{week.summary}</p>

                {week.stats && (
                  <p className="mt-2 text-sm text-zinc-500">
                    {t("stats", {
                      features: week.stats.totalFeatures,
                      fixes: week.stats.totalFixes,
                      commits: week.stats.totalCommits,
                    })}
                  </p>
                )}

                <div className="mt-6 flex flex-col gap-6">
                  {week.sections?.map((section) => (
                    <div key={section.title}>
                      <h4 className="scroll-m-20 text-xl font-semibold tracking-tight">
                        {section.title}
                      </h4>
                      <ul className="my-4 ml-6 list-disc leading-7 [&>li]:mt-2">
                        {section.items.map((text) => (
                          <li key={text}>{text}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      <GlobalFooter />
    </div>
  );
}
