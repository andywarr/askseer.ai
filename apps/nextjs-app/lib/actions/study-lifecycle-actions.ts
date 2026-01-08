"use server";

// ==========================================
// Imports
// ==========================================
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { StudyType } from "@prisma/client";
import { z } from "zod";

import { logger } from "@/apps/shared/logger";
import { STUDY_STATUS_PENDING } from "@/apps/shared/constants";
import {
  parseJobEnvelope,
  CognitiveWalkthroughPayloadV2,
  HeuristicEvaluationPayloadV2,
  PersonaPayloadV2,
  TaskV2Enum,
  JobEnvelopeV2,
  FileSchema,
} from "@/apps/shared/jobSchema";
import {
  TEAM_WITHOUT_COMPANY_MAX_STUDY_FILES,
  LONG_FLOW_WARNING_THRESHOLD,
} from "@/apps/nextjs-app/lib/constants";
import { getStudyUploadLimitForTeam } from "@/apps/nextjs-app/lib/study";
import {
  getStudy,
  updateAttempts,
  updateStatus,
  initStudyDb,
  finalizeStudyDb,
  listHeuristicFamilies,
  consumeTeamCreditByStudy,
  updateStudyTeam,
  getTeam,
  getCompanyByMyDomain,
  deleteStudySilent,
} from "@/apps/nextjs-app/lib/data";
import { canUserCreatePersonas } from "@/apps/nextjs-app/lib/user";
import {
  requireAuth,
  actionSuccess,
  actionError,
  ActionResult,
  generateRandomFileName,
} from "@/apps/nextjs-app/lib/actions/shared";
import { generatePresignedPutUrl } from "@/apps/nextjs-app/lib/actions/s3-actions";
import { sendLongFlowAlert } from "@/apps/nextjs-app/lib/actions/email-actions";

// ==========================================
// Constants
// ==========================================

// Presigned URL expiration time in seconds (5 minutes)
// Allows time for concurrent upload batching and retries
const PRESIGNED_URL_EXPIRY_SECONDS = 300;

// Study types
const cognitiveWalkthroughType = "cognitive_walkthrough";
const heuristicEvaluationType = "heuristic_evaluation";
const personaType = "persona";

const STUDY_CONFIG = {
  cognitive_walkthrough: {
    type: cognitiveWalkthroughType,
    logLabel: "Cognitive walkthrough",
  },
  heuristic_evaluation: {
    type: heuristicEvaluationType,
    logLabel: "Heuristic evaluation",
  },
  persona: {
    type: personaType,
    logLabel: "Persona",
  },
} as const;

/** Union type for all valid study kinds */
type StudyKind = keyof typeof STUDY_CONFIG;

// ==========================================
// Type Definitions
// ==========================================

type StudyFile = z.infer<typeof FileSchema>;

interface FinalizeStudyData {
  studyId: string;
  files: StudyFile[];
  jobData: JobEnvelopeV2;
}

// Internal payload types - overloads ensure type safety at call sites
interface CWPayloadWithFiles extends CognitiveWalkthroughPayloadV2 {
  files: StudyFile[];
}

interface HEPayloadWithFiles extends HeuristicEvaluationPayloadV2 {
  files: StudyFile[];
}

/** Common fields for building a JobEnvelopeV2 */
interface JobEnvelopeBase {
  studyId: string;
  userId: string;
  teamId?: string | null;
  companyId?: string | null;
  retry?: boolean;
}

// ==========================================
// Module-Level Instances
// ==========================================

// SQS client - created once at module level for reuse
const sqsClient = new SQSClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

// ==========================================
// Internal Helpers
// ==========================================

/**
 * Builds a JobEnvelopeV2 from base fields and payload.
 * Centralizes the job envelope construction logic used by both
 * finalizeAndQueueStudy and retryStudy.
 */
