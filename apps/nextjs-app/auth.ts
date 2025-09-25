import Google from "next-auth/providers/google";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import prisma from "@/apps/nextjs-app/lib/db";
import Resend from "next-auth/providers/resend";
import { logger } from "@/apps/shared/logger";
import { randomUUID } from "node:crypto";
import { cookies as nextCookies } from "next/headers";
import {
  encode as defaultEncode,
  decode as defaultDecode,
} from "next-auth/jwt";

interface Theme {
  brandColor?: string;
  buttonText?: string;
}

const adapter = PrismaAdapter(prisma);

// In-memory rate limiter for email link sends (per instance)
const emailLinkRate:
  | Map<string, number[]>
  | (typeof globalThis & { __emailLinkRate?: Map<string, number[]> }) =
  ((globalThis as any).__emailLinkRate as Map<string, number[]>) ||
  new Map<string, number[]>();
if (!(globalThis as any).__emailLinkRate) {
  (globalThis as any).__emailLinkRate = emailLinkRate as Map<string, number[]>;
}

const generateSessionToken = () =>
  randomUUID?.() ?? Math.random().toString(36).slice(2);
const fromDate = (time: number, date = Date.now()) =>
  new Date(date + time * 1000);

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter,
  session: { strategy: "database", maxAge: 30 * 24 * 60 * 60 },
  jwt: {
    encode: async (params: any) => {
      const c = await nextCookies();
      const cookie = c.get("authjs.session-token")?.value;
      if (cookie) return cookie;
      return defaultEncode(params as any);
    },
    decode: async (params: any) => {
      const c = await nextCookies();
      const cookieExists = !!c.get("authjs.session-token")?.value;
      if (cookieExists) return null;
      return defaultDecode(params as any);
    },
  },
  providers: [
    Credentials({
      id: "otp",
      name: "One-Time Password",
      credentials: {
        email: { label: "Email", type: "text" },
        code: { label: "Code", type: "text" },
      },
      async authorize(creds) {
        const email = (creds?.email as string | undefined)?.toLowerCase();
        const code = creds?.code as string | undefined;
        if (!email || !code) return null;
        try {
          const { verifyAndConsumeOtp } = await import(
            "@/apps/nextjs-app/lib/otp"
          );
          const result = await verifyAndConsumeOtp(email, code);
          if (!result.valid) return null;

          let user = await prisma.user.findUnique({ where: { email } });
          let isNewUser = false;
          if (!user) {
            user = await prisma.user.create({ data: { email } });
            isNewUser = true;
          }

          if (isNewUser) {
            const userId = user.id;
            const displayName =
              user.name ?? (user.email ? user.email.split("@")[0] : "Personal");
            const teamName = `${displayName}'s Personal Team`;
            try {
              await prisma.$transaction(async (tx) => {
                await tx.communicationPreferences.upsert({
                  where: { userId },
                  update: {},
                  create: { userId },
                });
                const team = await tx.team.create({
                  data: {
                    name: teamName,
                    isPersonal: true,
                    createdByUserId: userId,
                    credits: 3,
                  },
                });
                await tx.teamMembership.create({
                  data: { teamId: team.id, userId, role: "OWNER" },
                });
                await tx.creditLedger.create({
                  data: {
                    teamId: team.id,
                    byUserId: userId,
                    delta: 3,
                    reason: "initial_personal_team_grant",
                  },
                });
                await tx.user.update({
                  where: { id: userId },
                  data: { selectedTeamId: team.id },
                });
              });
              logger.info("OTP new user bootstrapped", {
                userId,
                emailDomain: user.email?.split("@")[1] || "unknown",
              });
            } catch (e) {
              logger.error("OTP user bootstrap failed", {
                userId,
                error: e instanceof Error ? e.message : String(e),
              });
            }
          }

          // Manually create DB session and set cookie for credentials flow
          const sessionMaxAge = 30 * 24 * 60 * 60; // seconds
          const sessionToken = generateSessionToken();
          const sessionExpiry = fromDate(sessionMaxAge);
          await adapter.createSession!({
            sessionToken,
            userId: user.id,
            expires: sessionExpiry,
          });

          const c = await nextCookies();
          const isSecure = (process.env.NEXTAUTH_URL || "").startsWith(
            "https://",
          );
          c.set("authjs.session-token", sessionToken, {
            httpOnly: true,
            sameSite: "lax",
            path: "/",
            secure: isSecure,
            expires: sessionExpiry,
          });

          return { id: user.id, email: user.email, name: user.name } as any;
        } catch (error) {
          logger.error("OTP authorize failed", {
            emailDomain: email.split("@")[1],
            error: error instanceof Error ? error.message : String(error),
          });
          return null;
        }
      },
    }),
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
        const { identifier: to, provider, url, theme } = params;
        const { host } = new URL(url);
        // Rate limit: max 3 link sends per 30 minutes per email
        const windowMinutes = 30;
        const maxRequests = 3;
        const key = (to || "").toLowerCase();
        const now = Date.now();
        const windowStart = now - windowMinutes * 60 * 1000;
        const entries = (emailLinkRate as Map<string, number[]>).get(key) || [];
        const recent = entries
          .filter((t) => t > windowStart)
          .sort((a, b) => a - b);
        if (recent.length >= maxRequests) {
          const oldest = recent[0];
          const retryAfterMs = oldest + windowMinutes * 60 * 1000 - now;
          const retryAfterSec = Math.max(30, Math.ceil(retryAfterMs / 1000));
          logger.warn("Email link rate limit exceeded", {
            toDomain: key.split("@")[1] || "unknown",
            recentCount: recent.length,
            retryAfterSec,
          });
          // Propagate a structured error for the client to handle
          throw new Error(`RATE_LIMITED:${retryAfterSec}`);
        }
        let res: Response;
        try {
          // Record request time pre-send to avoid bursts on provider failure
          (emailLinkRate as Map<string, number[]>).set(key, [...recent, now]);
          res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${provider.apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: provider.from,
              to,
              subject: `Sign in to ${host}`,
              html: html({ url, host, theme }),
              text: text({ url, host }),
            }),
          });
        } catch (error) {
          logger.error("Resend verification request failed", {
            to,
            host,
            error: error instanceof Error ? error.message : String(error),
          });
          throw error;
        }

        if (!res.ok) {
          const errorBody = await res.json().catch(() => null);
          logger.error("Resend verification email failed", {
            to,
            host,
            status: res.status,
            error: errorBody,
          });
          throw new Error("Resend error: " + JSON.stringify(errorBody));
        }

        logger.info("Resend verification email sent", { to, host });
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      try {
        // Determine if this is the very first sign-in for the user.
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
        const userId = user.id!; // id is defined after creation

        // Build a friendly default name for the personal team
        const displayName =
          user.name ?? (user.email ? user.email.split("@")[0] : "Personal");
        const teamName = `${displayName}'s Personal Team`;

        // Run related writes in a transaction so we don't end up with partial state
        let personalTeamId: string | null = null;
        await prisma.$transaction(async (tx) => {
          // Ensure communication preferences exist for the user
          await tx.communicationPreferences.upsert({
            where: { userId },
            update: {},
            create: { userId },
          });

          // Create the Personal team and add the user as the OWNER
          const team = await tx.team.create({
            data: {
              name: teamName,
              isPersonal: true,
              createdByUserId: userId,
              credits: 3,
            },
          });
          personalTeamId = team.id;

          await tx.teamMembership.create({
            data: {
              teamId: team.id,
              userId,
              role: "OWNER",
            },
          });

          // Record the initial grant in the credit ledger for auditability
          await tx.creditLedger.create({
            data: {
              teamId: team.id,
              byUserId: userId,
              delta: 3,
              reason: "initial_personal_team_grant",
            },
          });
          // Set the user's selectedTeamId to the newly created personal team
          await tx.user.update({
            where: { id: userId },
            data: { selectedTeamId: team.id },
          });
        });

        const domain = user.email?.split("@")[1];
        if (domain) {
          try {
            const companyDomain = await prisma.companyDomain.findUnique({
              where: { domain },
              include: {
                company: {
                  select: { id: true, autoEnroll: true, status: true },
                },
              },
            });
            if (
              companyDomain &&
              companyDomain.status === "ACTIVE" &&
              companyDomain.company?.autoEnroll
            ) {
              await prisma.companyMembership.upsert({
                where: {
                  companyId_userId: {
                    companyId: companyDomain.company.id,
                    userId,
                  },
                },
                create: {
                  companyId: companyDomain.company.id,
                  userId,
                  role: "MEMBER",
                  status: "ACTIVE",
                  deactivatedAt: null,
                },
                update: {
                  role: "MEMBER",
                  status: "ACTIVE",
                  deactivatedAt: null,
                },
              });
              // Attach the freshly created personal team to the company (only at initial user creation)
              if (personalTeamId) {
                try {
                  await prisma.team.update({
                    where: { id: personalTeamId },
                    data: { companyId: companyDomain.company.id },
                  });
                } catch (err) {
                  logger.warn("Failed to attach personal team on new user auto-enroll", {
                    userId,
                    teamId: personalTeamId,
                    companyId: companyDomain.company.id,
                    error: err,
                  });
                }
              }
            }
          } catch (error) {
            logger.error("Failed to auto-enroll user to company", {
              userId,
              domain,
              error,
            });
          }
        }
      } catch (error) {
        console.info(error);
        logger.error("Failed to create user", {
          userId: user.id,
          error: error instanceof Error ? error.message : String(error),
        });
        return;
      }
      // Separate info log AFTER successful transactional setup so metrics/alerts are accurate
      logger.info("User created", {
        userId: user.id,
        emailDomain: user.email?.split("@")[1] || "unknown",
      });
    },
  },
});

