import "server-only";

import { Prisma } from "@prisma/client";
import { Resend } from "resend";
import prisma from "@/apps/nextjs-app/lib/db";
import { logger } from "@/apps/shared/logger";
import {
  randomBytes,
  scryptSync,
  timingSafeEqual,
  createHash,
} from "crypto";

const OTP_CODE_LENGTH = 6;
const OTP_EXPIRATION_MINUTES = parseInt(
  process.env.AUTH_OTP_EXPIRATION_MINUTES || "10",
  10,
);
const OTP_SEND_LIMIT_PER_HOUR = parseInt(
  process.env.AUTH_OTP_MAX_SENDS_PER_HOUR || "10",
  10,
);
const OTP_ATTEMPT_LIMIT_PER_WINDOW = parseInt(
  process.env.AUTH_OTP_MAX_ATTEMPTS_PER_WINDOW || "5",
  10,
);
const OTP_ATTEMPT_WINDOW_MINUTES = parseInt(
  process.env.AUTH_OTP_ATTEMPT_WINDOW_MINUTES || "10",
  10,
);
const OTP_RESEND_COOLDOWN_SECONDS = parseInt(
  process.env.AUTH_OTP_RESEND_COOLDOWN_SECONDS || "45",
  10,
);
const OTP_MAX_ATTEMPTS_PER_CHALLENGE = parseInt(
  process.env.AUTH_OTP_MAX_ATTEMPTS || "5",
  10,
);

const SALT_LENGTH_BYTES = 16;


export class OtpError extends Error {
  constructor(message: string, readonly code: string = "OTP_ERROR") {
    super(message);
    this.name = "OtpError";
  }
}

export class OtpCooldownError extends OtpError {
  constructor(message: string, readonly retryAfterSeconds: number) {
    super(message, "OTP_COOLDOWN");
  }
}

export class OtpRateLimitError extends OtpError {
  constructor(message: string, readonly retryAfterSeconds?: number) {
    super(message, "OTP_RATE_LIMIT");
  }
}

export class OtpInvalidError extends OtpError {
  constructor(
    message: string,
    readonly reason: "INVALID" | "LOCKED" = "INVALID",
  ) {
    super(message, "OTP_INVALID");
  }
}

export class OtpSendError extends OtpError {
  constructor(message: string) {
    super(message, "OTP_SEND_ERROR");
  }
}

export interface CreateOtpChallengeOptions {
  email: string;
  ip?: string | null;
  userAgent?: string | null;
  origin?: string | null;
}

export interface CreateOtpChallengeResult {
  flowId: string;
  expiresAt: Date;
  resendAvailableAt: Date;
}

export interface VerifyOtpChallengeOptions {
  email: string;
  flowId: string;
  code: string;
  ip?: string | null;
  userAgent?: string | null;
}

export async function createOtpChallenge(
  options: CreateOtpChallengeOptions,
): Promise<CreateOtpChallengeResult> {
  const now = new Date();
  const normalizedEmail = normalizeEmail(options.email);
  const normalizedIp = normalizeIp(options.ip);

  await enforceSendRateLimit(normalizedEmail, normalizedIp, now);

  const latestChallenge = await prisma.otpChallenge.findFirst({
    where: { email: normalizedEmail },
    orderBy: { createdAt: "desc" },
  });

  if (latestChallenge) {
    const availableAt = new Date(
      latestChallenge.createdAt.getTime() +
        OTP_RESEND_COOLDOWN_SECONDS * 1000,
    );
    if (availableAt > now) {
      const secondsRemaining = Math.ceil(
        (availableAt.getTime() - now.getTime()) / 1000,
      );
      throw new OtpCooldownError(
        "Please wait before requesting another sign-in code.",
        secondsRemaining,
      );
    }
  }

  const flowId = generateFlowId();
  const code = generateOtpCode();
  const codeHash = hashOtpCode(code);
  const expiresAt = new Date(
    now.getTime() + OTP_EXPIRATION_MINUTES * 60 * 1000,
  );

  const challenge = await prisma.otpChallenge.create({
    data: {
      email: normalizedEmail,
      flowId,
      codeHash,
      expiresAt,
      maxAttempts: OTP_MAX_ATTEMPTS_PER_CHALLENGE,
      createdIp: normalizedIp,
      createdUserAgent: options.userAgent ?? null,
    },
  });

  try {
    await sendOtpEmail({
      email: normalizedEmail,
      code,
      flowId,
      origin: options.origin,
    });
  } catch (error) {
    logger.error("Failed to send OTP email", {
      email: normalizedEmail,
      flowId,
      error: error instanceof Error ? error.message : String(error),
    });
    // Roll back the challenge so it doesn't count toward rate limits.
    await prisma.otpChallenge.delete({ where: { id: challenge.id } }).catch(() => {
      /* ignore */
    });
    throw new OtpSendError("Unable to send sign-in code.");
  }

  logger.info("OTP challenge created", {
    email: maskEmail(normalizedEmail),
    flowId,
    expiresAt,
  });

  return {
    flowId,
    expiresAt,
    resendAvailableAt: new Date(
      now.getTime() + OTP_RESEND_COOLDOWN_SECONDS * 1000,
    ),
  };
}

