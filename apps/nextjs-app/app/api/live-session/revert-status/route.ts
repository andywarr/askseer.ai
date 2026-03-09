import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/apps/nextjs-app/lib/db/dal";
import { updateLiveSessionStatusDb } from "@/apps/nextjs-app/lib/db/data";
import { logger } from "@/apps/shared/logger";

/**
 * Best-effort API to revert a LIVE session back to SCHEDULED.
 * Called via `navigator.sendBeacon` or `fetch({ keepalive: true })` from
 * the interviewer view's `beforeunload` handler when the tab is closed
 * without clicking Exit and recording was never started.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await isAuthenticated();
    if (!auth?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { sessionId } = await req.json();
    if (!sessionId || typeof sessionId !== "string") {
      return NextResponse.json(
        { error: "Missing sessionId" },
        { status: 400 },
      );
    }

    // Only revert if the session is currently LIVE — this avoids
    // accidentally reverting an ENDED / PROCESSING session.
    await updateLiveSessionStatusDb(sessionId, "SCHEDULED", null);
    logger.info("Reverted LIVE session to SCHEDULED on interviewer exit", {
      sessionId,
      userId: auth.userId,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    logger.error("Failed to revert session status", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
