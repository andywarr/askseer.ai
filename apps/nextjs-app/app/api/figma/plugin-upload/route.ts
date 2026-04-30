/**
 * Figma Plugin Upload API
 *
 * Handles frame uploads from the Figma plugin.
 * Stores frames temporarily with session ID for form pre-loading.
 * Uses Bearer token authentication since plugins can't share browser cookies.
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/apps/nextjs-app/lib/db/db";
import { logger } from "@/apps/shared/logger";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";
import {
  pluginUploadLimiter,
  getClientIp,
} from "@/apps/nextjs-app/lib/utils/rate-limit";

const s3Client = new S3Client({ region: process.env.AWS_REGION });
const BUCKET_NAME = process.env.AWS_BUCKET_NAME!;

// CORS headers for Figma plugin (runs in sandbox with origin: null)
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

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
        },
      },
    },
  });

  // Check if session exists and hasn't expired
  if (!session || session.expires < new Date()) {
    return null;
  }

  return session;
}

interface FrameData {
  nodeId: string;
  name: string;
  width: number;
  height: number;
  data: string; // Base64 encoded
}

interface UploadRequest {
  fileName: string;
  studyType: "evaluation" | "walkthrough";
  frames: FrameData[];
  name?: string;
  goal?: string;
}

export async function POST(request: NextRequest) {
  const clientIp = getClientIp(request);

  // Check rate limit
  const { allowed, resetAt } = pluginUploadLimiter.check(clientIp);
  if (!allowed) {
    logger.warn("Plugin upload rate limit exceeded", { ip: clientIp });
    return NextResponse.json(
      { error: "Too many uploads. Please try again later." },
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
    const session = await getSessionFromToken(request);

    if (!session?.user) {
      logger.warn("Plugin upload auth failed", { ip: clientIp });
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401, headers: corsHeaders },
      );
    }

    const user = session.user;

    const body: UploadRequest = await request.json();
    const { fileName, studyType, frames, name, goal } = body;

    if (!frames || frames.length === 0) {
      return NextResponse.json(
        { error: "No frames provided" },
        { status: 400, headers: corsHeaders },
      );
    }

    // Generate unique session ID for this upload
    const pluginSessionId = uuidv4();
    const sessionPrefix = `plugin-temp/${user.id}/${pluginSessionId}`;

    // Upload each frame to S3
    const uploadedFrames: Array<{
      key: string;
      nodeId: string;
      name: string;
      width: number;
      height: number;
    }> = [];

    for (const frame of frames) {
      if (!frame.data) continue;

      const key = `${sessionPrefix}/${sanitizeFileName(frame.name)}.png`;

      // Convert base64 to buffer
      const buffer = Buffer.from(frame.data, "base64");

      await s3Client.send(
        new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: key,
          Body: buffer,
          ContentType: "image/png",
          Metadata: {
            "figma-node-id": frame.nodeId,
            "figma-frame-name": frame.name,
          },
        }),
      );

      uploadedFrames.push({
        key,
        nodeId: frame.nodeId,
        name: frame.name,
        width: frame.width,
        height: frame.height,
      });
    }

    // Store session metadata in database for form to retrieve
    await prisma
      .$executeRawUnsafe(
        `INSERT INTO "PluginUploadSession" (id, "userId", "teamId", "fileName", "studyType", "frames", "createdAt", "expiresAt")
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW() + INTERVAL '1 hour')
       ON CONFLICT (id) DO UPDATE SET
         "frames" = $6,
         "expiresAt" = NOW() + INTERVAL '1 hour'`,
        pluginSessionId,
        user.id,
        user.selectedTeamId,
        fileName,
        studyType,
        JSON.stringify(uploadedFrames),
      )
      .catch(async () => {
        // If PluginUploadSession table doesn't exist, create a JSON file in S3 as fallback
        const metadataKey = `${sessionPrefix}/metadata.json`;
        await s3Client.send(
          new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: metadataKey,
            Body: JSON.stringify({
              userId: user.id,
              teamId: user.selectedTeamId,
              fileName,
              studyType,
              name: name || undefined,
              goal: goal || undefined,
              frames: uploadedFrames,
              createdAt: new Date().toISOString(),
            }),
            ContentType: "application/json",
          }),
        );
      });

    logger.info("Plugin frames uploaded", {
      userId: user.id,
      sessionId: pluginSessionId,
      frameCount: uploadedFrames.length,
      studyType,
    });

    return NextResponse.json(
      {
        sessionId: pluginSessionId,
        frameCount: uploadedFrames.length,
      },
      { headers: corsHeaders },
    );
  } catch (error) {
    logger.error("Plugin upload failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Upload failed" },
      { status: 500, headers: corsHeaders },
    );
  }
}

// Handle CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}

function sanitizeFileName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9\-_]/g, "-")
    .replace(/-+/g, "-")
    .substring(0, 100);
}
