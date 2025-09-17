import type { PrismaClient } from "@prisma/client";

type MinimalUser = {
  id: string;
  email?: string | null;
  name?: string | null;
};

export async function bootstrapNewUser(
  prisma: PrismaClient,
  user: MinimalUser,
) {
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
}
