/**
 * Figma Plugin Auth Key Pair API
 *
 * Implements the read/write key pair pattern for Figma plugin OAuth as documented at:
 * https://developers.figma.com/docs/plugins/oauth-with-plugins/
 *
 * POST - Create a new read/write key pair (called by plugin)
 * GET - Poll for auth result using read key (called by plugin)
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/apps/nextjs-app/lib/db";
import { logger } from "@/apps/shared/logger";
import {
  pluginAuthLimiter,
  getClientIp,
} from "@/apps/nextjs-app/lib/rate-limit";
import { randomBytes } from "crypto";

const KEY_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

// CORS headers for Figma plugin (runs in sandbox with origin: null)
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// Handle CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, { headers: corsHeaders });
}

// Create a new read/write key pair
export async function POST(request: NextRequest) {
  const clientIp = getClientIp(request);

  // Check rate limit
  const { allowed, resetAt } = pluginAuthLimiter.check(clientIp);
  if (!allowed) {
    logger.warn("Plugin auth rate limit exceeded", { ip: clientIp });
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      {
        status: 429,
        headers: {
          ...corsHeaders,
          "Retry-After": String(Math.ceil((resetAt - Date.now()) / 1000)),
        },
      },
    );
  }

  try {
    const readKey = randomBytes(32).toString("hex");
    const writeKey = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + KEY_EXPIRY_MS);

    // Store both keys in VerificationToken
    // We use the writeKey as the identifier and readKey as the token
    // The "value" will be stored by the callback when auth completes
    await prisma.verificationToken.create({
      data: {
        identifier: `figma-plugin:${writeKey}`,
        token: readKey,
        expires: expiresAt,
      },
    });

    // Also clean up any expired tokens (opportunistic cleanup)
    await cleanupExpiredTokens();

    logger.info("Plugin auth key pair created", {
      ip: clientIp,
      readKey: readKey.slice(0, 8) + "...",
      writeKey: writeKey.slice(0, 8) + "...",
    });

    return NextResponse.json({ readKey, writeKey }, { headers: corsHeaders });
  } catch (error) {
    logger.error("Failed to create plugin auth key pair", {
      ip: clientIp,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Failed to create key pair" },
      { status: 500, headers: corsHeaders },
    );
  }
}

// Poll for auth result using the read key
export async function GET(request: NextRequest) {
  const clientIp = getClientIp(request);

  // Check rate limit (more lenient for polling)
  const { allowed, resetAt } = pluginAuthLimiter.check(clientIp);
  if (!allowed) {
    logger.warn("Plugin auth poll rate limit exceeded", { ip: clientIp });
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      {
        status: 429,
        headers: {
          ...corsHeaders,
          "Retry-After": String(Math.ceil((resetAt - Date.now()) / 1000)),
        },
      },
    );
  }

  try {
    const readKey = request.nextUrl.searchParams.get("readKey");

    if (!readKey) {
      logger.warn("Plugin auth poll missing readKey", { ip: clientIp });
      return NextResponse.json(
        { error: "Missing readKey" },
        { status: 400, headers: corsHeaders },
      );
    }

    // Find the token by readKey
    const verificationToken = await prisma.verificationToken.findFirst({
      where: {
        token: readKey,
        identifier: { startsWith: "figma-plugin:" },
      },
    });

    if (!verificationToken) {
      logger.warn("Plugin auth poll invalid key", {
        ip: clientIp,
        readKey: readKey.slice(0, 8) + "...",
      });
      return NextResponse.json(
        { error: "Invalid or expired key" },
        { status: 404, headers: corsHeaders },
      );
    }

    // Check if expired
    if (verificationToken.expires < new Date()) {
      await prisma.verificationToken.delete({
        where: {
          identifier_token: {
            identifier: verificationToken.identifier,
            token: verificationToken.token,
          },
        },
      });
      logger.info("Plugin auth key expired", {
        ip: clientIp,
        readKey: readKey.slice(0, 8) + "...",
      });
      return NextResponse.json(
        { error: "Key expired" },
        { status: 410, headers: corsHeaders },
      );
    }

    // Check if auth result has been written
    // We store the result in a separate token with identifier format: figma-plugin-result:{readKey}
    const resultToken = await prisma.verificationToken.findFirst({
      where: {
        identifier: `figma-plugin-result:${readKey}`,
      },
    });

    if (resultToken) {
      // Auth complete! Parse the result and clean up
      let result;
      try {
        result = JSON.parse(resultToken.token);
      } catch {
        result = { error: "Invalid result format" };
      }

      // Clean up both tokens
      await prisma.verificationToken.deleteMany({
        where: {
          OR: [
            { identifier: verificationToken.identifier, token: readKey },
            { identifier: `figma-plugin-result:${readKey}` },
          ],
        },
      });

      logger.info("Plugin auth completed and keys cleaned up", {
        ip: clientIp,
        readKey: readKey.slice(0, 8) + "...",
      });

      return NextResponse.json(result, { headers: corsHeaders });
    }

    // Not yet authenticated
    return NextResponse.json({ pending: true }, { headers: corsHeaders });
  } catch (error) {
    logger.error("Plugin auth poll failed", {
      ip: clientIp,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Poll failed" },
      { status: 500, headers: corsHeaders },
    );
  }
}

// Cleanup expired figma-plugin tokens (runs opportunistically)
async function cleanupExpiredTokens(): Promise<void> {
  try {
    const result = await prisma.verificationToken.deleteMany({
      where: {
        identifier: { startsWith: "figma-plugin" },
        expires: { lt: new Date() },
      },
    });

    if (result.count > 0) {
      logger.info("Cleaned up expired plugin auth tokens", {
        count: result.count,
      });
    }
  } catch (error) {
    // Non-critical, log and continue
    logger.warn("Failed to cleanup expired tokens", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
