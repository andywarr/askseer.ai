"use client";

import { SidebarTrigger } from "@/apps/nextjs-app/components/ui/sidebar";

export function SidebarTriggerCollapsed() {
  return (
    <div className="mb-2 h-7 print:hidden">
      <SidebarTrigger />
    </div>
  );
}
