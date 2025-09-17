import Google from "next-auth/providers/google";
import NextAuth, { CredentialsSignin } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import prisma from "@/apps/nextjs-app/lib/db";
import Resend from "next-auth/providers/resend";
import Credentials from "next-auth/providers/credentials";
import { logger } from "@/apps/shared/logger";
import {
  OTP_EXPIRY_MINUTES,
  OTP_MAX_ATTEMPTS,
  OtpRequestError,
  createEmailOtp,
  ensureOtpVerifyRateLimit,
  extractClientIp,
  hashOtpCode,
  recordOtpVerificationAttempt,
  validateEmail,
  validateOtp,
} from "@/apps/nextjs-app/lib/email-otp";
import { bootstrapNewUser } from "@/apps/nextjs-app/lib/user-onboarding";

interface Theme {
  brandColor?: string;
  buttonText?: string;
}

// Tracks when verification tokens (by raw token string) were issued.
// Used heuristically to ignore extremely early (likely scanner) accesses.
export const verificationTokenIssuedAt = new Map<string, number>();

class OtpSignInError extends CredentialsSignin {
  constructor(public code: string, message?: string) {
    super(message);
    this.code = code;
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
        },
      },
    }),
    Resend({
      apiKey: process.env.AUTH_RESEND_KEY!,
      from: process.env.AUTH_RESEND_FROM || "onboarding@resend.dev",
      async sendVerificationRequest(params) {
        const { identifier, provider, url, theme, request } = params;
        const { host } = new URL(url);

        let normalizedEmail: string;
        try {
          normalizedEmail = validateEmail(identifier).toLowerCase();
        } catch {
          logger.warn("Rejected OTP email request due to invalid address", {
            identifier,
            host,
          });
          throw new Error("Please enter a valid email address.");
        }

        const ipAddress = extractClientIp(request);
        const emailDomain = normalizedEmail.split("@")[1] || "unknown";

        let code: string;
        let expiresAt: Date;

        try {
          const result = await createEmailOtp(normalizedEmail, ipAddress);
          code = result.code;
          expiresAt = result.expiresAt;
        } catch (error) {
          if (error instanceof OtpRequestError) {
            logger.warn("Email OTP request blocked", {
              emailDomain,
              ipAddress,
              reason: error.code,
            });
            throw new Error(error.message);
          }

          logger.error("Failed to create email OTP", {
            emailDomain,
            ipAddress,
            error: error instanceof Error ? error.message : String(error),
          });
          throw error;
        }

        let res: Response;
        try {
          res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${provider.apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: provider.from,
              to: normalizedEmail,
              subject: `Your ${host} verification code`,
              html: html({
                host,
                theme,
                code,
                expiresInMinutes: OTP_EXPIRY_MINUTES,
              }),
              text: text({
                host,
                code,
                expiresInMinutes: OTP_EXPIRY_MINUTES,
              }),
            }),
          });
        } catch (error) {
          logger.error("Resend OTP request failed", {
            emailDomain,
            host,
            ipAddress,
            error: error instanceof Error ? error.message : String(error),
          });
          throw error;
        }

        if (!res.ok) {
          const errorBody = await res.json().catch(() => null);
          logger.error("Resend OTP email failed", {
            emailDomain,
            host,
            ipAddress,
            status: res.status,
            error: errorBody,
          });
          throw new Error("Resend error: " + JSON.stringify(errorBody));
        }

        logger.info("Email OTP sent", {
          emailDomain,
          host,
          ipAddress,
          expiresAt: expiresAt.toISOString(),
        });

        try {
          const parsed = new URL(url);
          const tokenValue = parsed.searchParams.get("token");
          if (tokenValue) {
            verificationTokenIssuedAt.set(tokenValue, Date.now());
            setTimeout(
              () => verificationTokenIssuedAt.delete(tokenValue),
              1000 * 60 * 60,
            ).unref?.();
          }
        } catch (e) {
          // Heuristic only.
        }
      },
    }),
    Credentials({
      id: "otp",
      name: "Email OTP",
      credentials: {
        email: { label: "Email", type: "email" },
        otp: { label: "One-time code", type: "text" },
      },
      async authorize(credentials, request) {
        const ipAddress = extractClientIp(request);
        let normalizedEmail: string | null = null;
        let emailDomain = "unknown";

        try {
          try {
            normalizedEmail = validateEmail(credentials?.email).toLowerCase();
            emailDomain = normalizedEmail.split("@")[1] || "unknown";
          } catch {
            throw new OtpSignInError(
              "invalid_email",
              "Please enter a valid email address.",
            );
          }

          let otpCode: string;
          try {
            otpCode = validateOtp(credentials?.otp);
          } catch {
            throw new OtpSignInError(
              "invalid_otp_format",
              "Enter the six digit code we emailed you.",
            );
          }

          if (!normalizedEmail) {
            throw new OtpSignInError(
              "invalid_email",
              "Please enter a valid email address.",
            );
          }

          await ensureOtpVerifyRateLimit(ipAddress);
          await recordOtpVerificationAttempt(normalizedEmail, ipAddress);

          const now = new Date();

          const activeOtp = await prisma.emailOtp.findFirst({
            where: {
              email: normalizedEmail,
              consumedAt: null,
              invalidatedAt: null,
            },
            orderBy: { createdAt: "desc" },
          });

          if (!activeOtp) {
            throw new OtpSignInError(
              "otp_not_found",
              "We couldn't find an active code. Request a new one.",
            );
          }

          if (activeOtp.attemptCount >= OTP_MAX_ATTEMPTS) {
            await prisma.emailOtp.update({
              where: { id: activeOtp.id },
              data: {
                invalidatedAt: activeOtp.invalidatedAt ?? now,
                expiresAt: now,
                lastAttemptAt: now,
              },
            });
            throw new OtpSignInError(
              "otp_locked",
              "This code has been locked. Request a new one.",
            );
          }

          if (activeOtp.expiresAt <= now) {
            await prisma.emailOtp.update({
              where: { id: activeOtp.id },
              data: {
                invalidatedAt: activeOtp.invalidatedAt ?? now,
                expiresAt: now,
                lastAttemptAt: now,
              },
            });
            throw new OtpSignInError(
              "otp_expired",
              "This code has expired. Request a new one.",
            );
          }

          const hashedInput = hashOtpCode(normalizedEmail, otpCode);

          if (hashedInput !== activeOtp.codeHash) {
            const newAttemptCount = activeOtp.attemptCount + 1;
            await prisma.emailOtp.update({
              where: { id: activeOtp.id },
              data: {
                attemptCount: { increment: 1 },
                lastAttemptAt: now,
                ...(newAttemptCount >= OTP_MAX_ATTEMPTS
                  ? { invalidatedAt: now, expiresAt: now }
                  : {}),
              },
            });

            throw new OtpSignInError(
              newAttemptCount >= OTP_MAX_ATTEMPTS
                ? "otp_locked"
                : "otp_invalid",
              newAttemptCount >= OTP_MAX_ATTEMPTS
                ? "Too many incorrect attempts. Request a new code."
                : "Incorrect code. Please try again.",
            );
          }

          await prisma.emailOtp.update({
            where: { id: activeOtp.id },
            data: {
              attemptCount: { increment: 1 },
              consumedAt: now,
              expiresAt: now,
              lastAttemptAt: now,
            },
          });

          let user = await prisma.user.findUnique({
            where: { email: normalizedEmail },
          });
          let isNewUser = false;

          if (!user) {
            user = await prisma.user.create({
              data: {
                email: normalizedEmail,
                emailVerified: now,
              },
            });
            await bootstrapNewUser(prisma, user);
            isNewUser = true;
          } else if (!user.emailVerified) {
            user = await prisma.user.update({
              where: { id: user.id },
              data: { emailVerified: now },
            });
          }

          logger.info("Email OTP sign-in successful", {
            userId: user.id,
            emailDomain,
            ipAddress,
            isNewUser,
          });

          return user;
        } catch (error) {
          if (error instanceof OtpSignInError) {
            logger.warn("Email OTP sign-in failed", {
              code: error.code,
              emailDomain,
              ipAddress,
            });
            throw error;
          }

          if (error instanceof OtpRequestError) {
            logger.warn("Email OTP verification rate limited", {
              emailDomain,
              ipAddress,
              reason: error.code,
            });
            throw new OtpSignInError(
              error.code,
              "Too many attempts. Please wait before trying again.",
            );
          }

          logger.error("Email OTP sign-in error", {
            emailDomain,
            ipAddress,
            error: error instanceof Error ? error.message : String(error),
          });

          throw new OtpSignInError(
            "otp_unknown_error",
            "We couldn't verify the code. Please try again.",
          );
        }
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      try {
        // Determine if this is the very first sign-in for the user.
        // The previous logic used !user.id which is always false because id is always present.
        let isNewUser = false;
        try {
          // If the user has no existing sessions yet, we treat this as the first sign-in.
          const priorSessions = await prisma.session.count({
            where: { userId: user.id },
          });
          isNewUser = priorSessions === 0;
        } catch (error) {
          logger.warn("Failed to determine isNewUser", {
            userId: user.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }

        // Log successful sign-in with corrected isNewUser flag
        logger.info("User sign-in successful", {
          provider: account?.provider || "unknown",
          isNewUser,
          userId: user.id,
          emailDomain: user.email?.split("@")[1] || "unknown",
        });

        // Handle account linking for OAuth providers
        if (account?.provider === "google" && user?.email) {
          try {
            // Check if user already exists with this email
            const existingUser = await prisma.user.findUnique({
              where: { email: user.email },
              include: { accounts: true },
            });

            if (existingUser) {
              // Check if Google account is already linked
              const googleAccountExists = existingUser.accounts.some(
                (acc) => acc.provider === "google",
              );

              if (!googleAccountExists) {
                // Link the Google account to the existing user
                await prisma.account.create({
                  data: {
                    userId: existingUser.id,
                    type: account.type,
                    provider: account.provider,
                    providerAccountId: account.providerAccountId,
                    access_token: account.access_token,
                    refresh_token: account.refresh_token,
                    expires_at: account.expires_at,
                    token_type: account.token_type,
                    scope: account.scope,
                    id_token: account.id_token,
                  },
                });

                logger.info("Google account linked to existing user", {
                  provider: "google",
                  emailDomain: user.email?.split("@")[1] || "unknown",
                });
              }
            }
          } catch (error) {
            logger.error("Failed to link Google account", {
              provider: "google",
              emailDomain: user.email?.split("@")[1] || "unknown",
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }

        return true;
      } catch (error) {
        logger.error("User sign-in failed", {
          provider: account?.provider || "unknown",
          userId: user.id,
          error: error instanceof Error ? error.message : String(error),
        });
        return false;
      }
    },
    async session({ session, user }) {
      return session;
    },
  },
  events: {
    async createUser({ user }) {
      try {
        await bootstrapNewUser(prisma, user);
        logger.info("User created", {
          userId: user.id,
          emailDomain: user.email?.split("@")[1] || "unknown",
        });
      } catch (error) {
        logger.error("Failed to create user", {
          userId: user.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
  },
});

function html(params: {
  host: string;
  theme: Theme;
  code: string;
  expiresInMinutes: number;
}) {
  const { host, theme, code, expiresInMinutes } = params;

  const escapedHost = host.replace(/\./g, "&#8203;.");
  const brandColor = theme.brandColor || "#18181b";
  const color = {
    background: "#f8fafc",
    text: "#111827",
    cardBackground: "#ffffff",
    border: "#e2e8f0",
    accent: "#f1f5f9",
    muted: "#64748b",
  };
  const spacedCode = code.split("").join(" ");

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Your ${escapedHost} verification code</title>
</head>
<body style="margin:0;padding:0;background-color:${color.background};font-family:'Roboto',system-ui,-apple-system,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:${color.background};min-height:100vh;">
    <tr>
      <td align="center" style="padding:24px;">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:520px;background-color:${color.cardBackground};border-radius:16px;border:1px solid ${color.border};box-shadow:0 10px 30px rgba(15,23,42,0.08);">
          <tr>
            <td style="padding:32px 32px 16px 32px;text-align:center;">
              <img src="https://${host}/logo-black.png" alt="Seer logo" height="30" width="32" style="display:block;margin:0 auto 12px;" />
              <h1 style="margin:0;font-size:24px;font-weight:700;color:${brandColor};">Your sign-in code</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 24px 32px;text-align:center;color:${color.text};">
              <p style="margin:0 0 16px 0;font-size:16px;line-height:1.5;">
                Enter this verification code to continue signing in to <strong>${escapedHost}</strong>.
              </p>
              <div style="display:inline-block;padding:16px 32px;border-radius:12px;background:${color.accent};font-size:32px;font-weight:700;letter-spacing:8px;color:${brandColor};">
                ${spacedCode}
              </div>
              <p style="margin:16px 0 0 0;font-size:14px;color:${color.muted};">
                This code expires in ${expiresInMinutes} minutes.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 32px 32px;color:${color.muted};font-size:13px;line-height:1.6;">
              <p style="margin:0 0 12px 0;">If you didn’t request this code, you can ignore this email.</p>
              <p style="margin:0;">Need help? Reply to this message and our team will be in touch.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
}

function text(params: {
  host: string;
  code: string;
  expiresInMinutes: number;
}) {
  const { host, code, expiresInMinutes } = params;
  return `Your verification code for ${host} is ${code}.

Enter this code on the sign-in screen. The code expires in ${expiresInMinutes} minutes.

If you didn’t request this email, you can safely ignore it.`;
}