function buildJobEnvelope(
  base: JobEnvelopeBase,
  type: "cognitive_walkthrough",
  payload: CognitiveWalkthroughPayloadV2,
): JobEnvelopeV2;
function buildJobEnvelope(
  base: JobEnvelopeBase,
  type: "heuristic_evaluation",
  payload: HeuristicEvaluationPayloadV2,
): JobEnvelopeV2;
function buildJobEnvelope(
  base: JobEnvelopeBase,
  type: "persona",
  payload: PersonaPayloadV2,
): JobEnvelopeV2;
function buildJobEnvelope(
  base: JobEnvelopeBase,
  type: StudyKind,
  payload:
    | CognitiveWalkthroughPayloadV2
    | HeuristicEvaluationPayloadV2
    | PersonaPayloadV2,
): JobEnvelopeV2 {
  const envelope = {
    version: 2 as const,
    studyId: base.studyId,
    userId: base.userId,
    teamId: base.teamId ?? undefined,
    companyId: base.companyId ?? null,
    type,
    payload,
    ...(base.retry ? { retry: true } : {}),
  };
  return envelope as JobEnvelopeV2;
}

/** Result of buildStudyJobData - either success with jobData or an error */
type BuildJobDataResult =
  | { success: true; jobData: JobEnvelopeV2 }
  | { success: false; error: string };

/**
 * Builds the JobEnvelopeV2 for a study based on its kind.
 * Validates the payload structure and constructs the appropriate envelope.
 * Returns a result object to allow callers to handle errors gracefully.
 */
function buildStudyJobData(
  kind: StudyKind,
  jobBase: JobEnvelopeBase,
  payload: CWPayloadWithFiles | HEPayloadWithFiles | PersonaPayloadV2,
): BuildJobDataResult {
  if (kind === "persona") {
    const personaPayload = payload as PersonaPayloadV2;
    // Persona: validate and pass payload through
    if (
      !personaPayload ||
      typeof personaPayload !== "object" ||
      !personaPayload.persona ||
      typeof personaPayload.persona !== "object"
    ) {
      return { success: false, error: "Invalid persona payload" };
    }
    return {
      success: true,
      jobData: buildJobEnvelope(jobBase, "persona", personaPayload),
    };
  }

  if (kind === "heuristic_evaluation") {
    const hePayload = payload as HEPayloadWithFiles;
    const studyPayload: HeuristicEvaluationPayloadV2 = {
      name: hePayload.name,
      goal: hePayload.goal,
      user: hePayload.user,
      context: hePayload.context,
      files: hePayload.files,
      persona: hePayload.persona,
      heuristic: hePayload.heuristic,
    };
    return {
      success: true,
      jobData: buildJobEnvelope(jobBase, "heuristic_evaluation", studyPayload),
    };
  }

  if (kind === "cognitive_walkthrough") {
    const cwPayload = payload as CWPayloadWithFiles;
    const studyPayload: CognitiveWalkthroughPayloadV2 = {
      name: cwPayload.name,
      goal: cwPayload.goal,
      user: cwPayload.user,
      context: cwPayload.context,
      files: cwPayload.files,
      persona: cwPayload.persona,
    };
    return {
      success: true,
      jobData: buildJobEnvelope(jobBase, "cognitive_walkthrough", studyPayload),
    };
  }

  return { success: false, error: "Unhandled study kind" };
}

/**
 * Extracts the files to persist based on study kind.
 * - For persona: files live at payload.persona.files
 * - For heuristic_evaluation and cognitive_walkthrough: files live at payload.files
 */
function getFilesToPersist(
  kind: StudyKind,
  payload: CWPayloadWithFiles | HEPayloadWithFiles | PersonaPayloadV2,
): StudyFile[] {
  if (kind === "persona") {
    const personaPayload = payload as PersonaPayloadV2;
    return personaPayload.persona?.files ?? [];
  }
  const filePayload = payload as CWPayloadWithFiles | HEPayloadWithFiles;
  return filePayload.files ?? [];
}

async function getStudyUploadLimit(teamId: string | null | undefined) {
  if (!teamId) {
    return TEAM_WITHOUT_COMPANY_MAX_STUDY_FILES;
  }

  const team = await getTeam(teamId);
  return getStudyUploadLimitForTeam(team);
}

