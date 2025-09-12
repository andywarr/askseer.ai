import Google from "next-auth/providers/google";
import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import prisma from "@/apps/nextjs-app/lib/db";
import Resend from "next-auth/providers/resend";
import { logger } from "@/apps/shared/logger";

interface Theme {
  brandColor?: string;
  buttonText?: string;
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
        const { identifier: to, provider, url, theme } = params;
        const { host } = new URL(url);
        const res = await fetch("https://api.resend.com/emails", {
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

        if (!res.ok)
          throw new Error("Resend error: " + JSON.stringify(await res.json()));
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      // Determine if this is the very first sign-in for the user.
      // The previous logic used !user.id which is always false because id is always present.
      let isNewUser = false;
      try {
        // If the user has no existing sessions yet, we treat this as the first sign-in.
        const priorSessions = await prisma.session.count({ where: { userId: user.id } });
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
                      Sign in to Seer
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
                If you didn't request this email, you can safely ignore it.
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
