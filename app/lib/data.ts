import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function isTrial(userId: string) {
  let user = await prisma.trial.findUnique({
    where: {
      userId: userId,
    },
  });

  if (!user) {
    user = await prisma.trial.create({
      data: {
        userId: userId
      }
    });
  }

  return user;
}