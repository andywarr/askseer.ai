/**
 * Figma Plugin Session API
 *
 * Handles session validation for the Figma plugin.
 * Uses Bearer token authentication since plugins can't share browser cookies.
 *
 * GET - Check if token is valid, return user info
 * DELETE - Invalidate session (logout)
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/apps/nextjs-app/lib/db";
import { logger } from "@/apps/shared/logger";
import { getStudyUploadLimitForTeam } from "@/apps/nextjs-app/lib/study";

// CORS headers for Figma plugin (runs in sandbox with origin: null)
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Handle CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, { headers: corsHeaders });
}

// Helper to extract and validate session token from Authorization header
async function getSessionFromToken(request: NextRequest) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.slice(7); // Remove "Bearer " prefix

  // Find the session in the database
  const session = await prisma.session.findUnique({
    where: { sessionToken: token },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          selectedTeamId: true,
          selectedTeam: {
            select: {
              companyId: true,
            },
          },
        },
      },
    },
  });

  // Check if session exists and hasn't expired
  if (!session || session.expires < new Date()) {
    if (session) {
      // Clean up expired session
      await prisma.session
        .delete({ where: { sessionToken: token } })
        .catch(() => {});
    }
    return null;
  }

  return session;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromToken(request);

    if (!session?.user) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401, headers: corsHeaders },
      );
    }

    const user = session.user;

    // Get upload limit for user's team
    const maxFiles = getStudyUploadLimitForTeam(user.selectedTeam);

    logger.info("Plugin session validated", {
      userId: user.id,
      teamId: user.selectedTeamId,
    });

    return NextResponse.json(
      {
        email: user.email,
        name: user.name,
        maxFiles,
      },
      { headers: corsHeaders },
    );
  } catch (error) {
    logger.error("Plugin session check failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Session check failed" },
      { status: 500, headers: corsHeaders },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const authHeader = request.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      // Delete the session from the database
      await prisma.session
        .delete({
          where: { sessionToken: token },
        })
        .catch(() => {
          // Session may already be deleted or not exist
        });
    }

    return NextResponse.json({ success: true }, { headers: corsHeaders });
  } catch (error) {
    logger.error("Plugin session logout failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Logout failed" },
      { status: 500, headers: corsHeaders },
    );
  }
}
