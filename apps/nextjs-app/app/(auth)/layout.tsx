// Next imports
import Image from "next/image";
import { GoogleAnalytics } from "@next/third-parties/google";
import type { Metadata } from "next";

// Lib imports
import { getCurrentSession, isUserAdmin } from "@/apps/nextjs-app/lib/db/user";
import { logger } from "@/apps/shared/logger";

// UI component imports
import { AppSidebar } from "@/apps/nextjs-app/components/layout/app-sidebar";
import { NotificationBell } from "@/apps/nextjs-app/components/layout/notification-bell";
import { SidebarTriggerCollapsed } from "@/apps/nextjs-app/components/layout/sidebar-trigger-collapsed";
import { SidebarProvider } from "@/apps/nextjs-app/components/ui/sidebar";
import { Toaster } from "sonner";

import "@/apps/nextjs-app/app/globals.css";

import { Roboto, Roboto_Serif } from "next/font/google";
import { get } from "http";
const roboto = Roboto({
  subsets: ["latin"],
  weight: ["100", "400", "700", "900"],
  fallback: ["system-ui", "arial"],
});
const robotoSerif = Roboto_Serif({
  subsets: ["latin"],
  weight: ["200", "400", "700", "900"],
  fallback: ["system-ui", "arial"],
});

export const metadata: Metadata = {
  title: "Seer",
  description:
    "AI-assisted research. Save hours on research with the click of a button.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getCurrentSession();

  logger.debug("Session authenticated", {
    userId: session.userId,
  });

  const isAdmin = await isUserAdmin(session.userId);

  return (
    <html lang="en">
      <body
        className={roboto.className}
        style={
          {
            "--font-roboto": roboto.style.fontFamily,
            "--font-roboto-serif": robotoSerif.style.fontFamily,
          } as React.CSSProperties
        }
      >
        <SidebarProvider>
          <div className="print:hidden">
            <AppSidebar />
          </div>
          <main className="relative min-w-0 flex-1">
            <div className="container mx-auto px-4 py-4">
              <div className="relative mb-4 flex w-full items-center justify-center">
                <div className="absolute left-0 flex items-center">
                  <SidebarTriggerCollapsed />
                </div>
                <div className="mx-auto flex items-center gap-2">
                  <Image
                    src="/logo.svg"
                    alt="Seer logo"
                    width={32}
                    height={32}
                    className="h-8 w-8"
                  />
                  <span className="text-3xl font-extrabold tracking-tight">
                    Seer
                  </span>
                </div>
                <div className="absolute right-0 flex items-center">
                  <NotificationBell userId={session.userId} isAdmin={isAdmin} />
                </div>
              </div>
              <div className="mt-8">{children}</div>
            </div>
          </main>
        </SidebarProvider>
        <Toaster />
        {process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID && (
          <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID} />
        )}
      </body>
    </html>
  );
}
