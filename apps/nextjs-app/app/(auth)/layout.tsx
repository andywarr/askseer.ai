// Next imports
import { GoogleAnalytics } from "@next/third-parties/google";
import type { Metadata } from "next";
import { Toaster } from "sonner";

// UI component imports
import { AppSidebar } from "@/apps/nextjs-app/components/app-sidebar";
import {
  SidebarProvider,
  SidebarTrigger,
} from "@/apps/nextjs-app/components/ui/sidebar";

import "@/apps/nextjs-app/app/globals.css";

import { Roboto, Roboto_Serif } from "next/font/google";
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
          <AppSidebar />
          <main className="w-full">
            <SidebarTrigger className="ml-2 mt-2" />
            <div className="container mx-auto px-4 py-6">{children}</div>
          </main>
        </SidebarProvider>
        <Toaster />
        <GoogleAnalytics gaId="G-MZ14C41Q1V" />
      </body>
    </html>
  );
}
