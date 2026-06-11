"use client";

import Image from "next/image";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { UniversalLanguageSelector } from "@/apps/nextjs-app/components/i18n/universal-language-selector";

export function GlobalFooter() {
  const t = useTranslations("GlobalFooter");
  const locale = useLocale();

  const getLocalizedHref = (href: string) => {
    if (locale === "en" || href.startsWith("http") || href.startsWith("mailto")) {
      return href;
    }
    return `/${locale}${href === "/" ? "" : href}`;
  };

  return (
    <footer className="relative mt-auto w-full">
      {/* Gradient background with top fade */}
      <div className="absolute inset-0 bg-linear-to-r from-red-400/30 via-pink-500/30 to-blue-500/30" />
      <div className="absolute inset-0 bg-linear-to-b from-white via-transparent to-transparent" />

      <div className="relative mx-auto max-w-5xl px-8 pt-0 pb-16 md:pt-32">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-12 lg:grid-cols-4">
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
              {t("brandText")}
            </p>
            <p className="mt-4 text-sm text-zinc-500">
              {t("allRightsReserved", { year: new Date().getFullYear() })}
            </p>

            {/* Simple Text Language Switcher */}
            <div className="mt-6 flex items-center">
              <UniversalLanguageSelector
                triggerVariant="ghost"
                triggerSize="sm"
                className="h-8 -ml-3 text-xs text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
              />
            </div>
          </div>

          {/* Product Column */}
          <div className="flex flex-col gap-2 pt-[46px]">
            <Link
              href={getLocalizedHref("/home")}
              className="block text-sm text-zinc-700 hover:text-zinc-900 hover:underline"
            >
              {t("home")}
            </Link>
            <Link
              href={getLocalizedHref("/pricing")}
              className="block text-sm text-zinc-700 hover:text-zinc-900 hover:underline"
            >
              {t("pricing")}
            </Link>
            <Link
              href={getLocalizedHref("/updates")}
              className="block text-sm text-zinc-700 hover:text-zinc-900 hover:underline"
            >
              {t("updates")}
            </Link>
          </div>

          {/* Legal Column */}
          <div className="flex flex-col gap-2 pt-[46px]">
            <Link
              href="https://www.linkedin.com/company/askseer/about/"
              target="_blank"
              rel="noopener noreferrer"
              className="block text-sm text-zinc-700 hover:text-zinc-900 hover:underline"
            >
              LinkedIn
            </Link>
            <Link
              href={getLocalizedHref("/privacy")}
              className="block text-sm text-zinc-700 hover:text-zinc-900 hover:underline"
            >
              {t("privacy")}
            </Link>
            <Link
              href={getLocalizedHref("/terms")}
              className="block text-sm text-zinc-700 hover:text-zinc-900 hover:underline"
            >
              {t("terms")}
            </Link>
          </div>

          {/* Actions Column */}
          <div className="flex flex-col gap-2 pt-[46px]">
            <Link
              href={getLocalizedHref("/signin")}
              className="block text-sm text-zinc-700 hover:text-zinc-900 hover:underline"
            >
              {t("signIn")}
            </Link>
            <Link
              href={getLocalizedHref("/demo")}
              className="block text-sm text-zinc-700 hover:text-zinc-900 hover:underline"
            >
              {t("requestDemo")}
            </Link>
            <Link
              href={getLocalizedHref("/contact")}
              className="block text-sm text-zinc-700 hover:text-zinc-900 hover:underline"
            >
              {t("contact")}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

