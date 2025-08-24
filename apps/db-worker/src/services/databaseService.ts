// Prisma imports
import prisma from "@/apps/db-worker/src/services/db.ts";
import { logger } from "@/apps/db-worker/src/logger.ts";
import type { Prisma } from "@prisma/client";
import type {
  JobEnvelopeV2,
  JobEnvelopeV2_HE,
  JobEnvelopeV2_CW,
  JobEnvelopeV2_PE,
} from "@/apps/shared/jobSchema.ts";
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

type V2JobData = JobEnvelopeV2;

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
  studyData: JobEnvelopeV2_HE;
  results: ResultData[];
}

interface CognitiveWalkthroughData {
  studyData: JobEnvelopeV2_CW;
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

function guessImageTypeFromKey(key: string): ImageType {
  const lower = key.toLowerCase();
  if (lower.endsWith(".png")) return ImageType.PNG;
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return ImageType.JPEG;
  if (lower.endsWith(".gif")) return ImageType.GIF;
  if (lower.endsWith(".webp")) return ImageType.WEBP;
  if (lower.endsWith(".avif")) return ImageType.AVIF;
  if (lower.endsWith(".apng")) return ImageType.APNG;
  if (lower.endsWith(".svg")) return ImageType.SVG;
  return ImageType.UNKNOWN;
}

function convertToStudyType(type: string): StudyType | null {
  switch (type.toUpperCase()) {
    case "COGNITIVE_WALKTHROUGH":
      return StudyType.COGNITIVE_WALKTHROUGH;
    case "HEURISTIC_EVALUATION":
      return StudyType.HEURISTIC_EVALUATION;
    case "PERSONA":
      return StudyType.PERSONA;
    case "UNKNOWN":
      return StudyType.UNKNOWN;
    default:
      return null;
  }
}

// V2-only: use the envelope directly

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

