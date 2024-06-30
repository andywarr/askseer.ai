import { PrismaClient, ValueType } from '@prisma/client';

interface FileData {
  name: string;
  data: string;
}

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

export async function newHeuristicEvaluation(userId: string, goal: string, files: Array<FileData>, heuristic: string) {
  let heuristicEvaluation = await prisma.heuristicEvaluation.create({
    data: {
      userId: userId,
      userGoal: goal,
      heuristic: heuristic as ValueType,
      files: {
        create: files.map(file => ({
          fileName: file.name,
          fileData: Buffer.from(file.data, 'base64')
        })),
      },
    },
    include: {
      files: true,
    },
  });

  return heuristicEvaluation;
}