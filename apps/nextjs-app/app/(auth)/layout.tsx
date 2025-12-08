// Next imports
import { GoogleAnalytics } from "@next/third-parties/google";
import type { Metadata } from "next";

// Lib imports
import { getCurrentSession } from "@/apps/nextjs-app/lib/user";
import { logger } from "@/apps/shared/logger";

// UI component imports
import { AppSidebar } from "@/apps/nextjs-app/components/app-sidebar";
import { SidebarTriggerCollapsed } from "@/apps/nextjs-app/components/sidebar-trigger-collapsed";
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
            <div className="container mx-auto px-4 py-6">
              <SidebarTriggerCollapsed />
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
