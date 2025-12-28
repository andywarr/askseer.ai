"use client";

import { SidebarTrigger } from "@/apps/nextjs-app/components/ui/sidebar";

export function SidebarTriggerCollapsed() {
  return (
    <div className="print:hidden">
      <SidebarTrigger />
    </div>
  );
}
