/**
 * Figma OAuth utilities
 *
 * This module provides functions for Figma OAuth authentication flow.
 * Users connect their Figma account to enable importing designs directly
 * without needing to manage personal access tokens.
 *
 * OAuth Flow:
 * 1. User clicks "Connect Figma" button
 * 2. Redirect to Figma authorization page
 * 3. Figma redirects back with authorization code
 * 4. Exchange code for access/refresh tokens
 * 5. Store tokens in database linked to user
 * 6. Use tokens for API requests
 */

import prisma from "@/apps/nextjs-app/lib/db/db";
import { logger } from "@/apps/shared/logger";

// Figma OAuth configuration
const FIGMA_CLIENT_ID = process.env.FIGMA_CLIENT_ID!;
const FIGMA_CLIENT_SECRET = process.env.FIGMA_CLIENT_SECRET!;
const FIGMA_REDIRECT_URI =
  process.env.FIGMA_REDIRECT_URI ||
  `${process.env.NEXTAUTH_URL}/api/figma/callback`;

const FIGMA_AUTH_URL = "https://www.figma.com/oauth";
const FIGMA_TOKEN_URL = "https://api.figma.com/v1/oauth/token";
const FIGMA_API_BASE_URL = "https://api.figma.com/v1";

// Scopes needed for Figma operations
// file_content:read: Read files, projects, and images
// file_comments:write: Post comments to files
const FIGMA_SCOPES = ["file_content:read", "file_comments:write"];

export interface FigmaTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user_id: string;
}

export interface FigmaUser {
  id: string;
  email: string;
  handle: string;
  img_url: string;
}

/**
 * Generate the Figma OAuth authorization URL
 */
export function getFigmaAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: FIGMA_CLIENT_ID,
    redirect_uri: FIGMA_REDIRECT_URI,
    scope: FIGMA_SCOPES.join(","),
    state,
    response_type: "code",
  });

  return `${FIGMA_AUTH_URL}?${params.toString()}`;
}

/**
 * Exchange authorization code for access tokens
 */
export async function exchangeFigmaCode(code: string): Promise<FigmaTokens> {
  const response = await fetch(FIGMA_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: FIGMA_CLIENT_ID,
      client_secret: FIGMA_CLIENT_SECRET,
      redirect_uri: FIGMA_REDIRECT_URI,
      code,
      grant_type: "authorization_code",
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    logger.error("Failed to exchange Figma code for tokens", {
      status: response.status,
      error,
    });
    throw new Error(`Failed to exchange Figma code: ${error}`);
  }

  return response.json();
}

/**
 * Refresh Figma access token using refresh token
 */
export async function refreshFigmaToken(
  refreshToken: string,
): Promise<FigmaTokens> {
  const response = await fetch(FIGMA_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: FIGMA_CLIENT_ID,
      client_secret: FIGMA_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    logger.error("Failed to refresh Figma token", {
      status: response.status,
      error,
    });
    throw new Error(`Failed to refresh Figma token: ${error}`);
  }

  return response.json();
}

/**
 * Get the current Figma user info
 */
export async function getFigmaUser(accessToken: string): Promise<FigmaUser> {
  const response = await fetch(`${FIGMA_API_BASE_URL}/me`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Figma user: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Store Figma tokens for a user in the database
 */
export async function storeFigmaTokens(
  userId: string,
  tokens: FigmaTokens,
): Promise<void> {
  const expiresAt = Math.floor(Date.now() / 1000) + tokens.expires_in;
  // Ensure user_id is a string (Figma returns it as a number)
  const figmaUserId = String(tokens.user_id);

  // Use upsert to handle both new connections and re-connections
  await prisma.account.upsert({
    where: {
      provider_providerAccountId: {
        provider: "figma",
        providerAccountId: figmaUserId,
      },
    },
    update: {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: expiresAt,
      userId, // Update userId in case user reconnects from different account
    },
    create: {
      userId,
      type: "oauth",
      provider: "figma",
      providerAccountId: figmaUserId,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: expiresAt,
      token_type: "Bearer",
      scope: FIGMA_SCOPES.join(","),
    },
  });

  logger.info("Stored Figma tokens for user", { userId });
}

/**
 * Get valid Figma access token for a user, refreshing if necessary
 */
export async function getFigmaAccessToken(
  userId: string,
): Promise<string | null> {
  const account = await prisma.account.findFirst({
    where: {
      userId,
      provider: "figma",
    },
  });

  if (!account) {
    return null;
  }

  // Check if token is expired (with 5 minute buffer)
  const now = Math.floor(Date.now() / 1000);
  const isExpired = account.expires_at && account.expires_at < now + 300;

  if (isExpired && account.refresh_token) {
    try {
      const newTokens = await refreshFigmaToken(account.refresh_token);

      // Store the new tokens
      await prisma.account.update({
        where: {
          provider_providerAccountId: {
            provider: "figma",
            providerAccountId: account.providerAccountId,
          },
        },
        data: {
          access_token: newTokens.access_token,
          refresh_token: newTokens.refresh_token,
          expires_at: Math.floor(Date.now() / 1000) + newTokens.expires_in,
        },
      });

      return newTokens.access_token;
    } catch (error) {
      logger.error("Failed to refresh Figma token", {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  return account.access_token;
}

/**
 * Check if user has connected their Figma account
 */
export async function hasFigmaConnection(userId: string): Promise<boolean> {
  const account = await prisma.account.findFirst({
    where: {
      userId,
      provider: "figma",
    },
    select: { provider: true },
  });

  return !!account;
}

/**
 * Get Figma connection info for a user
 */
export async function getFigmaConnection(userId: string): Promise<{
  connected: boolean;
  figmaUserId?: string;
} | null> {
  const account = await prisma.account.findFirst({
    where: {
      userId,
      provider: "figma",
    },
    select: {
      providerAccountId: true,
    },
  });

  if (!account) {
    return { connected: false };
  }

  return {
    connected: true,
    figmaUserId: account.providerAccountId,
  };
}

/**
 * Disconnect Figma account from user
 */
export async function disconnectFigma(userId: string): Promise<boolean> {
  try {
    await prisma.account.deleteMany({
      where: {
        userId,
        provider: "figma",
      },
    });

    logger.info("Disconnected Figma account for user", { userId });
    return true;
  } catch (error) {
    logger.error("Failed to disconnect Figma account", {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}