const addJobToQueue = async (jobData: object) => {
  try {
    const params = {
      QueueUrl: process.env.AWS_SQS_QUEUE_URL!,
      MessageBody: JSON.stringify(jobData),
    };

    const command = new SendMessageCommand(params);
    const response = await sqsClient.send(command);

    logger.debug("Successfully sent message to SQS", {
      messageId: response.MessageId,
      queueUrl: process.env.AWS_SQS_QUEUE_URL,
    });

    return actionSuccess({ messageId: response.MessageId });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error("Error sending message to SQS", {
      error: err.message,
      queueUrl: process.env.AWS_SQS_QUEUE_URL,
      stack: err.stack,
    });
    return actionError(err.message);
  }
};

/**
 * Internal helper to generate presigned PUT URLs for study file uploads.
 * Shared by getStudyUploadUrls and putPresignedUrls.
 */
async function generateUploadUrls(
  user: { id: string; selectedTeamId?: string | null },
  studyId: string,
  fileMetadata: Array<{ name: string; size?: number; type: string }>,
) {
  const maxFiles = await getStudyUploadLimit(user.selectedTeamId);
  if (fileMetadata.length > maxFiles) {
    logger.warn("Study upload file count exceeds limit", {
      userId: user.id,
      teamId: user.selectedTeamId,
      studyId,
      fileCount: fileMetadata.length,
      maxFiles,
    });
    throw new Error(`You can upload up to ${maxFiles} files for this team.`);
  }
  const urls = await Promise.all(
    fileMetadata.map(async (file) => {
      const fileName = generateRandomFileName(file.name);
      const key = `studies/${user.selectedTeamId}/${studyId}/uploads/${fileName}`;
      try {
        const uploadURL = await generatePresignedPutUrl(
          key,
          file.type,
          PRESIGNED_URL_EXPIRY_SECONDS,
        );
        return { fileName, fileType: file.type, uploadURL, key };
      } catch (error: unknown) {
        const err = error instanceof Error ? error : new Error(String(error));
        logger.error("Error generating presigned URL (study upload)", {
          userId: user.id,
          studyId,
          file: file.name,
          error: err.message,
        });
        throw err;
      }
    }),
  );
  return urls;
}

// ==========================================
// Exported Functions: Study Initialization
// ==========================================

/**
 * Initialize a new study record in the database.
 * @throws Error if user has no selected team or lacks persona creation permission
 * @returns The created study record with id
 */
export async function initStudy(name: string | null, type: string) {
  const user = await requireAuth();

  // Ensure user has a selected team
  if (!user.selectedTeamId) {
    logger.warn("User attempted to initialize study without a selected team", {
      userId: user.id,
    });
    throw new Error("Please select a team before creating a study");
  }

  // Check persona creation permission if creating a persona study
  if (type === "persona") {
    const hasPermission = await canUserCreatePersonas(user.id);

    if (!hasPermission) {
      logger.warn(
        "User attempted to initialize persona study without permission",
        {
          userId: user.id,
        },
      );
      throw new Error("You do not have permission to create personas");
    }
  }

  return await initStudyDb(name, type, user.id, user.selectedTeamId);
}

// ==========================================
// Exported Functions: Study Upload URLs
// ==========================================

/**
 * Generate presigned PUT URLs for uploading study files.
 * @throws Error if file count exceeds team limit or URL generation fails
 * @returns Array of presigned URL objects with fileName, fileType, uploadURL, and key
 */
export async function getStudyUploadUrls(
  studyId: string,
  fileMetadata: Array<{ name: string; size: number; type: string }>,
) {
  const user = await requireAuth();
  logger.debug("Generating presigned URLs for study upload", {
    userId: user.id,
    teamId: user.selectedTeamId,
    studyId,
    fileCount: fileMetadata.length,
  });

  return generateUploadUrls(user, studyId, fileMetadata);
}

/**
 * Generate presigned PUT URLs for file uploads with validation.
 * @throws Error if studyId is missing, fileMetadata is invalid, or URL generation fails
 * @returns Array of presigned URL objects with fileName, fileType, uploadURL, and key
 */
