import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Routes that require authentication
const protectedRoutes = [
  "/evaluation",
  "/walkthrough",
  "/persona",
  "/studies",
  "/new",
  "/library",
  "/account",
  "/credits",
  "/team",
  "/company",
];

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // Check if this is a protected route
  const isProtectedRoute = protectedRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  if (isProtectedRoute) {
    // Check for session cookie (NextAuth uses this pattern)
    const sessionCookie =
      req.cookies.get("authjs.session-token") ||
      req.cookies.get("__Secure-authjs.session-token");

    if (!sessionCookie) {
      // User is not authenticated, redirect to signin with callback URL
      const callbackUrl = `${pathname}${search}`;
      const signinUrl = new URL("/signin", req.url);
      signinUrl.searchParams.set("callbackUrl", callbackUrl);
      return NextResponse.redirect(signinUrl);
    }
  }

  return NextResponse.next();
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
