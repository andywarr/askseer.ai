// Next imports
import { headers } from "next/headers";

// Lib imports
import { logger } from "@/apps/shared/logger";

// Custom components
import { GlobalHeader } from "@/apps/nextjs-app/components/layout/global-header";
import { GlobalFooter } from "@/apps/nextjs-app/components/layout/global-footer";
import { ContactForm } from "@/apps/nextjs-app/app/[locale]/(no-auth)/contact/contact-form";

export default async function ContactPage() {
  const headersList = await headers();

  // Log contact page view
  logger.info("Contact page viewed", {
    page: "/contact",
    action: "view",
    userAgent: headersList.get("user-agent"),
    referer: headersList.get("referer"),
  });

  return (
    <div className="flex min-h-screen w-full flex-col">
      {/* Hero Section with gradient background */}
      <div className="relative bg-gradient-to-b from-pink-100/30 via-white to-white">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(139,92,246,0.15),transparent)]" />
        <div className="relative mx-auto flex max-w-5xl flex-col items-center p-8">
          <GlobalHeader theme="light" />

          {/* Contact Form Section */}
          <div className="mt-4 flex flex-1 flex-col items-center justify-center py-12 md:mt-8">
            <ContactForm />
          </div>
        </div>
      </div>

      <GlobalFooter />
    </div>
  );
}
