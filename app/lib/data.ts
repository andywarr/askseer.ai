"use server";

// Next imports
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

// Lib function imports
import { isAuthenticated } from "@/app/lib/dal";
import prisma from "@/app/lib/db";

import {
  FileType,
  HeuristicType,
  ImageType,
  SourceType,
  StudyType,
  ViolatedType,
} from "@prisma/client";

interface FileData {
  name: string;
  data: string;
  key: string;
  size: number;
  type: string;
}

interface ResultData {
  id: string;
  heuristic: string;
  type: string;
  violated: string;
  reason: string;
  recommendation: string;
}

function convertToFileType(type: string): FileType {
  switch (type.split("/")[0].toLowerCase()) {
    case "image":
      return FileType.IMAGE;
    default:
      return FileType.UNKNOWN;
  }
}

function convertToHeuristicType(heuristic: string): HeuristicType {
  switch (heuristic.toUpperCase()) {
    case "NIELSEN":
      return HeuristicType.NIELSEN;
    case "TENETS":
      return HeuristicType.TENETS;
    default:
      return HeuristicType.UNKNOWN;
  }
}

function convertToImageType(type: string): ImageType {
  switch (type.split("/")[1].toLowerCase()) {
    case "image/apng":
      return ImageType.APNG;
    case "image/avif":
      return ImageType.AVIF;
    case "image/gif":
      return ImageType.GIF;
    case "image/jpeg":
      return ImageType.JPEG;
    case "image/png":
      return ImageType.PNG;
    case "image/svg+xml":
      return ImageType.SVG;
    case "image/webp":
      return ImageType.WEBP;
    default:
      return ImageType.UNKNOWN;
  }
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

export async function updateStudyName(
  userId: string,
  studyId: string,
  name: string,
) {
  let session = await isAuthenticated();

  // A user cannot update another users study
  if (session.userId !== userId) {
    redirect("/error");
  }

  const updatedUser = await prisma.study.update({
    where: { id: studyId },
    data: {
      name: name,
    },
  });

  revalidatePath(`/heuristic/${studyId}`);
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

export async function getHeuristicEvaluation(id: string, userId: string) {
  let session = await isAuthenticated();

  // A user cannot access another user's data
  if (session.userId !== userId) {
    redirect("/error");
  }

  let heuristicEvaluation = await prisma.study.findUnique({
    where: {
      id: id,
    },
    include: {
      files: true,
      heuristicEvaluation: {
        include: {
          results: {
            include: {
              heuristic: true,
              recommendations: true,
            },
          },
        },
      },
    },
  });

  // If data does not exist there is a problem
  if (!heuristicEvaluation) {
    redirect("/error");
  }

  return heuristicEvaluation;
}

export async function getHeuristics(heuristicType: HeuristicType) {
  let heuristics = await prisma.heuristic.findMany({
    where: {
      type: heuristicType,
    },
  });

  return heuristics;
}

export async function getStudy(id: string, userId: string) {
  let session = await isAuthenticated();

  // A user cannot access another user's data
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

export async function setHeuristicEvaluation(
  userId: string,
  name: string,
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

  // Create a study
  let study = await prisma.study.create({
    data: {
      userId: userId,
      name: name,
      type: StudyType.HEURISTIC_EVALUATION,
      files: {
        create: files.map((file, index) => ({
          bucket: process.env.AWS_BUCKET || "",
          key: keys[index],
          size: file.size,
          fileType: convertToFileType(file.type),
          imageType: convertToImageType(file.type),
        })),
      },
    },
    include: {
      files: true,
    },
  });

  // Create a heuristic evaluation
  let heuristicEvaluation = await prisma.heuristicEvaluation.create({
    data: {
      studyId: study.id,
      goal: goal,
      type: convertToHeuristicType(heuristic),
      results: {
        create: results.map((result) => ({
          violated: result.violated.toUpperCase() as ViolatedType,
          reason: result.reason,
          source: SourceType.AI,
          heuristic: {
            connect: { id: result.id },
          },
          recommendations: {
            create: {
              recommendation: result.recommendation,
              source: SourceType.AI,
            },
          },
        })),
      },
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

  return study;
}
