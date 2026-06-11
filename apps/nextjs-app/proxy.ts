import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import localesConfig from "./i18n/locales.json";

// Initialize next-intl middleware
const intlMiddleware = createMiddleware({
  // A list of all locales that are supported
  locales: localesConfig.locales,

  // Used when no locale matches
  defaultLocale: localesConfig.defaultLocale,

  // Hide the locale prefix for the default locale
  localePrefix: "as-needed",

  // Automatically detect the user's browser language, falling back to the default locale
  localeDetection: true,
});

// Routes that require authentication
const protectedRoutes = [
  "/evaluation",
  "/walkthrough",
  "/persona",
  "/studies",
  "/new",
  "/library",
  "/account",
  "/funds",
  "/team",
  "/teams",
  "/company",
];

export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // Normalize pathname to strip locale prefix for auth protection checks
  let cleanPathname = pathname;
  let activePrefix = "";
  for (const loc of localesConfig.locales) {
    if (loc === localesConfig.defaultLocale) continue;
    if (pathname.startsWith(`/${loc}/`)) {
      cleanPathname = pathname.substring(loc.length + 1);
      activePrefix = `/${loc}`;
      break;
    } else if (pathname === `/${loc}`) {
      cleanPathname = "/";
      activePrefix = `/${loc}`;
      break;
    }
  }

  // Check if this is a protected route
  const isProtectedRoute = protectedRoutes.some(
    (route) => cleanPathname === route || cleanPathname.startsWith(`${route}/`),
  );

  if (isProtectedRoute) {
    // Check for session cookie (NextAuth uses this pattern)
    const sessionCookie =
      req.cookies.get("authjs.session-token") ||
      req.cookies.get("__Secure-authjs.session-token");

    if (!sessionCookie) {
      // User is not authenticated, redirect to signin with callback URL
      const callbackUrl = `${pathname}${search}`;
      const signinPath = activePrefix ? `${activePrefix}/signin` : "/signin";
      const signinUrl = new URL(signinPath, req.url);
      signinUrl.searchParams.set("callbackUrl", callbackUrl);
      return NextResponse.redirect(signinUrl);
    }
  }

  // Pass the request to next-intl middleware
  return intlMiddleware(req);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api routes (they handle their own auth)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, robots.txt, etc.
     * - public files (images, etc.)
     */
    "/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.png$|.*\\.jpg$|.*\\.svg$).*)",
  ],
};
