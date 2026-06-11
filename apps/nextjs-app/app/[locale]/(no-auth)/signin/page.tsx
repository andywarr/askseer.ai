// Next imports
import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";

// NextAuth imports
import { auth } from "@/apps/nextjs-app/auth";

// Lib imports
import { logger } from "@/apps/shared/logger";

// Component imports
import { GoogleSignIn } from "@/apps/nextjs-app/components/auth/google-sign-in";
import { ResendSignIn } from "@/apps/nextjs-app/components/auth/resend-sign-in";

// UI component imports
import { Separator } from "@/apps/nextjs-app/components/ui/separator";

// Custom components
import { GlobalHeader } from "@/apps/nextjs-app/components/layout/global-header";

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "SignInPage" });

  const getLocalizedHref = (href: string) => {
    if (locale === "en") return href;
    return `/${locale}${href === "/" ? "" : href}`;
  };

  const session = await auth();
  const headersList = await headers();
  const userAgent = headersList.get("user-agent") ?? "";
  const isInAppBrowser =
    /(Instagram|FBAN|FBAV|FB_IAB|Messenger|LinkedIn|TikTok|Twitter|Snapchat|Reddit|Pinterest|MicroMessenger|Line|Slack|Discord)/i.test(
      userAgent,
    );

  const resolvedSearchParams = await searchParams;
  const callbackUrl = resolvedSearchParams.callbackUrl;

  // Helper to validate callbackUrl - must be a relative path or same-origin URL
  const isValidCallback = (url: string | undefined): string | null => {
    if (!url) return null;
    // Accept relative paths starting with /
    if (url.startsWith("/")) return url;
    // Accept same-origin absolute URLs
    try {
      const parsed = new URL(url);
      const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
      const base = new URL(baseUrl);
      if (parsed.origin === base.origin) {
        return parsed.pathname + parsed.search;
      }
    } catch {
      // Invalid URL
    }
    return null;
  };

  const validCallback = isValidCallback(callbackUrl);

  if (session) {
    // Respect callbackUrl if provided (e.g., for Figma plugin OAuth)
    if (validCallback) {
      redirect(validCallback);
    }
    redirect("/studies");
  }

  // Log sign in page view
  logger.info("Sign in page viewed", {
    page: "/signin",
    action: "view",
    userAgent,
    referer: headersList.get("referer"),
  });

  return (
    <div className="animate-gradient min-h-screen w-full bg-linear-to-r from-red-400 via-pink-500 to-blue-500 bg-size-[400%_400%]">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col items-center p-8">
        <GlobalHeader theme="dark" />

        {/* Login Section */}
        <div className="flex flex-1 flex-col items-center justify-center">
          <div className="w-full max-w-sm">
            <div className="rounded-xl border border-white/30 bg-white/20 p-6 shadow-xl backdrop-blur-xl">
              <ResendSignIn callbackUrl={validCallback ?? undefined} />
              <Separator />
              <GoogleSignIn
                isInAppBrowser={isInAppBrowser}
                callbackUrl={validCallback ?? undefined}
                buttonText={t("signInWithGoogle")}
                inAppWarning={t("googleNotAvailable")}
              />
            </div>

            <p className="mt-6 text-center text-sm text-white/80">
              {t.rich("disclaimer", {
                privacy: (chunks) => (
                  <Link className="underline hover:text-white" href={getLocalizedHref("/privacy")}>
                    {chunks}
                  </Link>
                ),
                terms: (chunks) => (
                  <Link className="underline hover:text-white" href={getLocalizedHref("/terms")}>
                    {chunks}
                  </Link>
                ),
              })}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
