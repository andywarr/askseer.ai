/**
 * Figma OAuth callback endpoint
 *
 * Handles the redirect from Figma after user authorization.
 * Exchanges the authorization code for access tokens and stores them.
 */

import { NextResponse } from "next/server";
import { auth } from "@/apps/nextjs-app/auth";
import {
  exchangeFigmaCode,
  storeFigmaTokens,
} from "@/apps/nextjs-app/lib/figma-oauth";
import { cookies } from "next/headers";
import { logger } from "@/apps/shared/logger";

export async function GET(request: Request) {
  let returnUrl = "/settings";

  try {
    // Ensure user is authenticated
    const session = await auth();
    if (!session?.user) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    // Get stored state and return URL from cookies
    const cookieStore = await cookies();
    const storedState = cookieStore.get("figma_oauth_state")?.value;
    returnUrl = cookieStore.get("figma_oauth_return_url")?.value || "/error";

    // Clean up cookies
    cookieStore.delete("figma_oauth_state");
    cookieStore.delete("figma_oauth_return_url");

    // Handle OAuth errors
    if (error) {
      logger.warn("Figma OAuth error", { error });
      const errorUrl = new URL(returnUrl, request.url);
      errorUrl.searchParams.set("figma_error", error);
      return NextResponse.redirect(errorUrl);
    }

    // Validate state to prevent CSRF
    if (!state || state !== storedState) {
      logger.warn("Figma OAuth state mismatch", {
        received: state,
        expected: storedState,
      });
      const errorUrl = new URL(returnUrl, request.url);
      errorUrl.searchParams.set("figma_error", "invalid_state");
      return NextResponse.redirect(errorUrl);
    }

    // Validate code
    if (!code) {
      const errorUrl = new URL(returnUrl, request.url);
      errorUrl.searchParams.set("figma_error", "no_code");
      return NextResponse.redirect(errorUrl);
    }

    // Exchange code for tokens
    logger.info("Exchanging Figma code for tokens");
    const tokens = await exchangeFigmaCode(code);
    logger.info("Received Figma tokens", {
      hasAccessToken: !!tokens.access_token,
      hasRefreshToken: !!tokens.refresh_token,
      hasUserId: !!tokens.user_id,
      expiresIn: tokens.expires_in,
    });

    // Get the user ID from the session or database
    let userId = (session.user as any).id;
    if (!userId) {
      // If no ID in session, we need to look it up by email
      const { default: prisma } = await import("@/apps/nextjs-app/lib/db");
      const user = await prisma.user.findUnique({
        where: { email: session.user.email! },
        select: { id: true },
      });
      if (!user) {
        throw new Error("User not found");
      }
      userId = user.id;
    }

    await storeFigmaTokens(userId, tokens);

    logger.info("Successfully connected Figma account", {
      userId,
      figmaUserId: tokens.user_id,
    });

    // Redirect back to the original page with success
    const successUrl = new URL(returnUrl, request.url);
    successUrl.searchParams.set("figma_connected", "true");
    return NextResponse.redirect(successUrl);
  } catch (error) {
    logger.error("Error in Figma OAuth callback", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    const errorUrl = new URL(returnUrl, request.url);
    errorUrl.searchParams.set("figma_error", "callback_failed");
    return NextResponse.redirect(errorUrl);
  }
}
