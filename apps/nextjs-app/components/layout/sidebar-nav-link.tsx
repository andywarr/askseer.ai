"use client";

import Link from "next/link";
import { useSidebar } from "@/apps/nextjs-app/components/ui/sidebar";

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

  const handleClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  return (
    <Link href={href} onClick={handleClick} className={className}>
      {children}
    </Link>
  );
}
