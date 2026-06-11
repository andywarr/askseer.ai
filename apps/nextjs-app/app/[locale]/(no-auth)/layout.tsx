// Next imports
import { GoogleAnalytics } from "@next/third-parties/google";
import type { Metadata } from "next";
import { Toaster } from "sonner";

import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";

import "@/apps/nextjs-app/app/globals.css";

import { Parisienne, Roboto, Roboto_Serif } from "next/font/google";
const parisienne = Parisienne({
  subsets: ["latin"],
  weight: ["400"],
  fallback: ["system-ui", "arial"],
});
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
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body
        className={roboto.className}
        style={
          {
            "--font-parisienne": parisienne.style.fontFamily,
            "--font-roboto": roboto.style.fontFamily,
            "--font-roboto-serif": robotoSerif.style.fontFamily,
          } as React.CSSProperties
        }
      >
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
        </NextIntlClientProvider>
        <Toaster />
        {process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID && (
          <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID} />
        )}
      </body>
    </html>
  );
}

