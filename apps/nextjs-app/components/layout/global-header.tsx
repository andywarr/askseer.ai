import Image from "next/image";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";

import { Button } from "@/apps/nextjs-app/components/ui/button";

type ActivePage = "home" | "pricing" | "privacy" | "terms" | "signin";
type Theme = "light" | "dark";

interface GlobalHeaderProps {
  activePage?: ActivePage;
  theme?: Theme;
}

export function GlobalHeader({
  activePage,
  theme = "light",
}: GlobalHeaderProps) {
  const t = useTranslations("GlobalHeader");
  const locale = useLocale();

  const getLocalizedHref = (href: string) => {
    if (locale === "en") return href;
    return `/${locale}${href === "/" ? "" : href}`;
  };

  const navItems = [
    { href: "/home", label: t("home"), key: "home" as const },
    { href: "/pricing", label: t("pricing"), key: "pricing" as const },
  ];

  // Theme-based styling
  const themeClasses = {
    logo: theme === "dark" ? "text-white" : "text-black",
    logoImage: theme === "dark" ? "brightness-0 invert" : "",
    navLink: theme === "dark" ? "text-white!" : "text-black!",
    activeNavLink:
      theme === "dark"
        ? "text-white! font-semibold"
        : "text-black! font-semibold",
  };

  return (
    <div className="mb-16 flex h-8 w-full items-center justify-between">
      <div className="hidden items-center gap-2 p-2 sm:flex">
        <Image
          alt="logo"
          className={`hidden h-8 w-8 sm:block ${themeClasses.logoImage}`}
          src="/logo.svg"
          width={32}
          height={32}
        />
        <h1
          className={`hidden scroll-m-20 text-4xl font-extrabold tracking-tight md:block md:text-5xl ${themeClasses.logo}`}
        >
          Seer
        </h1>
      </div>
      <nav className="flex items-center gap-4 md:gap-6">
        {navItems.map((item) => {
          const isActive = activePage === item.key;
          return (
            <Button
              key={item.key}
              variant="link"
              asChild
              className={
                isActive
                  ? `cursor-default hover:no-underline ${themeClasses.activeNavLink}`
                  : themeClasses.navLink
              }
            >
              <Link key={item.key} href={getLocalizedHref(item.href)}>
                {item.label}
              </Link>
            </Button>
          );
        })}
      </nav>
      <div className="flex gap-4 items-center">
        <Button variant="default" asChild>
          <Link href={getLocalizedHref("/signin")}>{t("signIn")}</Link>
        </Button>
      </div>
    </div>
  );
}

