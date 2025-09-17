import { createHash, randomInt } from "crypto";
import { z } from "zod";

import prisma from "@/apps/nextjs-app/lib/db";

export const OTP_CODE_LENGTH = 6;
export const OTP_EXPIRY_MINUTES = 10;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_VERIFY_WINDOW_MINUTES = 10;
export const OTP_VERIFY_WINDOW_ATTEMPTS = 10;

const emailSchema = z.string().email();
const otpSchema = z
  .string()
  .regex(/^[0-9]{6}$/)
  .length(OTP_CODE_LENGTH, "OTP must be exactly 6 digits");

export class OtpRequestError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = "OtpRequestError";
    this.code = code;
    this.status = status;
  }
}

export function validateEmail(email: unknown): string {
  return emailSchema.parse(email);
}

export function validateOtp(otp: unknown): string {
  return otpSchema.parse(otp);
}

export function generateOtpCode(): string {
  return `${randomInt(0, 10 ** OTP_CODE_LENGTH)}`.padStart(
    OTP_CODE_LENGTH,
    "0",
  );
}

export function hashOtpCode(email: string, code: string): string {
  const secret =
    process.env.AUTH_OTP_SECRET ?? process.env.AUTH_SECRET ?? "default-secret";
  return createHash("sha256")
    .update(`${email.toLowerCase()}:${code}:${secret}`)
    .digest("hex");
}

export function extractClientIp(request?: Request | null): string | null {
  if (!request) return null;
  const headerKeys = [
    "x-forwarded-for",
    "x-real-ip",
    "cf-connecting-ip",
    "true-client-ip",
  ];

  for (const key of headerKeys) {
    const value = request.headers.get(key);
    if (!value) continue;
    const first = value.split(",")[0]?.trim();
    if (first) return first;
  }

  return null;
}

export async function ensureOtpRequestRateLimits(
  email: string,
  ipAddress?: string | null,
) {
  const now = Date.now();

  const thirtySecondsAgo = new Date(now - 30 * 1000);
  const tenMinutesAgo = new Date(now - 10 * 60 * 1000);
  const twentyFourHoursAgo = new Date(now - 24 * 60 * 60 * 1000);

  const recentEmailRequest = await prisma.emailOtp.findFirst({
    where: {
      email,
      createdAt: { gt: thirtySecondsAgo },
    },
  });

  if (recentEmailRequest) {
    throw new OtpRequestError(
      "email_rate_limit_short",
      "Please wait 30 seconds before requesting another code.",
      429,
    );
  }

  if (ipAddress) {
    const recentIpRequest = await prisma.emailOtp.findFirst({
      where: {
        requestIp: ipAddress,
        createdAt: { gt: thirtySecondsAgo },
      },
    });

    if (recentIpRequest) {
      throw new OtpRequestError(
        "ip_rate_limit_short",
        "Please wait 30 seconds before requesting another code.",
        429,
      );
    }
  }

  const [
    emailTenMinuteCount,
    emailDailyCount,
    ipTenMinuteCount,
    ipDailyCount,
  ] = await Promise.all([
    prisma.emailOtp.count({
      where: { email, createdAt: { gt: tenMinutesAgo } },
    }),
    prisma.emailOtp.count({
      where: { email, createdAt: { gt: twentyFourHoursAgo } },
    }),
    ipAddress
      ? prisma.emailOtp.count({
          where: { requestIp: ipAddress, createdAt: { gt: tenMinutesAgo } },
        })
      : Promise.resolve(0),
    ipAddress
      ? prisma.emailOtp.count({
          where: { requestIp: ipAddress, createdAt: { gt: twentyFourHoursAgo } },
        })
      : Promise.resolve(0),
  ]);

  if (emailTenMinuteCount >= 3) {
    throw new OtpRequestError(
      "email_rate_limit_medium",
      "You have requested too many codes. Please try again in 10 minutes.",
      429,
    );
  }

  if (emailDailyCount >= 10) {
    throw new OtpRequestError(
      "email_rate_limit_long",
      "Daily code request limit reached. Please try again tomorrow.",
      429,
    );
  }

  if (ipAddress && ipTenMinuteCount >= 3) {
    throw new OtpRequestError(
      "ip_rate_limit_medium",
      "Too many codes requested from this IP. Please wait 10 minutes.",
      429,
    );
  }

  if (ipAddress && ipDailyCount >= 10) {
    throw new OtpRequestError(
      "ip_rate_limit_long",
      "Daily code request limit reached for this IP. Please try again tomorrow.",
      429,
    );
  }
}

export async function createEmailOtp(
  email: string,
  ipAddress?: string | null,
) {
  const normalizedEmail = email.toLowerCase();
  await ensureOtpRequestRateLimits(normalizedEmail, ipAddress);

  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + OTP_EXPIRY_MINUTES * 60 * 1000,
  );
  const code = generateOtpCode();
  const codeHash = hashOtpCode(normalizedEmail, code);

  await prisma.$transaction(async (tx) => {
    await tx.emailOtp.updateMany({
      where: {
        email: normalizedEmail,
        consumedAt: null,
        invalidatedAt: null,
      },
      data: {
        invalidatedAt: now,
        expiresAt: now,
      },
    });

    await tx.emailOtp.create({
      data: {
        email: normalizedEmail,
        codeHash,
        expiresAt,
        requestIp: ipAddress,
      },
    });
  });

  return { code, expiresAt };
}

export async function ensureOtpVerifyRateLimit(ipAddress?: string | null) {
  if (!ipAddress) return;

  const windowStart = new Date(
    Date.now() - OTP_VERIFY_WINDOW_MINUTES * 60 * 1000,
  );

  const attemptCount = await prisma.otpVerificationAttempt.count({
    where: {
      ipAddress,
      createdAt: { gt: windowStart },
    },
  });

  if (attemptCount >= OTP_VERIFY_WINDOW_ATTEMPTS) {
    throw new OtpRequestError(
      "verify_rate_limited",
      "Too many verification attempts. Please wait 10 minutes and try again.",
      429,
    );
  }
}

export async function recordOtpVerificationAttempt(
  email: string,
  ipAddress?: string | null,
) {
  await prisma.otpVerificationAttempt.create({
    data: {
      email: email.toLowerCase(),
      ipAddress: ipAddress ?? null,
    },
  });
}
