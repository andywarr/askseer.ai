"use client";

import { useSidebar } from "@/apps/nextjs-app/components/ui/sidebar";
import { useIsMobile } from "@/apps/nextjs-app/hooks/use-mobile";

/**
 * A fixed footer bar that sits at the bottom of the page,
 * respecting the sidebar width (expanded or collapsed).
 */
export function StickyFormFooter({ children }: { children: React.ReactNode }) {
  const { state } = useSidebar();
  const isMobile = useIsMobile();

  const leftOffset = isMobile
    ? "0px"
    : state === "collapsed"
      ? "0px"
      : "var(--sidebar-width)";

  return (
    <>
      <div
        className="fixed bottom-0 right-0 z-10 border-t bg-background px-6 py-4 shadow-[0_-4px_12px_rgba(0,0,0,0.05)] transition-[left] duration-200 ease-linear dark:shadow-[0_-4px_12px_rgba(0,0,0,0.2)]"
        style={{ left: leftOffset }}
      >
        <div className="container mx-auto">{children}</div>
      </div>
      {/* Spacer so content isn't hidden behind the fixed footer */}
      <div className="h-20" />
    </>
  );
}
