import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function StartTrial(userId: string) {
  const user = await prisma.trial.findUnique({
    where: {
      userId: userId,
    },
  });

  if (!user) {
    await prisma.trial.create({
      data: {
        userId: userId
      }
    });
  }
}