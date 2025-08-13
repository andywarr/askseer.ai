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

type LegacyJobData = {
  data: {
    name: string;
    goal: string;
    user: string | null;
    files: { name: string; key: string; size: number; type: string }[];
    heuristic: string | null;
    context: string | null;
    type: string;
    userId: string;
  };
  studyId: string;
  task: string;
};

type V2JobData = {
  version: 2;
  studyId: string;
  userId: string;
  task: string;
  payload: {
    name?: string;
    goal?: string;
    user?: string | null;
    context?: string | null;
    files?: { name: string; key: string; size: number; type: string }[];
    heuristic?: string | null;
  };
};

type AnyJobData = LegacyJobData | V2JobData;

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
  studyData: AnyJobData;
  results: ResultData[];
}

interface CognitiveWalkthroughData {
  studyData: AnyJobData;
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

function isV2(job: AnyJobData): job is V2JobData {
  return (job as any)?.version === 2 && !!(job as any)?.payload;
}

function getCore(job: AnyJobData) {
  if (isV2(job)) {
    return {
      studyId: job.studyId,
      userId: job.userId,
      task: job.task,
      name: job.payload.name || null,
      goal: job.payload.goal || null,
      user: job.payload.user ?? null,
      context: job.payload.context ?? null,
      files: job.payload.files || [],
      heuristic: job.payload.heuristic || null,
    };
  }
  const j = job as LegacyJobData;
  return {
    studyId: j.studyId,
    userId: j.data.userId,
    task: j.task || j.data.type,
    name: j.data.name,
    goal: j.data.goal,
    user: j.data.user,
    context: j.data.context,
    files: j.data.files,
    heuristic: j.data.heuristic,
  };
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
  const core = getCore(studyData);

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
  const core = getCore(studyData);

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
            throw new Error(
              `Must include a heuristic type: ${core.heuristic}`
            );
          }
          const heuristicType = convertToHeuristicType(core.heuristic);
          if (!heuristicType) {
            throw new Error(
              `Invalid heuristic type: ${core.heuristic}`
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

export async function dbPostStudy(jobData: AnyJobData) {
  try {
    const core = getCore(jobData);
    let study = await prisma.study.create({
      data: {
        userId: core.userId,
        name: core.name || undefined,
        type: (() => {
          const studyType = convertToStudyType(core.task);
          if (!studyType) {
            throw new Error(`Invalid study type: ${core.task}`);
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
        jobData: jobData,
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
      // best-effort userId extraction
      userId: (jobData as any)?.data?.userId || (jobData as any)?.userId,
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
  jobData: AnyJobData;
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
  jobData: data.jobData,
      },
      include: { files: true },
    });
    logger.info("Successfully finalized study (files attached)", {
      studyId: updated.id,
      fileCount: updated.files.length,
    });
    return updated;
  } catch (error) {
    logger.error("Failed to finalize study", { studyId: data.studyId, error });
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
