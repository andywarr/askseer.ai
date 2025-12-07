"use client";

import { useEffect, useState } from "react";

import {
  SidebarTrigger,
  useSidebar,
} from "@/apps/nextjs-app/components/ui/sidebar";

export function SidebarTriggerCollapsed() {
  const { open, isMobile, openMobile } = useSidebar();
  const [showTrigger, setShowTrigger] = useState(!open || isMobile);

  useEffect(() => {
    // On mobile, always show the trigger (sidebar is in overlay mode)
    if (isMobile) {
      if (openMobile) {
        setShowTrigger(false);
      } else {
        setShowTrigger(true);
      }
      return;
    }

    // On desktop, show trigger when sidebar is closed
    if (open) {
      setShowTrigger(false);
    } else {
      // Delay showing the trigger to account for sidebar closing animation
      const timeout = setTimeout(() => {
        setShowTrigger(true);
      }, 200);
      return () => clearTimeout(timeout);
    }
  }, [open, isMobile, openMobile]);

  if (!showTrigger) {
    return null;
  }

  return <SidebarTrigger className="absolute top-[26px] left-4 print:hidden" />;
}
