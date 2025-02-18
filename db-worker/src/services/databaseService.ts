import prisma from "./db.ts";

import {
  CWIssueType,
  FileType,
  HeuristicType,
  ImageType,
  SourceType,
  StudyStatus,
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

interface HERecommendation {
  recommendation: string;
}

interface ResultData {
  id: string;
  heuristic: string;
  type: string;
  violated: string;
  reason: string;
  recommendations: HERecommendation[];
}

interface HeuristicEvaluationData {
  studyData: JobData;
  results: ResultData[];
}

interface CognitiveWalkthroughData {
  studyData: JobData;
  results: CWStepData[];
}

interface CWResultData {
  questionId: string;
  answer: string;
}

interface CWIssueData {
  issueType: string;
  issue: string;
  recommendations: Array<CWRecommendationData>;
}

interface CWRecommendationData {
  recommendation: string;
}

interface CWStepData {
  step: number;
  expected: boolean;
  results: Array<CWResultData>;
  issues: Array<CWIssueData>;
}

interface CreditUpdateData {
  userId: string;
  delta: number;
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
      return StudyType.HEURISTIC_EVALUATION;
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

export async function dbGetCWQuestion(version: number) {
  // Get all cognitive walkthrough questions for a version
  let questions = await prisma.cWQuestion.findMany({
    where: {
      version: version,
    },
    orderBy: {
      questionNumber: "asc",
    },
  });

  return questions;
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

export async function dbPostCognitiveWalkthrough(
  data: CognitiveWalkthroughData
) {
  console.log("Adding cognitive walkthrough results to the database", data);

  const { studyData, results } = data;

  // Create a cognitive walkthrough
  let cognitiveWalkthrough = await prisma.cognitiveWalkthrough.create({
    data: {
      studyId: studyData.studyId,
      goal: studyData.data.goal,
      context: studyData.data.context,
      steps: {
        create: results.map((step, index) => ({
          step: index + 1,
          expected: step.expected,
          results: {
            create: step.results.map((result) => ({
              question: {
                connect: { id: result.questionId },
              },
              answer: result.answer,
              source: SourceType.AI,
            })),
          },
          issues: {
            create: step.issues.map((issue) => ({
              issueType: issue.issueType as CWIssueType,
              issue: issue.issue,
              source: SourceType.AI,
              recommendations: {
                create: issue.recommendations.map((recommendation) => ({
                  recommendation: recommendation.recommendation,
                  source: SourceType.AI,
                })),
              },
            })),
          },
        })),
      },
    },
  });

  // Update the study status to completed
  dbUpdateStudyStatus(studyData.studyId, StudyStatus.COMPLETED);
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
          recommendations:
            result.violated.toUpperCase() === "YES"
              ? {
                  create: result.recommendations.map((recommendation) => ({
                    recommendation: recommendation.recommendation,
                    source: SourceType.AI,
                  })),
                }
              : undefined,
        })),
      },
    },
  });

  // Update the study status to completed
  dbUpdateStudyStatus(studyData.studyId, StudyStatus.COMPLETED);
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

export async function dbPostUpdateCredits(data: CreditUpdateData) {
  const updatedUser = await prisma.user.update({
    where: { id: data.userId },
    data: {
      credits: {
        increment: data.delta,
      },
    },
  });

  return updatedUser;
}

export async function dbUpdateStudyStatus(
  studyId: string,
  status: StudyStatus
) {
  await prisma.study.update({
    where: { id: studyId },
    data: { status: status },
  });
}