export async function putPresignedUrls(
  fileMetadata: Array<{ name: string; type: string; size: number }>,
  studyId: string,
) {
  const user = await requireAuth();

  // Additional validation for this endpoint
  if (!studyId) {
    logger.error("putPresignedUrls called without studyId (hard enforcement)", {
      userId: user.id,
    });
    throw new Error("studyId is required");
  }
  if (!Array.isArray(fileMetadata) || fileMetadata.length === 0) {
    logger.error("putPresignedUrls called with invalid file metadata", {
      userId: user.id,
      studyId,
    });
    throw new Error("fileMetadata must be a non-empty array");
  }
  if (fileMetadata.some((f) => !f.name || !f.type || !f.size)) {
    logger.error("putPresignedUrls called with incomplete file metadata", {
      userId: user.id,
      studyId,
      fileMetadata,
    });
    throw new Error("Each file must have name, type, and size");
  }

  logger.debug("Generating presigned URLs for file upload", {
    userId: user.id,
    fileCount: fileMetadata.length,
    studyId,
  });

  return generateUploadUrls(user, studyId, fileMetadata);
}

// ==========================================
// Exported Functions: Study Finalization
// ==========================================

/**
 * Finalize a study with uploaded files and job data.
 * @throws Error if studyId is invalid or database operation fails
 * @returns The finalized study data
 */
export async function finalizeStudy(studyId: string, data: FinalizeStudyData) {
  if (!studyId || typeof studyId !== "string" || studyId.trim() === "") {
    throw new Error("studyId is required");
  }
  // data expected: { studyId, files, jobData }
  return await finalizeStudyDb(studyId, data.files, data.jobData);
}

/**
 * Finalize a study, queue it for processing, and consume a team credit.
 * Validates team selection, credits, and study type before processing.
 * @returns ActionResult indicating success, or redirects to /studies on success
 */
