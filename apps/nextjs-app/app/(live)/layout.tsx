import "@/apps/nextjs-app/app/globals.css";

import { Roboto } from "next/font/google";
import { Toaster } from "sonner";

const roboto = Roboto({
  subsets: ["latin"],
  weight: ["100", "400", "700", "900"],
  fallback: ["system-ui", "arial"],
});

export const metadata = {
  title: "Seer – Live Session",
};

export default function LiveLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${roboto.className} bg-zinc-950 text-zinc-100`}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
