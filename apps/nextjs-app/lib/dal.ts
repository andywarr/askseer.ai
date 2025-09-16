import "server-only";

import { auth } from "@/apps/nextjs-app/auth";
import prisma from "@/apps/nextjs-app/lib/db";
import { logger } from "@/apps/shared/logger";
import { redirect } from "next/navigation";
import { cache } from "react";

export const isAuthenticated = cache(async () => {
  const session = await auth();

  if (!session) {
    redirect("/");
  }

  let userId =
    (typeof (session as { userId?: unknown })?.userId === "string"
      ? (session as { userId: string }).userId
      : undefined) ??
    (typeof session.user?.id === "string" ? session.user.id : undefined);

  if (!userId) {
    const emailCandidate =
      typeof session.user?.email === "string" ? session.user.email : undefined;

    if (emailCandidate) {
      const normalizedEmail = emailCandidate.trim().toLowerCase();
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
            (session as { userId?: string }).userId = result.id;
            if (session.user) {
              (session.user as { id?: string }).id = result.id;
            }
            break;
          }
        } catch (error) {
          logger.error("Failed to resolve session user id for auth check", {
            emailDomain: candidateEmail.split("@")[1] || "unknown",
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      if (!userId) {
        logger.warn("Session email missing matching user record", {
          emailDomain: normalizedEmail.split("@")[1] || "unknown",
        });
      }
    }
  }

  if (!userId) {
    redirect("/");
  }

  return { isAuth: true, userId };
});
