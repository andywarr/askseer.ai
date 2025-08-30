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
      // Log successful sign-in
      logger.info("User sign-in successful", {
        provider: account?.provider || "unknown",
        isNewUser: !user.id,
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
            },
          });

          await tx.teamMembership.create({
            data: {
              teamId: team.id,
              userId,
              role: "OWNER",
            },
          });
        });
      } catch (error) {
        console.info(error);
        logger.error("Failed to create user", {
          userId: user.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
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
              <div style="display: inline-flex; align-items: center; gap: 8px;">
                <svg width="32" height="30" viewBox="0 0 96 90" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path fill-rule="evenodd" clip-rule="evenodd" d="M82.5257 21.0658C79.1879 15.1755 74.5474 10.5782 68.5328 7.22575L72.5603 0C79.8747 4.07689 85.615 9.74774 89.7099 16.9647C93.9446 24.234 96 32.5627 96 41.8193C96 50.9833 93.9378 59.3013 89.7178 66.6601C85.6284 73.873 79.8998 79.5917 72.6049 83.7773L72.5604 83.8028C65.2148 87.8972 56.9661 89.9011 47.9178 89.9011C38.9687 89.9011 30.7769 87.8924 23.4394 83.8026L23.3685 83.7631C16.1932 79.5775 10.4882 73.8714 6.30258 66.6961L6.28769 66.6705C2.06396 59.3092 0 50.9876 0 41.8193C0 32.5533 2.0591 24.217 6.30258 16.9425C10.4942 9.75679 16.2139 4.09426 23.4139 0.0143063L27.4922 7.21144C21.5741 10.565 16.9086 15.1784 13.448 21.1107C10.0393 26.9542 8.27237 33.8132 8.27237 41.8193C8.27237 49.6988 10.0319 56.5682 13.4555 62.5406C16.9145 68.4656 21.5803 73.1345 27.5022 76.5965C33.4926 79.9274 40.2657 81.6288 47.9178 81.6288C55.6946 81.6288 62.5245 79.9205 68.5102 76.5894C74.5383 73.1258 79.1859 68.4666 82.5257 62.5728L82.5367 62.5535C85.9652 56.5782 87.7273 49.7045 87.7273 41.8193C87.7273 33.8132 85.9602 26.9542 82.5515 21.1107L82.5257 21.0658Z" fill="${brandColor}"/>
                  <path d="M47.691 73.2942C41.7739 73.2942 36.4407 71.9707 31.6914 69.3235C27.0199 66.5985 23.3217 62.9003 20.5967 58.2288C17.8717 53.4795 16.5092 48.0684 16.5092 41.9956C16.5092 35.8448 17.8717 30.4338 20.5967 25.7623C23.3217 21.0909 27.0199 17.4316 31.6914 14.7844C36.3628 12.1373 41.696 10.8137 47.691 10.8137C53.7639 10.8137 59.1361 12.1373 63.8075 14.7844C68.5568 17.4316 72.255 21.0909 74.9022 25.7623C77.6272 30.4338 78.9897 35.8448 78.9897 41.9956C78.9897 48.0684 77.6272 53.4795 74.9022 58.2288C72.255 62.9003 68.5568 66.5985 63.8075 69.3235C59.0582 71.9707 53.6861 73.2942 47.691 73.2942ZM47.691 65.9367C52.1289 65.9367 56.0607 64.9635 59.4864 63.0171C62.9122 60.9928 65.5982 58.1899 67.5447 54.6085C69.569 50.9492 70.5811 46.7449 70.5811 41.9956C70.5811 37.1684 69.569 32.9641 67.5447 29.3827C65.5982 25.8012 62.9122 23.0373 59.4864 21.0909C56.0607 19.0666 52.1678 18.0544 47.8078 18.0544C43.4478 18.0544 39.5549 19.0666 36.1292 21.0909C32.7035 23.0373 29.9785 25.8012 27.9542 29.3827C25.9299 32.9641 24.9178 37.1684 24.9178 41.9956C24.9178 46.7449 25.9299 50.9492 27.9542 54.6085C29.9785 58.1899 32.7035 60.9928 36.1292 63.0171C39.5549 64.9635 43.4089 65.9367 47.691 65.9367Z" fill="${brandColor}"/>
                </svg>
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
