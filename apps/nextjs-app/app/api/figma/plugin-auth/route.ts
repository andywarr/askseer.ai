/**
 * Figma Plugin Auth Key Pair API
 * 
 * Implements the read/write key pair pattern for Figma plugin OAuth as documented at:
 * https://developers.figma.com/docs/plugins/oauth-with-plugins/
 * 
 * POST - Create a new read/write key pair (called by plugin)
 * GET - Poll for auth result using read key (called by plugin)
 * PUT - Write auth result using write key (called by callback page)
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/apps/nextjs-app/lib/db";
import { logger } from "@/apps/shared/logger";
import { randomBytes } from "crypto";

const KEY_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

// CORS headers for Figma plugin (runs in sandbox with origin: null)
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Handle CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, { headers: corsHeaders });
}

// Create a new read/write key pair
export async function POST() {
  try {
    const readKey = randomBytes(32).toString('hex');
    const writeKey = randomBytes(32).toString('hex');
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

    logger.info("Plugin auth key pair created", { 
      readKey: readKey.slice(0, 8) + '...',
      writeKey: writeKey.slice(0, 8) + '...',
    });

    return NextResponse.json({ readKey, writeKey }, { headers: corsHeaders });
  } catch (error) {
    logger.error("Failed to create plugin auth key pair", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Failed to create key pair" },
      { status: 500, headers: corsHeaders }
    );
  }
}

// Poll for auth result using the read key
export async function GET(request: NextRequest) {
  try {
    const readKey = request.nextUrl.searchParams.get('readKey');
    
    if (!readKey) {
      return NextResponse.json(
        { error: "Missing readKey" },
        { status: 400, headers: corsHeaders }
      );
    }

    // Find the token by readKey
    const verificationToken = await prisma.verificationToken.findFirst({
      where: {
        token: readKey,
        identifier: { startsWith: 'figma-plugin:' },
      },
    });

    if (!verificationToken) {
      return NextResponse.json(
        { error: "Invalid or expired key" },
        { status: 404, headers: corsHeaders }
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
      return NextResponse.json(
        { error: "Key expired" },
        { status: 410, headers: corsHeaders }
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
        readKey: readKey.slice(0, 8) + '...',
      });

      return NextResponse.json(result, { headers: corsHeaders });
    }

    // Not yet authenticated
    return NextResponse.json({ pending: true }, { headers: corsHeaders });
  } catch (error) {
    logger.error("Plugin auth poll failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Poll failed" },
      { status: 500, headers: corsHeaders }
    );
  }
}
