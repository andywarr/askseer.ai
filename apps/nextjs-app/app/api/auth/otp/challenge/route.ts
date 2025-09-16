import { NextResponse } from "next/server";
import { z } from "zod";

import {
  CreateOtpChallengeOptions,
  OtpConfigurationError,
  OtpCooldownError,
  OtpRateLimitError,
  OtpSendError,
  createOtpChallenge,
} from "@/apps/nextjs-app/lib/otp";
import { logger } from "@/apps/shared/logger";

const requestSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch (error) {
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 },
    );
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Invalid email" },
      { status: 400 },
    );
  }

  const headers = request.headers;
  const ip = extractClientIp(headers.get("x-forwarded-for") || headers.get("x-real-ip"));
  const userAgent = headers.get("user-agent");
  const origin = headers.get("origin") ?? new URL(request.url).origin;

  const options: CreateOtpChallengeOptions = {
    email: parsed.data.email,
    ip,
    userAgent,
    origin,
  };

  try {
    const result = await createOtpChallenge(options);
    return NextResponse.json({
      flowId: result.flowId,
      expiresAt: result.expiresAt.toISOString(),
      resendAvailableAt: result.resendAvailableAt.toISOString(),
    });
  } catch (error) {
    if (error instanceof OtpCooldownError) {
      return NextResponse.json(
        {
          error: "Please wait before requesting another code.",
          retryAfter: error.retryAfterSeconds,
        },
        { status: 429 },
      );
    }

    if (error instanceof OtpRateLimitError) {
      return NextResponse.json(
        {
          error: "Too many sign-in requests. Try again later.",
          retryAfter: error.retryAfterSeconds,
        },
        { status: 429 },
      );
    }

    if (error instanceof OtpSendError) {
      return NextResponse.json(
        { error: "We couldn\u2019t send your code. Please try again." },
        { status: 500 },
      );
    }

    if (error instanceof OtpConfigurationError) {
      return NextResponse.json(
        { error: "We can\u2019t send codes right now. Please try again later." },
        { status: 503 },
      );
    }

    logger.error("Unexpected OTP challenge failure", {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
}

function extractClientIp(raw: string | null) {
  if (!raw) return null;
  return raw.split(",")[0]?.trim() || null;
}