    logger.info("Successfully fetched CW questions", {
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

    logger.info("Successfully fetched files", {
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

    logger.info("Successfully fetched heuristics", {
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
    logger.info("Successfully fetched study", {
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

    logger.info("Successfully fetched studies", {
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

    logger.info("Successfully fetched user", {
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
  const core = {
    studyId: studyData.studyId,
    goal: studyData.payload.goal || "",
    user: studyData.payload.user ?? null,
    context: studyData.payload.context ?? null,
  };

  try {
    // Create a cognitive walkthrough
    await prisma.cognitiveWalkthrough.create({
      data: {
        studyId: core.studyId,
        goal: core.goal || "",
        user: core.user,
        context: core.context,
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
    await dbUpdateStudyStatus(core.studyId, StudyStatus.COMPLETED);

    logger.info("Successfully added cognitive walkthrough to database", {
      studyId: core.studyId,
    });
  } catch (error) {
    logger.error("Failed to add cognitive walkthrough to database", {
      studyId: core.studyId,
      error,
    });
    throw error;
  }
}

export async function dbPostHeuristicEvaluation(data: HeuristicEvaluationData) {
  const { studyData, results } = data;
  const core = {
    studyId: studyData.studyId,
    goal: studyData.payload.goal || "",
    user: studyData.payload.user ?? null,
    context: studyData.payload.context ?? null,
    heuristic: studyData.payload.heuristic || null,
  };

  try {
    // Create a heuristic evaluation
    await prisma.heuristicEvaluation.create({
      data: {
        studyId: core.studyId,
        goal: core.goal || "",
        user: core.user,
        context: core.context,
        type: (() => {
          if (!core.heuristic) {
            throw new Error(`Must include a heuristic type: ${core.heuristic}`);
          }
          const heuristicType = convertToHeuristicType(core.heuristic);
          if (!heuristicType) {
            throw new Error(`Invalid heuristic type: ${core.heuristic}`);
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
    await dbUpdateStudyStatus(core.studyId, StudyStatus.COMPLETED);

    logger.info("Successfully added heuristic evaluation to database", {
      studyId: core.studyId,
    });
  } catch (error) {
    logger.error("Failed to add heuristic evaluation to database", {
      studyId: core.studyId,
      error,
    });
    throw error;
  }
}

export async function dbPostStudy(jobData: V2JobData) {
  try {
    const core = {
      userId: jobData.userId,
      name:
        jobData.type === "persona"
          ? ((jobData.payload as any)?.persona?.name ?? null)
          : ((jobData.payload as any)?.name ?? null),
      type: jobData.type,
      files:
        jobData.type === "persona"
          ? ((jobData.payload as any)?.persona?.files ?? [])
          : ((jobData.payload as any)?.files ?? []),
    };
    let study = await prisma.study.create({
      data: {
        userId: core.userId,
        name: core.name || undefined,
        type: (() => {
          const studyType = convertToStudyType(core.type);
          if (!studyType) {
            throw new Error(`Invalid study type: ${core.type}`);
          }
          return studyType;
        })(),
        files: {
          create: core.files.map((file: any) => ({
            bucket: process.env.AWS_BUCKET || "",
            key: file.key,
            size: file.size,
            fileType: convertToFileType(file.type),
            imageType: convertToImageType(file.type),
          })),
        },
        jobData: jobData as unknown as Prisma.InputJsonValue,
      },
      include: {
        files: true,
      },
    });
    logger.info("Successfully created study", {
      userId: core.userId,
      studyId: study.id,
    });
    return study;
  } catch (error) {
    logger.error("Failed to create study", {
      userId: jobData.userId,
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

    logger.info("Successfully updated study attempts", { studyId });
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

    logger.info("Successfully updated study status", { studyId, status });
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

    logger.info("Successfully updated CW issue", { id });
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

    logger.info("Successfully updated CW recommendation", { id });
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

    logger.info("Successfully updated HE result", { id });
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

    logger.info("Successfully updated HE recommendation", { id });
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

    logger.info("Successfully deleted CW issue", {
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

    logger.info("Successfully deleted CW recommendation", { id });
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

    logger.info("Successfully deleted HE result", {
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

    logger.info("Successfully deleted HE recommendation", { id });
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

    logger.info("Successfully created CW recommendation", {
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

    logger.info("Successfully created HE recommendation", {
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

    logger.info("Successfully created HE result", {
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

    logger.info("Successfully created CW issue", {
      stepId,
      issueId: result.id,
    });
    return result;
  } catch (error) {
    logger.error("Failed to create CW issue", { stepId, error });
    throw error;
  }
}

export async function dbGetCognitiveWalkthrough(
  studyId: string,
  userId: string
) {
  try {
    let cognitiveWalkthrough = await prisma.study.findUnique({
      where: {
        id: studyId,
        userId: userId,
      },
      include: {
        files: true,
        cognitiveWalkthrough: {
          include: {
            steps: {
              include: {
                issues: {
                  include: {
                    recommendations: true,
                  },
                },
                results: {
                  include: {
                    question: true,
                  },
                  orderBy: {
                    question: {
                      questionNumber: "asc", // Order by questionNumber in the CWQuestion model
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
    logger.info("Successfully fetched cognitive walkthrough", {
      studyId,
      userId,
      found: !!cognitiveWalkthrough,
    });
    return cognitiveWalkthrough;
  } catch (error) {
    logger.error("Failed to fetch cognitive walkthrough", {
      studyId,
      userId,
      error,
    });
    throw error;
  }
}

export async function dbGetHeuristicEvaluation(
  studyId: string,
  userId: string
) {
  try {
    let heuristicEvaluation = await prisma.study.findUnique({
      where: {
        id: studyId,
        userId: userId,
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
              orderBy: [
                { step: "asc" },
                {
                  heuristic: {
                    heuristic: "asc", // Order alphabetically (ascending)
                  },
                },
                { createdAt: "asc" },
              ],
            },
          },
        },
      },
    });
    logger.info("Successfully fetched heuristic evaluation", {
      studyId,
      userId,
      found: !!heuristicEvaluation,
    });
    return heuristicEvaluation;
  } catch (error) {
    logger.error("Failed to fetch heuristic evaluation", {
      studyId,
      userId,
      error,
    });
    throw error;
  }
}

export async function dbGetPersona(studyId: string, userId: string) {
  try {
    const personaStudy = await prisma.study.findUnique({
      where: {
        id: studyId,
        userId: userId,
      },
      include: {
        files: true,
        persona: {
          include: {
            photoFile: true,
            coverFile: true,
          },
        },
      },
    });
    logger.info("Successfully fetched persona", {
      studyId,
      userId,
      found: !!personaStudy,
    });
    return personaStudy;
  } catch (error) {
    logger.error("Failed to fetch persona", { studyId, userId, error });
    throw error;
  }
}

export async function dbListPersonas(userId: string) {
  try {
    const studies = await prisma.study.findMany({
      where: { userId, type: StudyType.PERSONA },
      orderBy: { createdAt: "desc" },
      include: {
        files: true,
        persona: {
          include: {
            photoFile: true,
            coverFile: true,
          },
        },
      },
    });
    logger.info("Successfully listed personas", {
      userId,
      count: studies.length,
    });
    return studies;
  } catch (error) {
    logger.error("Failed to list personas", { userId, error });
    throw error;
  }
}

export async function dbUpdateStudyName(studyId: string, name: string) {
  try {
    const updatedStudy = await prisma.study.update({
      where: { id: studyId },
      data: {
        name: name,
      },
    });
    logger.info("Successfully updated study name", {
      studyId,
      name,
    });
    return updatedStudy;
  } catch (error) {
    logger.error("Failed to update study name", { studyId, name, error });
    throw error;
  }
}

export async function dbUpdateUserName(userId: string, name: string) {
  try {
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { name },
    });

    logger.info("Successfully updated user name", { userId, name });
    return updatedUser;
  } catch (error) {
    logger.error("Failed to update user name", { userId, name, error });
    throw error;
  }
}

export async function dbUpdateUserImage(
  userId: string,
  imageKey: string | null
) {
  try {
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        imageKey: imageKey || null,
        imageUpdatedAt: new Date(),
      },
    });
    logger.info("Successfully updated user image", { userId, imageKey });
    return updatedUser;
  } catch (error) {
    logger.error("Failed to update user image", { userId, imageKey, error });
    throw error;
  }
}

export async function dbInitStudy(data: {
  userId: string;
  name: string;
  type: string;
}) {
  try {
    const study = await prisma.study.create({
      data: {
        userId: data.userId,
        name: data.name,
        type: (() => {
          const studyType = convertToStudyType(data.type);
          if (!studyType) throw new Error(`Invalid study type: ${data.type}`);
          return studyType;
        })(),
        jobData: { init: true },
      },
    });
    logger.info("Successfully initialized study (no files)", {
      studyId: study.id,
      userId: data.userId,
    });
    return study;
  } catch (error) {
    logger.error("Failed to initialize study", { userId: data.userId, error });
    throw error;
  }
}

export async function dbFinalizeStudy(data: {
  studyId: string;
  files: Array<{ name: string; key: string; size: number; type: string }>;
  jobData: V2JobData;
}) {
  try {
    const existing = await prisma.study.findUnique({
      where: { id: data.studyId },
      select: { id: true, jobData: true },
    });
    if (!existing) throw new Error("Study not found");

    const updated = await prisma.study.update({
      where: { id: data.studyId },
      data: {
        files: {
          create: data.files.map((f) => ({
            bucket: process.env.AWS_BUCKET || "",
            key: f.key,
            size: f.size,
            fileType: convertToFileType(f.type),
            imageType: convertToImageType(f.type),
          })),
        },
        jobData: data.jobData as unknown as Prisma.InputJsonValue,
      },
      include: { files: true },
    });
    logger.info("Successfully finalized study (files attached)", {
      studyId: updated.id,
      fileCount: (updated as any).files?.length ?? 0,
    });
    return updated;
  } catch (error) {
    logger.error("Failed to finalize study", { studyId: data.studyId, error });
    throw error;
  }
}

export async function dbPostPersona(data: {
  studyData: JobEnvelopeV2_PE;
  persona: {
    name?: string | null;
    description?: string | null;
    photoKey?: string | null;
    coverKey?: string | null;
    payload?: any; // arbitrary structured persona data
  };
}) {
  const { studyData, persona } = data;
  const studyId = studyData.studyId;

  try {
    let photoFileId: string | undefined;
    let coverFileId: string | undefined;

    // Optionally find or create File records for generated images within this study
    if (persona.photoKey) {
      const existing = await prisma.file.findFirst({
        where: { studyId, key: persona.photoKey },
        select: { id: true },
      });
      if (existing) {
        photoFileId = existing.id;
      } else {
        const file = await prisma.file.create({
          data: {
            studyId,
            bucket: process.env.AWS_BUCKET || "",
            key: persona.photoKey,
            size: null,
            fileType: FileType.IMAGE,
            imageType: guessImageTypeFromKey(persona.photoKey),
          },
        });
        photoFileId = file.id;
      }
    }
    if (persona.coverKey) {
      const existing = await prisma.file.findFirst({
        where: { studyId, key: persona.coverKey },
        select: { id: true },
      });
      if (existing) {
        coverFileId = existing.id;
      } else {
        const file = await prisma.file.create({
          data: {
            studyId,
            bucket: process.env.AWS_BUCKET || "",
            key: persona.coverKey,
            size: null,
            fileType: FileType.IMAGE,
            imageType: guessImageTypeFromKey(persona.coverKey),
          },
        });
        coverFileId = file.id;
      }
    }

    // Upsert Persona record by studyId
    await prisma.persona.upsert({
      where: { studyId },
      create: {
        studyId,
        name: (persona.name || undefined) as string | undefined,
        description: (persona.description || undefined) as string | undefined,
        photoFileId,
        coverFileId,
        data: (persona.payload ?? null) as unknown as Prisma.InputJsonValue,
      },
      update: {
        name: (persona.name || undefined) as string | undefined,
        description: (persona.description || undefined) as string | undefined,
        photoFileId,
        coverFileId,
        data: (persona.payload ?? null) as unknown as Prisma.InputJsonValue,
      },
    });

    // Mark study completed
    await dbUpdateStudyStatus(studyId, StudyStatus.COMPLETED);

    logger.info("Successfully added persona to database", { studyId });
  } catch (error) {
    logger.error("Failed to add persona to database", { studyId, error });
    throw error;
  }
}

export async function dbGetCommunicationPreferences(userId: string) {
  try {
    const prefs = await prisma.communicationPreferences.findUnique({
      where: { userId },
      select: {
        digest: true,
        productUpdates: true,
        promotions: true,
        educational: true,
        feedback: true,
        security: true,
        billing: true,
        policy: true,
        updatedAt: true,
      },
    });
    logger.info("Successfully fetched communication preferences", {
      userId,
      found: !!prefs,
    });
    return prefs;
  } catch (error) {
    logger.error("Failed to fetch communication preferences", {
      userId,
      error,
    });
    throw error;
  }
}

const OPTIONAL_COMM_PREF_KEYS_INTERNAL = [
  "digest",
  "productUpdates",
  "promotions",
  "educational",
  "feedback",
] as const;

type OptionalCommPrefKeyInternal =
  (typeof OPTIONAL_COMM_PREF_KEYS_INTERNAL)[number];

export async function dbUpdateCommunicationPreferences(
  userId: string,
  updates: Partial<Record<OptionalCommPrefKeyInternal, boolean>>
) {
  try {
    const data: Record<string, boolean> = {};
    for (const key of Object.keys(updates)) {
      if (
        OPTIONAL_COMM_PREF_KEYS_INTERNAL.includes(
          key as OptionalCommPrefKeyInternal
        ) &&
        typeof updates[key as OptionalCommPrefKeyInternal] === "boolean"
      ) {
        data[key] = updates[key as OptionalCommPrefKeyInternal] as boolean;
      }
    }
    if (!Object.keys(data).length) {
      throw new Error("No valid communication preference fields provided");
    }
    const prefs = await prisma.communicationPreferences.upsert({
      where: { userId },
      update: data,
      create: { userId, ...data },
      select: {
        digest: true,
        productUpdates: true,
        promotions: true,
        educational: true,
        feedback: true,
        security: true,
        billing: true,
        policy: true,
        updatedAt: true,
      },
    });
    logger.info("Successfully updated communication preferences", {
      userId,
      keys: Object.keys(data),
    });
    return prefs;
  } catch (error) {
    logger.error("Failed to update communication preferences", {
      userId,
      error,
    });
    throw error;
  }
}
