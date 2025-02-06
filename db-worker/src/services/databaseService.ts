import prisma from "./db.ts";

import {
  FileType,
  HeuristicType,
  ImageType,
  SourceType,
  StudyType,
  ViolatedType,
} from "@prisma/client";

interface JobData {
  data: {
    name: string;
    goal: string;
    files: {
      name: string;
      key: string;
      size: number;
      type: string;
    }[];
    heuristic: string | null;
    context: string | null;
    type: string;
    userId: string;
  };
  studyId: string;
  task: string;
}

interface ResultData {
  id: string;
  heuristic: string;
  type: string;
  violated: string;
  reason: string;
  recommendation: string;
}

interface HeuristicEvaluationData {
  studyData: JobData;
  results: ResultData[];
}

function convertToFileType(type: string): FileType {
  switch (type.split("/")[0].toLowerCase()) {
    case "image":
      return FileType.IMAGE;
    default:
      return FileType.UNKNOWN;
  }
}

function convertToHeuristicType(heuristic: string): HeuristicType | null {
  switch (heuristic.toUpperCase()) {
    case "NIELSEN":
      return HeuristicType.NIELSEN;
    case "TENETS":
      return HeuristicType.TENETS;
    default:
      return null;
  }
}

function convertToImageType(type: string): ImageType {
  switch (type.split("/")[1].toLowerCase()) {
    case "apng":
      return ImageType.APNG;
    case "avif":
      return ImageType.AVIF;
    case "gif":
      return ImageType.GIF;
    case "jpeg":
      return ImageType.JPEG;
    case "png":
      return ImageType.PNG;
    case "svg+xml":
      return ImageType.SVG;
    case "webp":
      return ImageType.WEBP;
    default:
      return ImageType.UNKNOWN;
  }
}

function convertToStudyType(type: string): StudyType | null {
  switch (type.toUpperCase()) {
    case "COGNITIVE_WALKTHROUGH":
      return StudyType.COGNITIVE_WALKTHROUGH;
    case "HEURISTIC_EVALUATION":
      return StudyType.COGNITIVE_WALKTHROUGH;
    default:
      return null;
  }
}

export async function dbDeleteStudy(studyId: string, userId: string) {
  // Delete a study for a user
  await prisma.study.delete({
    where: {
      id: studyId,
      userId: userId,
    },
  });
}

export async function dbGetHeuristics(type: string) {
  // Get heuristics
  const heuristicType = convertToHeuristicType(type);

  if (!heuristicType) {
    throw new Error(`Invalid heuristic type: ${type}`);
  }

  let heuristics = await prisma.heuristic.findMany({
    where: {
      type: heuristicType,
    },
  });

  return heuristics;
}

export async function dbGetStudy(studyId: string, userId: string) {
  // Get all studies for a user
  let studies = await prisma.study.findUnique({
    where: {
      id: studyId,
      userId: userId,
    },
    include: {
      files: true,
    },
  });

  return studies;
}

export async function dbGetStudies(userId: string) {
  // Get all studies for a user
  let studies = await prisma.study.findMany({
    where: { userId: userId },
    orderBy: [
      {
        createdAt: "desc",
      },
    ],
    include: {
      files: true,
    },
  });

  return studies;
}

export async function dbGetUser(userId: string) {
  // Get a user
  let user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
  });

  return user;
}

export async function dbPostHeuristicEvaluation(data: HeuristicEvaluationData) {
  console.log("Adding heuristic evaluation results to the database", data);

  const { studyData, results } = data;

  // Create a heuristic evaluation
  let heuristicEvaluation = await prisma.heuristicEvaluation.create({
    data: {
      studyId: studyData.studyId,
      goal: studyData.data.goal,
      context: studyData.data.context,
      type: (() => {
        if (!studyData.data.heuristic) {
          throw new Error(
            `Must include a heuristic type: ${studyData.data.heuristic}`
          );
        }
        const heuristicType = convertToHeuristicType(studyData.data.heuristic);
        if (!heuristicType) {
          throw new Error(
            `Invalid heuristic type: ${studyData.data.heuristic}`
          );
        }
        return heuristicType;
      })(),
      results: {
        create: results.map((result) => ({
          violated: result.violated.toUpperCase() as ViolatedType,
          reason: result.reason,
          source: SourceType.AI,
          heuristic: {
            connect: { id: result.id },
          },
          recommendations: result.recommendation
            ? {
                create: {
                  recommendation: result.recommendation,
                  source: SourceType.AI,
                },
              }
            : undefined,
        })),
      },
    },
  });
}

export async function dbPostStudy(data: any) {
  // Create a study
  let study = await prisma.study.create({
    data: {
      userId: data.userId,
      name: data.name,
      type: (() => {
        const studyType = convertToStudyType(data.type);
        if (!studyType) {
          throw new Error(`Invalid study type: ${data.type}`);
        }
        return studyType;
      })(),
      files: {
        create: data.files.map((file: any) => ({
          bucket: process.env.AWS_BUCKET || "",
          key: file.key,
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

  return study;
}
