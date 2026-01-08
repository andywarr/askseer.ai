/**
 * Figma OAuth authorization endpoint
 *
 * Initiates the OAuth flow by redirecting to Figma's authorization page.
 * A state parameter is used to prevent CSRF attacks.
 */

import { NextResponse } from "next/server";
import { auth } from "@/apps/nextjs-app/auth";
import { getFigmaAuthUrl } from "@/apps/nextjs-app/lib/figma/oauth";
import { randomUUID } from "crypto";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  try {
    // Ensure user is authenticated
    const session = await auth();
    if (!session?.user) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    // Get the return URL from query params (where to redirect after OAuth)
    const { searchParams } = new URL(request.url);
    const returnUrl = searchParams.get("returnUrl") || "/";

    // Generate a state token for CSRF protection
    const state = randomUUID();

    // Store state and return URL in cookies for verification on callback
    const cookieStore = await cookies();
    cookieStore.set("figma_oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 10, // 10 minutes
      path: "/",
    });
    cookieStore.set("figma_oauth_return_url", returnUrl, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 10, // 10 minutes
      path: "/",
    });

    // Redirect to Figma authorization
    const authUrl = getFigmaAuthUrl(state);
    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error("Error initiating Figma OAuth:", error);
    return NextResponse.redirect(
      new URL("/settings?error=figma_auth_failed", request.url),
    );
  }
}
