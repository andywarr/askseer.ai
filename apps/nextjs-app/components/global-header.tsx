import Image from "next/image";
import Link from "next/link";

import { Button } from "@/apps/nextjs-app/components/ui/button";

type ActivePage = "home" | "about" | "pricing" | "contact";
type Theme = "light" | "dark";

interface GlobalHeaderProps {
  activePage?: ActivePage;
  theme?: Theme;
}

export function GlobalHeader({
  activePage,
  theme = "light",
}: GlobalHeaderProps) {
  const navItems = [
    { href: "/home", label: "Home", key: "home" as const },
    { href: "/pricing", label: "Pricing", key: "pricing" as const },
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
      <nav className="mr-4 flex items-center gap-4 sm:ml-4 md:gap-6">
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
              <Link key={item.key} href={item.href}>
                {item.label}
              </Link>
            </Button>
          );
        })}
      </nav>
      <div className="flex gap-4">
        <Button variant="default" asChild>
          <Link href="/signin">Sign in</Link>
        </Button>
      </div>
    </div>
  );
}
