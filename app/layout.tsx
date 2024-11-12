// Next imports
import type { Metadata } from "next";
import { GoogleAnalytics } from "@next/third-parties/google";

// NextAuth imports
import { auth } from "@/auth";

// UI component imports
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

import "./globals.css";

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
  const session = await auth();

  return (
    <html lang="en">
      <body className={inter.className}>
        {session ? (
          <SidebarProvider>
            <AppSidebar />
            <main className="w-full">
              <SidebarTrigger className="ml-2 mt-2" />
              <div className="container mx-auto px-4 py-6">{children}</div>
            </main>
          </SidebarProvider>
        ) : (
          <>{children}</>
        )}
      </body>
      <GoogleAnalytics gaId="G-MZ14C41Q1V" />
    </html>
  );
}
