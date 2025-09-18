import { NextRequest } from "next/server";
import { z } from "zod";
import {
  generateOtpCode,
  sendOtpEmail,
  storeOtp,
} from "@/apps/nextjs-app/lib/otp";
import { logger } from "@/apps/shared/logger";
import prisma from "@/apps/nextjs-app/lib/db";

const bodySchema = z.object({ email: z.string().email() });

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return Response.json({ error: "Invalid email" }, { status: 400 });
    }
    const email = parsed.data.email.toLowerCase();

    // Rate limit: max 3 OTP requests per 30 minutes per email
    const windowMinutes = 30;
    const maxRequests = 3;
    const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000);

    const recent = await prisma.otpCode.findMany({
      where: { email, createdAt: { gt: windowStart } },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
      take: maxRequests,
    });

    if (recent.length >= maxRequests) {
      const oldestOfWindow = recent[recent.length - 1]?.createdAt;
      const retryAfterMs = oldestOfWindow
        ? oldestOfWindow.getTime() + windowMinutes * 60 * 1000 - Date.now()
        : windowMinutes * 60 * 1000;
      const retryAfterSec = Math.max(30, Math.ceil(retryAfterMs / 1000));

      logger.warn("OTP rate limit exceeded", {
        emailDomain: email.split("@")[1],
        recentCount: recent.length,
        retryAfterSec,
      });
      return new Response(
        JSON.stringify({ error: "Too many requests", retryAfterSec }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": String(retryAfterSec),
          },
        },
      );
    }

    const code = generateOtpCode();
    await storeOtp(email, code);
    await sendOtpEmail(email, code);

    logger.info("OTP code generated and email queued", {
      emailDomain: email.split("@")[1],
    });
    return Response.json({ ok: true });
  } catch (error) {
    logger.error("OTP start failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return Response.json({ error: "Failed to send code" }, { status: 500 });
  }
}
