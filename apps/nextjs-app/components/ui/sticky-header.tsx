"use client";

import * as React from "react";
import { cn } from "@/apps/nextjs-app/lib/utils/utils";

interface StickyHeaderProps {
  children: React.ReactNode;
  className?: string;
  stuckClassName?: string;
}

/**
 * A wrapper component that detects when a sticky header becomes "stuck"
 * and applies additional styling (like shadows) when content scrolls underneath.
 */
export function StickyHeader({
  children,
  className,
  stuckClassName = "shadow-[0_4px_6px_-4px_rgba(0,0,0,0.1)] dark:shadow-[0_4px_6px_-4px_rgba(0,0,0,0.3)]",
}: StickyHeaderProps) {
  const [isStuck, setIsStuck] = React.useState(false);
  const sentinelRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        // When the sentinel goes out of view (above viewport), header is stuck
        setIsStuck(!entry.isIntersecting);
      },
      {
        threshold: 0,
        rootMargin: "0px 0px 0px 0px",
      }
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <>
      {/* Sentinel element - when this scrolls out of view, the header is stuck */}
      <div ref={sentinelRef} className="h-0 w-full" aria-hidden="true" />
      <div className={cn(className, isStuck && stuckClassName)}>{children}</div>
    </>
  );
}
