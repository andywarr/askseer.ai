import prisma from '@/app/lib/db'
import { ValueType, ViolatedValueType } from '@prisma/client';

interface FileData {
  name: string;
  data: string;
}

interface ResultData {
  heuristic: string;
  violated: string;
  reason: string;
}

export async function getUser(userId: string) {
  let user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
  });

  return user;
}

export async function updateCredits(userId: string, creditsDelta: number) {
  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      credits: {
        increment: creditsDelta,
      },
    },
  });
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

export async function getHeuristicEvaluations(userId: string) {
  let heuristicEvaluations = await prisma.heuristicEvaluation.findMany({
    where: { userId: userId },
    orderBy: [
      {
        createdAt: 'desc',
      },
    ],
    include: {
      _count: {
        select: {
          files: true,
          results: { where: { violated: 'yes' as ViolatedValueType } }
        },
      },
      files: true
    },
  });

  return heuristicEvaluations;
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

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      credits: {
        increment: -1,
      },
    },
  });

  return heuristicEvaluation;
}
