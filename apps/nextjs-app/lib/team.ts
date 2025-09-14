"use server";

import prisma from "@/apps/nextjs-app/lib/db";
import { getCurrentUser } from "@/apps/nextjs-app/lib/user";
import { TeamRole } from "@prisma/client";
import { z } from "zod";
import { Resend } from "resend";
import { createStyledEmailHtml } from "@/apps/nextjs-app/lib/action";
import { randomUUID } from "crypto";

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum([TeamRole.ADMIN, TeamRole.MEMBER, TeamRole.VIEWER]),
  message: z.string().max(500).optional(),
});

export async function inviteTeamMember(formData: FormData) {
  const { user } = await getCurrentUser();
  if (!user.selectedTeamId) {
    return { error: "No team selected" };
  }

  const data = {
    email: String(formData.get("email") || ""),
    role: (formData.get("role") as TeamRole) || TeamRole.MEMBER,
    message: (formData.get("message") as string) || undefined,
  };

  const parsed = inviteSchema.safeParse(data);
  if (!parsed.success) {
    return { error: "Invalid input" };
  }

  const token = randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await prisma.teamInvite.create({
    data: {
      teamId: user.selectedTeamId,
      email: parsed.data.email,
      role: parsed.data.role,
      token,
      expiresAt,
      invitedById: user.id,
    },
  });

  const team = await prisma.team.findUnique({
    where: { id: user.selectedTeamId },
    select: { name: true },
  });

  const resend = new Resend(process.env.AUTH_RESEND_KEY);
  const html = createStyledEmailHtml({
    title: "You're invited to join Seer",
    subtitle: team?.name ? `Join ${team.name} on Seer` : "Join Seer",
    content: `<p style="margin:0 0 16px;">${
      user.name || "A teammate"
    } has invited you to join ${team?.name || "Seer"}.</p>${
      parsed.data.message
        ? `<p style="margin:0;">${parsed.data.message}</p>`
        : ""
    }`,
    buttonText: "Open Seer",
    buttonUrl: process.env.NEXT_PUBLIC_APP_URL || "https://app.askseer.ai",
  });

  await resend.emails.send({
    from: process.env.AUTH_RESEND_FROM || "onboarding@resend.dev",
    to: parsed.data.email,
    subject: `${user.name || "A teammate"} invited you to join ${team?.name || "Seer"}`,
    html,
  });

  return { success: true };
}

