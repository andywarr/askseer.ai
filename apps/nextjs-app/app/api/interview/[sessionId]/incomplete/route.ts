import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/apps/shared/logger";

/**
 * POST /api/interview/[sessionId]/incomplete
 *
 * Called via navigator.sendBeacon when a participant closes the tab or
 * navigates away during an active interview session. Marks the session
 * as INCOMPLETE so researchers know the participant left early.
 *
 * No user auth is required — the session ID (a CUID) acts as the
 * unguessable token. This mirrors the existing unauthenticated
 * participant flow for updateInterviewSessionStatus.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;

  if (!sessionId) {
    return NextResponse.json(
      { success: false, message: "Missing sessionId" },
      { status: 400 },
    );
  }

  try {
    const res = await fetch(
      `${process.env.DB_WORKER_URL}/api/study/interview/session/status`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          status: "INCOMPLETE",
          completedAt: new Date().toISOString(),
        }),
      },
    );

    if (!res.ok) {
      logger.warn("Failed to mark interview session as incomplete", {
        sessionId,
      });
      return NextResponse.json({ success: false }, { status: 500 });
    }

    logger.info("Interview session marked incomplete via beacon", {
      sessionId,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("Error marking interview session incomplete", {
      sessionId,
      error,
    });
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