export async function verifyOtpChallenge(
  options: VerifyOtpChallengeOptions,
): Promise<string> {
  const now = new Date();
  const normalizedEmail = normalizeEmail(options.email);
  const normalizedIp = normalizeIp(options.ip);

  await enforceAttemptRateLimit(normalizedEmail, now);

  const challenge = await prisma.otpChallenge.findUnique({
    where: {
      email_flowId: {
        email: normalizedEmail,
        flowId: options.flowId,
      },
    },
  });

  if (!challenge) {
    logger.warn("OTP challenge not found", {
      email: maskEmail(normalizedEmail),
      flowId: options.flowId,
    });
    throw new OtpInvalidError("Invalid sign-in code.");
  }

  if (challenge.consumedAt || challenge.expiresAt <= now) {
    await prisma.otpChallenge
      .update({
        where: { id: challenge.id },
        data: { attemptCount: challenge.maxAttempts },
      })
      .catch(() => {
        /* ignore */
      });
    logger.warn("Attempt to reuse expired or consumed OTP", {
      email: maskEmail(normalizedEmail),
      flowId: options.flowId,
      consumedAt: challenge.consumedAt,
      expiresAt: challenge.expiresAt,
    });
    throw new OtpInvalidError("Invalid sign-in code.");
  }

  if (challenge.attemptCount >= challenge.maxAttempts) {
    logger.warn("OTP challenge locked", {
      email: maskEmail(normalizedEmail),
      flowId: options.flowId,
    });
    throw new OtpInvalidError("Too many attempts.", "LOCKED");
  }

  const codeIsValid = verifyOtpCode(challenge.codeHash, options.code);

  if (!codeIsValid) {
    const nextAttemptCount = challenge.attemptCount + 1;
    await prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: {
        attemptCount: { increment: 1 },
        ...(nextAttemptCount >= challenge.maxAttempts
          ? { expiresAt: now }
          : {}),
      },
    });

    if (nextAttemptCount >= challenge.maxAttempts) {
      logger.warn("OTP challenge exhausted", {
        email: maskEmail(normalizedEmail),
        flowId: options.flowId,
      });
      throw new OtpInvalidError("Too many attempts.", "LOCKED");
    }

    logger.warn("Invalid OTP code provided", {
      email: maskEmail(normalizedEmail),
      flowId: options.flowId,
      attempts: nextAttemptCount,
    });
    throw new OtpInvalidError("Invalid sign-in code.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.otpChallenge.update({
      where: { id: challenge.id },
      data: {
        consumedAt: now,
        verifiedIp: normalizedIp,
        verifiedUserAgent: options.userAgent ?? null,
      },
    });

    await tx.otpChallenge.updateMany({
      where: {
        email: normalizedEmail,
        consumedAt: null,
        id: { not: challenge.id },
      },
      data: {
        consumedAt: now,
        expiresAt: now,
        attemptCount: OTP_MAX_ATTEMPTS_PER_CHALLENGE,
      },
    });
  });

  logger.info("OTP challenge verified", {
    email: maskEmail(normalizedEmail),
    flowId: options.flowId,
  });

  return normalizedEmail;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizeIp(ip?: string | null): string | null {
  if (!ip) return null;
  const first = ip.split(",")[0]?.trim();
  return first || null;
}

