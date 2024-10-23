"use server";

import { isAuthenticated } from "@/app/lib/dal";
import prisma from "@/app/lib/db";
import { redirect } from "next/navigation";
import { ValueType, ViolatedValueType } from "@prisma/client";

interface FileData {
  name: string;
  data: string;
  key: string;
}

interface ResultData {
  heuristic: string;
  violated: string;
  reason: string;
}

export async function getUser(userId: string) {
  let session = await isAuthenticated();

  // A user cannot get another user
  if (session.userId !== userId) {
    redirect("/error");
  }

  let user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
  });

  // If a user does not exist there is a problem
  if (!user) {
    redirect("/error");
  }

  return user;
}

export async function updateCredits(userId: string, creditsDelta: number) {
  let session = await isAuthenticated();

  // A user cannot update another user
  if (session.userId !== userId) {
    redirect("/error");
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      credits: {
        increment: creditsDelta,
      },
    },
  });
}

export async function deleteHeuristicEvaluation(id: string, userId: string) {
  let session = await isAuthenticated();

  // A user cannot update another user's data
  if (session.userId !== userId) {
    redirect("/error");
  }

  // Delete the heuristic evaluation from the database
  await prisma.heuristicEvaluation.delete({
    where: {
      id: id,
    },
  });
}

export async function getHeuristicEvaluation(id: string, userId: string) {
  let session = await isAuthenticated();

  // A user cannot update another user's data
  if (session.userId !== userId) {
    redirect("/error");
  }

  let heuristicEvaluation = await prisma.heuristicEvaluation.findUnique({
    where: {
      id: id,
    },
    include: {
      files: true,
      results: true,
    },
  });

  // If data does not exist there is a problem
  if (!heuristicEvaluation) {
    redirect("/error");
  }

  return heuristicEvaluation;
}

export async function getHeuristicEvaluations(userId: string) {
  let session = await isAuthenticated();

  // A user cannot update another user's data
  if (session.userId !== userId) {
    redirect("/error");
  }

  let heuristicEvaluations = await prisma.heuristicEvaluation.findMany({
    where: { userId: userId },
    orderBy: [
      {
        createdAt: "desc",
      },
    ],
    include: {
      _count: {
        select: {
          files: true,
          results: { where: { violated: "yes" as ViolatedValueType } },
        },
      },
      files: true,
    },
  });

  return heuristicEvaluations;
}

export async function newHeuristicEvaluation(
  userId: string,
  goal: string,
  files: Array<FileData>,
  keys: Array<string>,
  heuristic: string,
  results: Array<ResultData>,
) {
  let session = await isAuthenticated();

  // A user cannot update another user's data
  if (session.userId !== userId) {
    redirect("/error");
  }

  let heuristicEvaluation = await prisma.heuristicEvaluation.create({
    data: {
      userId: userId,
      userGoal: goal,
      heuristic: heuristic as ValueType,
      files: {
        create: keys.map((key) => ({
          key: key,
        })),
      },
      results: {
        create: results.map((result) => ({
          heuristic: result.heuristic,
          violated: result.violated.toLowerCase() as ViolatedValueType,
          reason: result.reason,
        })),
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