// Overloads for stricter payloads per study kind
export async function finalizeAndQueueStudy(
  kind: "cognitive_walkthrough",
  studyId: string,
  payload: CognitiveWalkthroughPayloadV2 & {
    files: NonNullable<CognitiveWalkthroughPayloadV2["files"]>;
  },
): Promise<ActionResult | never>;
export async function finalizeAndQueueStudy(
  kind: "heuristic_evaluation",
  studyId: string,
  payload: HeuristicEvaluationPayloadV2 & {
    files: NonNullable<HeuristicEvaluationPayloadV2["files"]>;
  },
): Promise<ActionResult | never>;
export async function finalizeAndQueueStudy(
  kind: "persona",
  studyId: string,
  payload: PersonaPayloadV2,
): Promise<ActionResult | never>;
export async function finalizeAndQueueStudy(
  kind: StudyKind,
  studyId: string,
  payload: CWPayloadWithFiles | HEPayloadWithFiles | PersonaPayloadV2,
) {
  // Authentication - outside try/catch since it redirects on failure
  const user = await requireAuth();

  // Validate team selection
  if (!user.selectedTeamId) {
    logger.warn(`User has no selected team for ${kind} (finalize phase)`, {
      userId: user.id,
      studyId,
    });
    return actionError("Please select a team before running the study.");
  }

  // Validate team credits
  const team = await getTeam(user.selectedTeamId);
  if (!team || (team?.credits ?? 0) <= 0) {
    logger.warn(`Team lacks credits for ${kind} (finalize phase)`, {
      userId: user.id,
      teamId: user.selectedTeamId,
      studyId,
    });
    return actionError("Your team doesn't have enough credits.");
  }

  // Validate study type configuration
  const config = STUDY_CONFIG[kind];
  if (!config?.type) {
    logger.error("Unrecognized study type in finalizeAndQueueStudy", {
      userId: user.id,
      studyId,
      kind,
    });
    return actionError("Invalid study type");
  }

  const taskType = config.type;
  const allowedTypeCheck = TaskV2Enum.safeParse(taskType);
  if (!allowedTypeCheck.success) {
    logger.error("Study type not allowed by TaskV2Enum", {
      userId: user.id,
      studyId,
      kind,
      type: taskType,
    });
    return actionError("Invalid study type");
  }

  try {
    // Build payload based on study kind
    const jobBase: JobEnvelopeBase = {
      studyId,
      userId: user.id,
      teamId: user.selectedTeamId,
      companyId: team?.companyId || null,
    };

    const jobDataResult = buildStudyJobData(kind, jobBase, payload);
    if (!jobDataResult.success) {
      logger.error("Failed to build job data in finalizeAndQueueStudy", {
        userId: user.id,
        studyId,
        kind,
        error: jobDataResult.error,
      });
      return actionError("Invalid job data");
    }
    const { jobData } = jobDataResult;

    try {
      parseJobEnvelope(jobData);
    } catch (e) {
      logger.error("Invalid v2 jobData on finalize", {
        studyId,
        userId: user.id,
        kind,
        error: (e as Error)?.message,
      });
      return actionError("Invalid job data");
    }

    // Persist uploaded files according to study kind
    const filesToPersist = getFilesToPersist(kind, payload);

    try {
      await updateStudyTeam(studyId, user.selectedTeamId, user.id);
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error("Failed to update study team prior to finalize", {
        userId: user.id,
        studyId,
        teamId: user.selectedTeamId,
        error: err.message,
      });
      return actionError(err.message || "Failed to update study team");
    }

    await finalizeStudy(studyId, {
      studyId,
      files: filesToPersist,
      jobData,
    });

    const resp = await addJobToQueue(jobData);
    if (!resp.success) {
      logger.error(`Failed to enqueue ${kind} after finalize`, {
        userId: user.id,
        studyId,
        error: resp.error,
      });
      return actionError("Failed to enqueue job");
    }

    // Consume a credit from the team's balance for this study
    await consumeTeamCreditByStudy(studyId, user.id);
    logger.info(`${config.logLabel} finalized & queued`, {
      userId: user.id,
      studyId,
      messageId: resp.data?.messageId,
      heuristic:
        kind === "heuristic_evaluation"
          ? (payload as HEPayloadWithFiles).heuristic
          : undefined,
    });

    // Send email alert if the study has more screens than the warning threshold
    // This is for heuristic_evaluation and cognitive_walkthrough studies only
    if (
      (kind === "heuristic_evaluation" || kind === "cognitive_walkthrough") &&
      filesToPersist.length > LONG_FLOW_WARNING_THRESHOLD
    ) {
      // Fire-and-forget: don't block the user flow for email sending
      sendLongFlowAlert({
        userId: user.id,
        userEmail: user.email || "unknown",
        userName: user.name || null,
        teamId: user.selectedTeamId ?? null,
        teamName: team?.name || null,
        companyName: null, // Company name not readily available, companyId is in team
        studyId,
        studyName:
          (payload as CWPayloadWithFiles | HEPayloadWithFiles).name ||
          "Unnamed Study",
        studyType: kind,
        screenCount: filesToPersist.length,
      }).catch((err) => {
        // Silently log any errors - don't fail the study
        logger.error("Failed to send long flow alert (caught)", {
          studyId,
          error: err?.message,
        });
      });
    }
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error(`Error finalizing & queueing ${kind}`, {
      studyId,
      userId: user.id,
      error: err.message,
      stack: err.stack,
    });
    return actionError("Internal server error");
  }
  redirect("/studies");
}

// ==========================================
// Exported Functions: Study Retry
// ==========================================

/**
 * Retry a failed study by re-queuing its job.
 * @returns ActionResult indicating success or failure with error message
 */
