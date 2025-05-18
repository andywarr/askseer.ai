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

import { Inter } from "next/font/google";
const inter = Inter({ subsets: ["latin"], fallback: ["system-ui", "arial"] });

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
      <body className={inter.className}>
        <SidebarProvider>
          <AppSidebar />
          <main className="w-full">
            <SidebarTrigger className="ml-2 mt-2" />
            <div className="container mx-auto px-4 py-6">{children}</div>
          </main>
        </SidebarProvider>
        <Toaster />
      </body>
      <GoogleAnalytics gaId="G-MZ14C41Q1V" />
    </html>
  );
}
