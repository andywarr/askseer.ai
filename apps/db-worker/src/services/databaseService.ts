// Prisma imports
import prisma from "@/apps/db-worker/src/services/db.ts";
import { logger } from "@/apps/db-worker/src/logger.ts";
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
    user: string | null;
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
  fileId: string;
  step: number;
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
  try {
    await prisma.study.delete({
      where: {
        id: studyId,
        userId: userId,
      },
    });
    logger.info("Successfully deleted study", { studyId, userId });
  } catch (error) {
    logger.error("Failed to delete study", { studyId, userId, error });
    throw error;
  }
}

export async function dbGetCWQuestion(version: number) {
  try {
    let questions = await prisma.cWQuestion.findMany({
      where: {
        version: version,
      },
      orderBy: {
        questionNumber: "asc",
      },
    });

    logger.debug("Successfully fetched CW questions", {
      version,
      questionCount: questions.length,
    });
    return questions;
  } catch (error) {
    logger.error("Failed to fetch CW questions", { version, error });
    throw error;
  }
}

export async function dbGetFiles(studyId: string) {
  try {
    let files = await prisma.file.findMany({
      where: {
        studyId: studyId,
      },
    });

    logger.debug("Successfully fetched files", {
      studyId,
      fileCount: files.length,
    });
    return files;
  } catch (error) {
    logger.error("Failed to fetch files", { studyId, error });
    throw error;
  }
}

export async function dbGetHeuristics(type: string) {
  try {
    const heuristicType = convertToHeuristicType(type);

    if (!heuristicType) {
      logger.error("Invalid heuristic type provided", { type });
      throw new Error(`Invalid heuristic type: ${type}`);
    }

    let heuristics = await prisma.heuristic.findMany({
      where: {
        type: heuristicType,
      },
    });

    logger.debug("Successfully fetched heuristics", {
      type,
      heuristicCount: heuristics.length,
    });
    return heuristics;
  } catch (error) {
    logger.error("Failed to fetch heuristics", { type, error });
    throw error;
  }
}

export async function dbGetStudy(studyId: string, userId: string) {
  try {
    let study = await prisma.study.findUnique({
      where: {
        id: studyId,
        userId: userId,
      },
      include: {
        files: true,
      },
    });
    logger.debug("Successfully fetched study", {
      studyId,
      userId,
      found: !!study,
    });
    return study;
  } catch (error) {
    logger.error("Failed to fetch study", { studyId, userId, error });
    throw error;
  }
}

export async function dbGetStudies(userId: string) {
  try {
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

    logger.debug("Successfully fetched studies", {
      userId,
      studyCount: studies.length,
    });
    return studies;
  } catch (error) {
    logger.error("Failed to fetch studies", { userId, error });
    throw error;
  }
}

export async function dbGetUser(userId: string) {
  try {
    let user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
    });

    logger.debug("Successfully fetched user", {
      userId,
      found: !!user,
    });
    return user;
  } catch (error) {
    logger.error("Failed to fetch user", { userId, error });
    throw error;
  }
}