function generateOtpCode(): string {
  const random = randomBytes(OTP_CODE_LENGTH);
  const numeric =
    parseInt(random.toString("hex"), 16) % Math.pow(10, OTP_CODE_LENGTH);
  return numeric.toString().padStart(OTP_CODE_LENGTH, "0");
}

function generateFlowId(): string {
  const entropy = randomBytes(16);
  return createHash("sha256").update(entropy).digest("base64url").slice(0, 16);
}

function hashOtpCode(code: string): string {
  const salt = randomBytes(SALT_LENGTH_BYTES);
  const derivedKey = scryptSync(code, salt, 32);
  return `${salt.toString("hex")}:${derivedKey.toString("hex")}`;
}

function verifyOtpCode(storedHash: string, code: string): boolean {
  const [saltHex, hashHex] = storedHash.split(":");
  if (!saltHex || !hashHex) return false;
  const salt = Buffer.from(saltHex, "hex");
  const stored = Buffer.from(hashHex, "hex");
  const derived = scryptSync(code, salt, stored.length);
  return timingSafeEqual(stored, derived);
}

async function enforceSendRateLimit(
  email: string,
  ip: string | null,
  now: Date,
) {
  const windowStart = new Date(now.getTime() - 60 * 60 * 1000);
  const [emailCount, ipCount] = await Promise.all([
    prisma.otpChallenge.count({
      where: { email, createdAt: { gte: windowStart } },
    }),
    ip
      ? prisma.otpChallenge.count({
          where: { createdIp: ip, createdAt: { gte: windowStart } },
        })
      : Promise.resolve(0),
  ]);

  if (
    emailCount >= OTP_SEND_LIMIT_PER_HOUR ||
    (ip && ipCount >= OTP_SEND_LIMIT_PER_HOUR)
  ) {
    const retryAfterByEmail =
      emailCount >= OTP_SEND_LIMIT_PER_HOUR
        ? await computeRetryAfterSeconds(
            { email, createdAt: { gte: windowStart } },
            windowStart,
            now,
          )
        : undefined;
    const retryAfterByIp =
      ip && ipCount >= OTP_SEND_LIMIT_PER_HOUR
        ? await computeRetryAfterSeconds(
            { createdIp: ip, createdAt: { gte: windowStart } },
            windowStart,
            now,
          )
        : undefined;
    const retryAfterSeconds = Math.max(
      retryAfterByEmail ?? 0,
      retryAfterByIp ?? 0,
    );
    logger.warn("OTP send rate limit triggered", {
      email: maskEmail(email),
      ip,
    });
    throw new OtpRateLimitError(
      "Too many sign-in requests. Please try again later.",
      retryAfterSeconds || undefined,
    );
  }
}

async function enforceAttemptRateLimit(email: string, now: Date) {
  const windowStart = new Date(
    now.getTime() - OTP_ATTEMPT_WINDOW_MINUTES * 60 * 1000,
  );

  const aggregate = await prisma.otpChallenge.aggregate({
    where: { email, createdAt: { gte: windowStart } },
    _sum: { attemptCount: true },
  });

  const attempts = aggregate._sum.attemptCount ?? 0;

  if (attempts >= OTP_ATTEMPT_LIMIT_PER_WINDOW) {
    const retryAfterSeconds = await computeRetryAfterSeconds(
      { email, createdAt: { gte: windowStart } },
      windowStart,
      now,
    );
    logger.warn("OTP attempt rate limit triggered", {
      email: maskEmail(email),
      attempts,
    });
    throw new OtpRateLimitError(
      "Too many invalid attempts. Please wait before trying again.",
      retryAfterSeconds,
    );
  }
}

