"use server";

// Next imports
import { redirect } from "next/navigation";

// Lib function imports
import { isAuthenticated } from "@/app/lib/dal";
import prisma from "@/app/lib/db";

import { StudyType, ViolatedType } from "@prisma/client";

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

export async function deleteStudy(id: string, userId: string) {
  let session = await isAuthenticated();

  // A user cannot update another user's data
  if (session.userId !== userId) {
    redirect("/error");
  }

  // Delete the heuristic evaluation from the database
  await prisma.study.delete({
    where: {
      id: id,
    },
  });
}

export async function getStudy(id: string, userId: string) {
  let session = await isAuthenticated();

  // A user cannot update another user's data
  if (session.userId !== userId) {
    redirect("/error");
  }

  let study = await prisma.study.findUnique({
    where: {
      id: id,
    },
    include: {
      files: true,
      heuristicEvaluation: true,
    },
  });

  // If data does not exist there is a problem
  if (!study) {
    redirect("/error");
  }

  return study;
}

export async function getStudies(userId: string) {
  let session = await isAuthenticated();

  // A user cannot update another user's data
  if (session.userId !== userId) {
    redirect("/error");
  }

  // Step 1: Get all studies for the user
  let studies = await prisma.study.findMany({
    where: { userId: userId },
    orderBy: [
      {
        createdAt: "desc",
      },
    ],
    include: {
      // _count: {
      //   select: {
      //     files: true,
      //   },
      // },
      files: true,
      heuristicEvaluation: true,
    },
  });

  return studies;
}

// export async function newHeuristicEvaluation(
//   userId: string,
//   goal: string,
//   files: Array<FileData>,
//   keys: Array<string>,
//   heuristic: string,
//   results: Array<ResultData>,
// ) {
//   let session = await isAuthenticated();

//   // A user cannot update another user's data
//   if (session.userId !== userId) {
//     redirect("/error");
//   }

//   // TODO: Create a study
//   let study = await prisma.study.create({
//     data: {
//       userId: userId,
//       type: StudyType.HEURISTIC_EVALUATION,
//       files: {
//         create: files.map((file, index) => ({
//           bucket: "askseer-dev",
//           key: keys[index],
//           // size: file.size,
//           // type: file.type,
//         })),
//       },
//     },
//     include: {
//       files: true,
//     },
//   });

//   // TODO: Create a heuristic evaluation

//   let heuristicEvaluation = await prisma.heuristicEvaluation.create({
//     data: {
//       studyId: study.id,
//       goal: goal,
//       //type:
//       results: {
//         create: results.map((result) => ({
//           // heuristicId:
//           violated: result.violated.toLowerCase() as ViolatedType,
//           reason: result.reason,
//           //source:
//         })),
//       },
//     },
//   });

//   const updatedUser = await prisma.user.update({
//     where: { id: userId },
//     data: {
//       credits: {
//         increment: -1,
//       },
//     },
//   });

//   return heuristicEvaluation;
// }