export async function retryStudy(studyId: string) {
  if (!studyId || typeof studyId !== "string" || studyId.trim() === "") {
    logger.error("retryStudy called with invalid studyId", { studyId });
    return actionError("studyId is required");
  }

  let user;
  try {
    user = await requireAuth();

    logger.debug("Starting study retry", {
      userId: user.id,
      studyId,
    });

    // Get the study (type is only used for logging, pass UNKNOWN since we don't know yet)
    const study = await getStudy(studyId, user.id, StudyType.UNKNOWN);

    let jobData: JobEnvelopeV2;
    const stored = study.jobData || {};

    try {
      parseJobEnvelope(stored);
    } catch (e) {
      logger.error("Invalid v2 jobData on retry", {
        studyId,
        userId: user.id,
        error: (e as Error)?.message,
      });
      throw new Error("Invalid v2 jobData on retry");
    }

    // Get companyId from team if not already in stored jobData
    const companyId =
      stored?.companyId || (await getTeam(study.teamId!))?.companyId || null;

    const task = (study.type || "").toLowerCase() as StudyKind;
    const basePayload = stored?.payload || { files: study.files || [] };
    const jobBase: JobEnvelopeBase = {
      studyId: study.id,
      userId: user.id,
      teamId: study.teamId,
      companyId,
      retry: true,
    };

    if (task === "heuristic_evaluation") {
      const hePayload: HeuristicEvaluationPayloadV2 = {
        ...basePayload,
        heuristic:
          (basePayload as HeuristicEvaluationPayloadV2)?.heuristic || "",
      };
      jobData = buildJobEnvelope(jobBase, task, hePayload);
    } else if (task === "persona") {
      jobData = buildJobEnvelope(
        jobBase,
        task,
        basePayload as PersonaPayloadV2,
      );
    } else {
      jobData = buildJobEnvelope(
        jobBase,
        "cognitive_walkthrough",
        basePayload as CognitiveWalkthroughPayloadV2,
      );
    }

    // Add the job to the queue
    const response = await addJobToQueue(jobData);

    if (!response.success) {
      logger.error("Failed to add retry job to queue", {
        userId: user.id,
        studyId,
        error: response.error,
      });
    }

    logger.info("Study retry job added to queue", {
      userId: user.id,
      studyId,
      studyType: study.type,
      messageId: response.success ? response.data?.messageId : undefined,
      success: response.success,
    });

    // TODO: This should be one call to the database worker
    await updateAttempts(studyId);
    await updateStatus(studyId, STUDY_STATUS_PENDING);

    revalidatePath("/studies");
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error("Error retrying study", {
      userId: user?.id,
      studyId,
      error: err.message,
      stack: err.stack,
    });
    return actionError("Failed to retry study. Please try again.");
  }

  // Do not redirect; let caller handle UI refresh/state.
  return actionSuccess();
}

// ==========================================
// Exported Functions: Study Cleanup
// ==========================================

/**
 * Clean up an orphaned study that was created but never finalized.
 * This is used in form error handlers to delete studies when file upload fails.
 */
export async function cleanupOrphanedStudy(studyId: string) {
  if (!studyId || typeof studyId !== "string" || studyId.trim() === "") {
    logger.error("cleanupOrphanedStudy called with invalid studyId", {
      studyId,
    });
    return;
  }

  let user;
  try {
    user = await requireAuth();
  } catch {
    // If auth fails during cleanup, log and exit silently - we don't want to throw
    // during error handling
    logger.error("cleanupOrphanedStudy called without authenticated user");
    return;
  }

  logger.info("Cleaning up orphaned study", {
    studyId,
    userId: user.id,
  });

  const success = await deleteStudySilent(studyId, user.id);

  if (success) {
    logger.info("Successfully cleaned up orphaned study", {
      studyId,
      userId: user.id,
    });
  }
  // deleteStudySilent handles its own error logging, so we don't need additional error handling here
}

// ==========================================
// Exported Functions: Heuristic Families
// ==========================================

/**
 * List heuristic families visible to the current user's company.
 * @throws Error if authentication fails or data fetch fails
 * @returns Array of heuristic family records
 */
export async function listMyHeuristicFamilies() {
  await requireAuth();

  // Get the user's company via their email domain (same approach as library page)
  const domainInfo = await getCompanyByMyDomain();
  const companyId = domainInfo?.company?.id || null;

  // Fetch heuristic families visible to this company (includes global and company-specific)
  return await listHeuristicFamilies(companyId);
}