async function computeRetryAfterSeconds(
  where: Prisma.OtpChallengeWhereInput,
  windowStart: Date,
  now: Date,
): Promise<number | undefined> {
  const oldest = await prisma.otpChallenge.findFirst({
    where,
    orderBy: { createdAt: "asc" },
    select: { createdAt: true },
  });

  if (!oldest) return undefined;

  const windowMs = now.getTime() - windowStart.getTime();
  const limitWindowMs = Math.max(windowMs, 1_000);
  const retryAt = oldest.createdAt.getTime() + limitWindowMs;
  return retryAt > now.getTime()
    ? Math.ceil((retryAt - now.getTime()) / 1000)
    : 0;
}

interface SendOtpEmailOptions {
  email: string;
  code: string;
  flowId: string;
  origin?: string | null;
}

async function sendOtpEmail(options: SendOtpEmailOptions) {
  const from = process.env.AUTH_RESEND_FROM || "onboarding@resend.dev";
  const baseUrl = resolveAppBaseUrl(options.origin);
  const loginUrl = new URL("/", baseUrl);
  loginUrl.searchParams.set("email", options.email);
  loginUrl.searchParams.set("flow", options.flowId);

  const subject = "Your Seer verification code";
  const html = renderOtpHtml({
    email: options.email,
    code: options.code,
    loginUrl: loginUrl.toString(),
  });
  const text = renderOtpText({
    code: options.code,
    loginUrl: loginUrl.toString(),
  });

  const apiKey = process.env.AUTH_RESEND_KEY;
  if (!apiKey) {
    throw new Error("AUTH_RESEND_KEY is not configured");
  }

  const resend = new Resend(apiKey);

  await resend.emails.send({
    from,
    to: options.email,
    subject,
    html,
    text,
  });
}

function resolveAppBaseUrl(origin?: string | null) {
  const configured = process.env.AUTH_OTP_APP_URL || process.env.NEXTAUTH_URL;
  const base = configured || origin;
  if (!base) {
    throw new Error("Application base URL is not configured");
  }
  return base;
}

interface OtpEmailTemplateInput {
  email: string;
  code: string;
  loginUrl: string;
}

function renderOtpHtml(input: OtpEmailTemplateInput) {
  return `<!DOCTYPE html>
<html>
  <body style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background-color: #f8fafc; padding: 24px; color: #0f172a;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);">
      <tr>
        <td style="padding: 32px; text-align: center;">
          <h1 style="margin: 0 0 16px 0; font-size: 24px;">Your verification code</h1>
          <p style="margin: 0 0 24px 0; font-size: 16px; color: #475569;">Use the 6-digit code below to sign in to Seer. This code expires in ${OTP_EXPIRATION_MINUTES} minutes.</p>
          <div style="display: inline-block; padding: 16px 24px; font-size: 28px; letter-spacing: 12px; font-weight: 600; background-color: #f1f5f9; border-radius: 12px; color: #0f172a;">
            ${input.code}
          </div>
          <p style="margin: 24px 0 24px 0; font-size: 14px; color: #475569;">You can enter this code on the device where you requested it, or click the button below to continue on this device.</p>
          <a href="${input.loginUrl}" style="display: inline-block; padding: 12px 28px; font-size: 16px; font-weight: 600; color: #ffffff; background-color: #2563eb; border-radius: 999px; text-decoration: none;">Open Seer</a>
          <p style="margin: 32px 0 0 0; font-size: 12px; color: #64748b;">If you didn’t request this code, you can safely ignore this email.</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function renderOtpText(input: { code: string; loginUrl: string }) {
  return `Your Seer verification code is ${input.code}.\n\nEnter this code within ${OTP_EXPIRATION_MINUTES} minutes or open Seer: ${input.loginUrl}`;
}

function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  const maskedLocal =
    local.length <= 2
      ? `${local[0] ?? "*"}***`
      : `${local.slice(0, 2)}***`;
  return `${maskedLocal}@${domain}`;
}