function html(params: { url: string; host: string; theme: Theme }) {
  const { url, host, theme } = params;

  const escapedHost = host.replace(/\./g, "&#8203;.");

  const brandColor = theme.brandColor || "#18181b";
  const color = {
    background: "#f8fafc",
    text: "#3f3f46",
    mainBackground: "#ffffff",
    cardBackground: "#ffffff",
    buttonBackground: brandColor,
    buttonBorder: brandColor,
    buttonText: theme.buttonText || "#ffffff",
    accent: "#f1f5f9",
    border: "#e2e8f0",
  };

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sign in to ${escapedHost}</title>
</head>
<body style="margin: 0; padding: 0; background-color: ${color.background}; font-family: 'Roboto', system-ui, -apple-system, Arial, sans-serif; line-height: 1.6;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: ${color.background}; min-height: 100vh;">
    <tr>
      <td align="center" style="padding: 20px 20px;">
        <!-- Main container -->
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: ${color.cardBackground}; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); border: 1px solid ${color.border};">
          <!-- Header with logo -->
          <tr>
            <td align="center" style="padding: 40px 40px 20px 40px;">
              <div style="text-align: center;">
                <img src="https://${host}/logo-black.png" alt="Seer logo" height="30" width="32" style="display: block; margin: 0 auto 8px;" />
                <h1 style="margin: 0; font-size: 28px; font-weight: 800; color: ${brandColor}; letter-spacing: -0.025em;">Seer</h1>
              </div>
            </td>
          </tr>
          
          <!-- Main content -->
          <tr>
            <td align="center" style="padding: 0 40px 20px 40px;">
              <h2 style="margin: 0 0 16px 0; font-size: 24px; font-weight: 600; color: ${color.text}; line-height: 1.25;">
                Let's unlock some insights!
              </h2>
              <p style="margin: 0 0 32px 0; font-size: 16px; color: #64748b; line-height: 1.5;">
                Click the button below to sign in to <strong style="color: ${color.text};">${escapedHost}</strong>
              </p>
            </td>
          </tr>
          
          <!-- CTA Button -->
          <tr>
            <td align="center" style="padding: 0 40px 32px 40px;">
              <table border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center" style="border-radius: 8px; background-color: ${color.buttonBackground}; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);">
                    <a href="${url}" target="_blank" style="display: inline-block; padding: 12px 32px; font-size: 16px; font-weight: 500; color: ${color.buttonText}; text-decoration: none; border-radius: 8px; transition: all 0.2s ease;">
                      Sign in
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Divider -->
          <tr>
            <td style="padding: 0 40px;">
              <hr style="border: none; border-top: 1px solid ${color.border}; margin: 0;">
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td align="center" style="padding: 32px 40px 40px 40px;">
              <p style="margin: 0 0 8px 0; font-size: 14px; color: #64748b; line-height: 1.5;">
                If you didn't request this link, you can safely ignore it.
              </p>
              <p style="margin: 0; font-size: 12px; color: #94a3b8;">
                This link will expire in 24 hours for security reasons.
              </p>
            </td>
          </tr>
        </table>
        
        <!-- Footer text outside card -->
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; margin-top: 24px;">
          <tr>
            <td align="center">
              <p style="margin: 0; font-size: 12px; color: #94a3b8; line-height: 1.5;">
                © ${new Date().getFullYear()} Seer. All rights reserved.
              </p>
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

// Email Text body (fallback for email clients that don't render HTML, e.g. feature phones)
function text({ url, host }: { url: string; host: string }) {
  return `Sign in to ${host}\n${url}\n\n`;
}
