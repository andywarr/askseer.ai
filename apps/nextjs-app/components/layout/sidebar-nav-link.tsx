"use client";

import Link from "next/link";
import { useSidebar } from "@/apps/nextjs-app/components/ui/sidebar";
import { useLocale } from "next-intl";

interface SidebarNavLinkProps {
  href: string;
  children: React.ReactNode;
  className?: string;
}

export function SidebarNavLink({
  href,
  children,
  className,
}: SidebarNavLinkProps) {
  const { setOpenMobile, isMobile } = useSidebar();
  const locale = useLocale();

  const handleClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  const localizedHref = locale === "en" ? href : `/${locale}${href}`;

  return (
    <Link href={localizedHref} onClick={handleClick} className={className}>
      {children}
    </Link>
  );
}
