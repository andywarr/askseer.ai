import "@/apps/nextjs-app/app/globals.css";

import { Roboto } from "next/font/google";
import { Toaster } from "sonner";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";

const roboto = Roboto({
  subsets: ["latin"],
  weight: ["100", "400", "700", "900"],
  fallback: ["system-ui", "arial"],
});

export const metadata = {
  title: "Seer – Live Session",
};

export default async function LiveLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  const messages = await getMessages();

  return (
    <html lang={locale} className="dark">
      <body className={`${roboto.className} bg-zinc-950 text-zinc-100`}>
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
          <Toaster />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
