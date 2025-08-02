import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/apps/nextjs-app/lib/logger";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { level, message, data } = body;

    // Add request metadata
    const logData = {
      ...data,
      ip:
        request.headers.get("x-forwarded-for") ||
        request.headers.get("x-real-ip") ||
        "unknown",
      userAgent: request.headers.get("user-agent"),
      referer: request.headers.get("referer"),
    };

    // Log based on level
    switch (level) {
      case "error":
        logger.error(message, logData);
        break;
      case "warn":
        logger.warn(message, logData);
        break;
      case "debug":
        logger.debug(message, logData);
        break;
      case "info":
      default:
        logger.info(message, logData);
        break;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    // Don't log errors from the logging endpoint to avoid loops
    console.error("Logging API error:", error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
