import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import prisma from "@/apps/nextjs-app/lib/db";
import { logger } from "@/apps/shared/logger";
import {
  OtpConfigurationError,
  OtpInvalidError,
  OtpRateLimitError,
  normalizeEmail,
  verifyOtpChallenge,
} from "@/apps/nextjs-app/lib/otp";
import { z } from "zod";

const otpCredentialsSchema = z.object({
  email: z.string().email(),
  flowId: z.string().min(6).max(64),
  code: z.string().regex(/^[0-9]{6}$/),
});

async function bootstrapUserResources(user: {
  id: string;
  name?: string | null;
  email?: string | null;
}) {
  try {
    const userId = user.id;
    const displayName =
      user.name ?? (user.email ? user.email.split("@")[0] : "Personal");
    const teamName = `${displayName}'s Personal Team`;

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
        data: {
          teamId: team.id,
          userId,
          role: "OWNER",
        },
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
  } catch (error) {
    logger.error("Failed to bootstrap user resources", {
      userId: user.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

function extractRequestMetadata(request?: Request | null) {
  if (!request) {
    return { ip: null, userAgent: null };
  }

  const headers = request.headers ?? new Headers();
  const forwarded =
    headers.get("x-forwarded-for") || headers.get("x-real-ip") || null;
  const candidateIp = forwarded
    ? forwarded.split(",")[0]?.trim()
    : (request as unknown as { ip?: string }).ip;

  return {
    ip: candidateIp ?? null,
    userAgent: headers.get("user-agent"),
  };
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
    Credentials({
      id: "otp",
      name: "Email OTP",
      credentials: {
        email: { label: "Email", type: "email" },
        flowId: { label: "Flow ID", type: "text" },
        code: { label: "Code", type: "text" },
      },
      async authorize(credentials, request) {
        const parsed = otpCredentialsSchema.safeParse(credentials);
        if (!parsed.success) {
          logger.warn("Invalid OTP credential payload", {
            issues: parsed.error.flatten(),
          });
          return null;
        }

        const { email, flowId, code } = parsed.data;
        const { ip, userAgent } = extractRequestMetadata(request);

        try {
          const normalizedEmail = await verifyOtpChallenge({
            email,
            flowId,
            code,
            ip,
            userAgent,
          });

          let user = await prisma.user.findUnique({
            where: { email: normalizedEmail },
          });

          let isNewUser = false;
          if (!user) {
            user = await prisma.user.create({
              data: {
                email: normalizedEmail,
                emailVerified: new Date(),
              },
            });
            isNewUser = true;
            await bootstrapUserResources(user);
          } else if (!user.emailVerified) {
            user = await prisma.user.update({
              where: { id: user.id },
              data: { emailVerified: new Date() },
            });
          }

          logger.info("OTP authentication succeeded", {
            provider: "otp",
            emailDomain: normalizedEmail.split("@")[1] || "unknown",
            isNewUser,
          });

          return user;
        } catch (error) {
          if (error instanceof OtpRateLimitError) {
            logger.warn("OTP verification rate limited", {
              emailDomain: normalizeEmail(email).split("@")[1] || "unknown",
            });
            throw new Error("OTP_RATE_LIMIT");
          }

          if (error instanceof OtpInvalidError) {
            logger.warn("OTP verification rejected", {
              emailDomain: normalizeEmail(email).split("@")[1] || "unknown",
              reason: error.reason,
            });
            throw new Error(
              error.reason === "LOCKED" ? "OTP_LOCKED" : "OTP_INVALID",
            );
          }

          if (error instanceof OtpConfigurationError) {
            logger.error("OTP verification unavailable", {
              emailDomain: normalizeEmail(email).split("@")[1] || "unknown",
            });
            throw new Error("OTP_ERROR");
          }

          logger.error("Unexpected OTP verification failure", {
            emailDomain: normalizeEmail(email).split("@")[1] || "unknown",
            error: error instanceof Error ? error.message : String(error),
          });
          throw new Error("OTP_ERROR");
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
    async session({ session, user, token }) {
      const existingSessionUserId =
        typeof (session as { userId?: unknown })?.userId === "string"
          ? (session as { userId?: string }).userId
          : undefined;

      const emailCandidate =
        session.user?.email ??
        (typeof user?.email === "string" ? user.email : undefined) ??
        (typeof token?.email === "string" ? token.email : undefined);

      let userId =
        existingSessionUserId ??
        (typeof user?.id === "string" ? user.id : undefined) ??
        (typeof token?.sub === "string" ? token.sub : undefined);

      if (!userId && emailCandidate) {
        const normalizedEmail = normalizeEmail(emailCandidate);
        const searchEmails =
          normalizedEmail === emailCandidate
            ? [normalizedEmail]
            : [normalizedEmail, emailCandidate];

        for (const candidateEmail of searchEmails) {
          try {
            const result = await prisma.user.findUnique({
              where: { email: candidateEmail },
              select: { id: true },
            });

            if (result?.id) {
              userId = result.id;
              break;
            }
          } catch (error) {
            logger.error("Failed to resolve session user id", {
              emailDomain: candidateEmail.split("@")[1] || "unknown",
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
      }

      const email = emailCandidate;

      const name =
        session.user?.name ??
        (typeof user?.name === "string" ? user.name : undefined) ??
        (typeof token?.name === "string" ? token.name : undefined);

      const image =
        session.user?.image ??
        (typeof user?.image === "string" ? user.image : undefined) ??
        (typeof token?.picture === "string" ? token.picture : undefined);

      const nextUser: Record<string, unknown> = {
        ...(session.user ?? {}),
      };

      if (userId) {
        nextUser.id = userId;
      }
      if (email) {
        nextUser.email = email;
      }
      if (name) {
        nextUser.name = name;
      }
      if (image) {
        nextUser.image = image;
      }

      const nextSession: Record<string, unknown> = {
        ...session,
        user: nextUser,
      };

      if (userId) {
        nextSession.userId = userId;
      }

      return nextSession as typeof session;
    },
  },
  events: {
    async createUser({ user }) {
      await bootstrapUserResources(user);
      logger.info("User created", {
        userId: user.id,
        emailDomain: user.email?.split("@")[1] || "unknown",
      });
    },
  },
});

