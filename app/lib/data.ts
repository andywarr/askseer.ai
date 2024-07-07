import { PrismaClient, ValueType, ViolatedValueType } from '@prisma/client';

interface FileData {
  name: string;
  data: string;
}

interface ResultData {
  heuristic: string;
  violated: string;
  reason: string;
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

export async function setTrial(userId: string) {
  
}

export async function getHeuristicEvaluation(id: string) {
  let heuristicEvaluation = await prisma.heuristicEvaluation.findUnique({
    where: {
      id: id,
    },
    include: {
      results: true,
    },
  });

  return heuristicEvaluation;
}

export async function newHeuristicEvaluation(userId: string, goal: string, files: Array<FileData>, heuristic: string, results: Array<ResultData>) {
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
      results: {
        create: results.map(result => ({
          heuristic: result.heuristic,
          violated: result.violated.toLowerCase() as ViolatedValueType,
          reason: result.reason
        }))
      },
    },
    include: {
      files: true,
    },
  });

  return heuristicEvaluation;
}
