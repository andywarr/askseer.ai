import { NextRequest } from "next/server";
import { z } from "zod";
import {
  generateOtpCode,
  sendOtpEmail,
  storeOtp,
} from "@/apps/nextjs-app/lib/otp";
import { logger } from "@/apps/shared/logger";

const bodySchema = z.object({ email: z.string().email() });

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return Response.json({ error: "Invalid email" }, { status: 400 });
    }
    const email = parsed.data.email.toLowerCase();

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