export async function dbPostCognitiveWalkthrough(
  data: CognitiveWalkthroughData
) {
  const { studyData, results } = data;

  try {
    // Create a cognitive walkthrough
    await prisma.cognitiveWalkthrough.create({
      data: {
        studyId: studyData.studyId,
        goal: studyData.data.goal,
        user: studyData.data.user,
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
    await dbUpdateStudyStatus(studyData.studyId, StudyStatus.COMPLETED);

    logger.info("Successfully added cognitive walkthrough to database", {
      studyId: studyData.studyId,
    });
  } catch (error) {
    logger.error("Failed to add cognitive walkthrough to database", {
      studyId: studyData.studyId,
      error,
    });
    throw error;
  }
}

export async function dbPostHeuristicEvaluation(data: HeuristicEvaluationData) {
  const { studyData, results } = data;

  try {
    // Create a heuristic evaluation
    await prisma.heuristicEvaluation.create({
      data: {
        studyId: studyData.studyId,
        goal: studyData.data.goal,
        user: studyData.data.user,
        context: studyData.data.context,
        type: (() => {
          if (!studyData.data.heuristic) {
            throw new Error(
              `Must include a heuristic type: ${studyData.data.heuristic}`
            );
          }
          const heuristicType = convertToHeuristicType(
            studyData.data.heuristic
          );
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
            step: result.step,
            file: {
              connect: { id: result.fileId },
            },
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
    await dbUpdateStudyStatus(studyData.studyId, StudyStatus.COMPLETED);

    logger.info("Successfully added heuristic evaluation to database", {
      studyId: studyData.studyId,
    });
  } catch (error) {
    logger.error("Failed to add heuristic evaluation to database", {
      studyId: studyData.studyId,
      error,
    });
    throw error;
  }
}

export async function dbPostStudy(jobData: any) {
  try {
    let study = await prisma.study.create({
      data: {
        userId: jobData.data.userId,
        name: jobData.data.name,
        type: (() => {
          const studyType = convertToStudyType(jobData.data.type);
          if (!studyType) {
            throw new Error(`Invalid study type: ${jobData.data.type}`);
          }
          return studyType;
        })(),
        files: {
          create: jobData.data.files.map((file: any) => ({
            bucket: process.env.AWS_BUCKET || "",
            key: file.key,
            size: file.size,
            fileType: convertToFileType(file.type),
            imageType: convertToImageType(file.type),
          })),
        },
        jobData: jobData,
      },
      include: {
        files: true,
      },
    });
    logger.info("Successfully created study", {
      userId: jobData.data.userId,
      studyId: study.id,
    });
    return study;
  } catch (error) {
    logger.error("Failed to create study", {
      userId: jobData.data.userId,
      error,
    });
    throw error;
  }
}

export async function dbPostUpdateCredits(data: CreditUpdateData) {
  try {
    const updatedUser = await prisma.user.update({
      where: { id: data.userId },
      data: {
        credits: {
          increment: data.delta,
        },
      },
    });

    logger.info("Successfully updated user credits", {
      userId: data.userId,
      delta: data.delta,
      newCredits: updatedUser.credits,
    });
    return updatedUser;
  } catch (error) {
    logger.error("Failed to update user credits", {
      userId: data.userId,
      delta: data.delta,
      error,
    });
    throw error;
  }
}

export async function dbUpdateStudyAttempts(studyId: string) {
  try {
    await prisma.study.update({
      where: { id: studyId },
      data: {
        attempts: { increment: 1 },
      },
    });

    logger.debug("Successfully updated study attempts", { studyId });
  } catch (error) {
    logger.error("Failed to update study attempts", { studyId, error });
    throw error;
  }
}

export async function dbUpdateStudyStatus(
  studyId: string,
  status: StudyStatus
) {
  try {
    await prisma.study.update({
      where: { id: studyId },
      data: { status: status },
    });

    logger.debug("Successfully updated study status", { studyId, status });
  } catch (error) {
    logger.error("Failed to update study status", { studyId, status, error });
    throw error;
  }
}

export async function dbUpdateCWIssue(id: string, issue: string) {
  try {
    const result = await prisma.cWIssue.update({
      where: {
        id: id,
      },
      data: {
        issue: issue,
        source: SourceType.AI_HUMAN,
      },
    });

    logger.debug("Successfully updated CW issue", { id });
    return result;
  } catch (error) {
    logger.error("Failed to update CW issue", { id, error });
    throw error;
  }
}

export async function dbUpdateCWRecommendation(
  id: string,
  recommendation: string
) {
  try {
    // Fetch the current recommendation to check its source
    const current = await prisma.cWRecommendation.findUnique({
      where: { id },
      select: { source: true },
    });
    let newSource: SourceType = SourceType.AI_HUMAN;
    if (current?.source === SourceType.HUMAN) {
      newSource = SourceType.HUMAN;
    }
    const result = await prisma.cWRecommendation.update({
      where: {
        id: id,
      },
      data: {
        recommendation: recommendation,
        source: newSource,
      },
    });

    logger.debug("Successfully updated CW recommendation", { id });
    return result;
  } catch (error) {
    logger.error("Failed to update CW recommendation", { id, error });
    throw error;
  }
}

export async function dbUpdateHEResult(id: string, reason: string) {
  try {
    const result = await prisma.hEResult.update({
      where: {
        id: id,
      },
      data: {
        reason: reason,
        source: SourceType.AI_HUMAN,
      },
    });

    logger.debug("Successfully updated HE result", { id });
    return result;
  } catch (error) {
    logger.error("Failed to update HE result", { id, error });
    throw error;
  }
}

export async function dbUpdateHERecommendation(
  id: string,
  recommendation: string
) {
  try {
    // Fetch the current recommendation to check its source
    const current = await prisma.hERecommendation.findUnique({
      where: { id },
      select: { source: true },
    });
    let newSource: SourceType = SourceType.AI_HUMAN;
    if (current?.source === SourceType.HUMAN) {
      newSource = SourceType.HUMAN;
    }
    const result = await prisma.hERecommendation.update({
      where: {
        id: id,
      },
      data: {
        recommendation: recommendation,
        source: newSource,
      },
    });

    logger.debug("Successfully updated HE recommendation", { id });
    return result;
  } catch (error) {
    logger.error("Failed to update HE recommendation", { id, error });
    throw error;
  }
}

export async function dbDeleteCWIssue(id: string) {
  // Delete a cognitive walkthrough issue and its recommendations
  try {
    const result = await prisma.cWIssue.delete({
      where: {
        id: id,
      },
      include: {
        recommendations: true,
      },
    });

    logger.debug("Successfully deleted CW issue", {
      id,
      recommendationCount: result.recommendations.length,
    });
    return result;
  } catch (error) {
    logger.error("Failed to delete CW issue", { id, error });
    throw error;
  }
}

export async function dbDeleteCWRecommendation(id: string) {
  try {
    const result = await prisma.cWRecommendation.delete({
      where: {
        id: id,
      },
    });

    logger.debug("Successfully deleted CW recommendation", { id });
    return result;
  } catch (error) {
    logger.error("Failed to delete CW recommendation", { id, error });
    throw error;
  }
}

export async function dbDeleteHEResult(id: string) {
  try {
    const result = await prisma.hEResult.delete({
      where: {
        id: id,
      },
      include: {
        recommendations: true,
      },
    });

    logger.debug("Successfully deleted HE result", {
      id,
      recommendationCount: result.recommendations.length,
    });
    return result;
  } catch (error) {
    logger.error("Failed to delete HE result", { id, error });
    throw error;
  }
}

export async function dbDeleteHERecommendation(id: string) {
  try {
    const result = await prisma.hERecommendation.delete({
      where: {
        id: id,
      },
    });

    logger.debug("Successfully deleted HE recommendation", { id });
    return result;
  } catch (error) {
    logger.error("Failed to delete HE recommendation", { id, error });
    throw error;
  }
}

export async function dbCreateCWRecommendation(
  issueId: string,
  recommendation: string,
  source: SourceType
) {
  try {
    const result = await prisma.cWRecommendation.create({
      data: {
        issueId,
        recommendation,
        source,
      },
    });

    logger.debug("Successfully created CW recommendation", {
      issueId,
      recommendationId: result.id,
    });
    return result;
  } catch (error) {
    logger.error("Failed to create CW recommendation", { issueId, error });
    throw error;
  }
}

export async function dbCreateHERecommendation(
  resultId: string,
  recommendation: string,
  source: SourceType
) {
  try {
    const result = await prisma.hERecommendation.create({
      data: {
        resultId,
        recommendation,
        source,
      },
    });

    logger.debug("Successfully created HE recommendation", {
      resultId,
      recommendationId: result.id,
    });
    return result;
  } catch (error) {
    logger.error("Failed to create HE recommendation", { resultId, error });
    throw error;
  }
}

export async function dbCreateHEResult({
  heuristicEvaluationId,
  heuristicId,
  step,
  fileId,
  reason,
  source,
}: {
  heuristicEvaluationId: string;
  heuristicId: string;
  step: number;
  fileId: string;
  reason: string;
  source: string;
}) {
  try {
    const result = await prisma.hEResult.create({
      data: {
        heuristicEvaluation: { connect: { id: heuristicEvaluationId } },
        heuristic: { connect: { id: heuristicId } },
        step,
        file: { connect: { id: fileId } },
        reason,
        violated: "YES",
        source: source === "HUMAN" ? SourceType.HUMAN : SourceType.AI_HUMAN,
      },
    });

    logger.debug("Successfully created HE result", {
      heuristicEvaluationId,
      resultId: result.id,
    });
    return result;
  } catch (error) {
    logger.error("Failed to create HE result", {
      heuristicEvaluationId,
      error,
    });
    throw error;
  }
}

export async function dbCreateCWIssue({
  stepId,
  issueType,
  issue,
  source,
}: {
  stepId: string;
  issueType: string;
  issue: string;
  source: string;
}) {
  try {
    const result = await prisma.cWIssue.create({
      data: {
        step: { connect: { id: stepId } },
        issueType: issueType as CWIssueType,
        issue,
        source: source === "HUMAN" ? SourceType.HUMAN : SourceType.AI_HUMAN,
      },
      include: {
        recommendations: true,
      },
    });

    logger.debug("Successfully created CW issue", {
      stepId,
      issueId: result.id,
    });
    return result;
  } catch (error) {
    logger.error("Failed to create CW issue", { stepId, error });
    throw error;
  }
}
