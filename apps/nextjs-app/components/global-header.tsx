import Image from "next/image";
import Link from "next/link";

import { Button } from "@/apps/nextjs-app/components/ui/button";

type ActivePage = "home" | "about" | "pricing" | "contact";
type PrimaryCta = "buyCredits" | "signIn";

interface GlobalHeaderProps {
  activePage?: ActivePage;
  primaryCta?: PrimaryCta;
  onBuyCreditsClick?: () => void;
}

export function GlobalHeader({
  activePage,
  primaryCta = "buyCredits",
  onBuyCreditsClick,
}: GlobalHeaderProps) {
  const navItems = [
    { href: "/", label: "Home", key: "home" as const },
    // { href: "/about", label: "About", key: "about" as const },
    { href: "/pricing", label: "Pricing", key: "pricing" as const },
    // { href: "/contact", label: "Contact", key: "contact" as const },
  ];

  return (
    <div className="mb-16 flex h-8 w-full items-center justify-between">
      <div className="hidden items-center gap-2 p-2 sm:flex">
        <Image
          alt="logo"
          className="hidden h-8 w-8 sm:block"
          src="/logo.svg"
          width={32}
          height={32}
        />
        <h1 className="hidden scroll-m-20 text-4xl font-extrabold tracking-tight text-black md:block md:text-5xl">
          Seer
        </h1>
      </div>
      <nav className="mr-4 flex items-center gap-4 sm:ml-4 md:gap-6">
        {navItems.map((item) => {
          const isActive = activePage === item.key;
          return (
            <Button key={item.key} variant="link" asChild>
              <Link
                key={item.key}
                href={item.href}
                className={
                  isActive
                    ? "cursor-default font-semibold hover:no-underline"
                    : ""
                }
              >
                {item.label}
              </Link>
            </Button>
          );
        })}
      </nav>
      <div className="flex gap-4">
        {onBuyCreditsClick ? (
          <Button
            variant={primaryCta === "buyCredits" ? "default" : "outline"}
            onClick={onBuyCreditsClick}
          >
            Buy credits
          </Button>
        ) : (
          <Button
            variant={primaryCta === "buyCredits" ? "default" : "outline"}
            asChild
          >
            <Link href="/pricing">Buy credits</Link>
          </Button>
        )}
        <Button
          variant={primaryCta === "signIn" ? "default" : "outline"}
          asChild
        >
          <Link href="/">Sign in</Link>
        </Button>
      </div>
    </div>
  );
}
