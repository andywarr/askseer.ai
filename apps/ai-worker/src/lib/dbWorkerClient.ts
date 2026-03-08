/**
 * Centralized HTTP client for db-worker API
 * Provides typed methods for all endpoints with consistent error handling
 */

import { config } from "../config.ts";
import { logger } from "@/apps/shared/logger.ts";
import { dbWorkerBreaker } from "./circuitBreaker.ts";
import type { File, Heuristic, CWQuestion } from "../types.ts";
import type {
  JobEnvelopeV2_HE,
  JobEnvelopeV2_CW,
  JobEnvelopeV2_AN,
  JobEnvelopeV2_LS,
} from "@/apps/shared/jobSchema.ts";
import type { HEResultData, CWStepData } from "../types.ts";
import type { QualitativeAnalysisResult } from "../jobs/qualitativeAnalysis.ts";

// ============================================================================
// Base HTTP Client
// ============================================================================

const baseUrl = config.dbWorker.url;

interface ApiResponse<T> {
  data: T;
  error?: string;
}

async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  // Wrap all db-worker calls with circuit breaker for fail-fast behavior
  return dbWorkerBreaker.execute(async () => {
    const url = endpoint.startsWith("http")
      ? endpoint
      : `${baseUrl}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      logger.error("DB Worker API request failed", {
        endpoint,
        status: response.status,
        statusText: response.statusText,
        body: errorBody.slice(0, 500),
      });
      throw new Error(
        `DB Worker API error: ${response.status} ${response.statusText}`,
      );
    }

    return response.json();
  });
}

// ============================================================================
// Study Endpoints
// ============================================================================

/**
 * Get a study by ID for a specific user
 */
export async function getStudy(
  studyId: string,
  userId: string,
): Promise<Record<string, unknown>> {
  logger.debug("Fetching study data", { studyId, userId });

  const { data } = await fetchApi<ApiResponse<Record<string, unknown>>>(
    `/api/study?studyId=${studyId}&userId=${userId}`,
  );

  if (!data) {
    logger.error("Study not found", { studyId, userId });
    throw new Error("Study not found");
  }

  logger.debug("Study data retrieved successfully", {
    studyId,
    userId,
    studyName: (data as { name?: string }).name,
  });

  return data;
}

/**
 * Update study status
 */
export async function updateStatus(
  studyId: string,
  status: string,
): Promise<void> {
  logger.debug("Updating study status", { studyId, status });

  await fetchApi("/api/study/status", {
    method: "POST",
    body: JSON.stringify({ studyId, status }),
  });

  logger.info("Study status updated successfully", {
    studyId,
    newStatus: status,
  });
}

// ============================================================================
// File Endpoints
// ============================================================================

/**
 * Get files for a study
 */
export async function getFiles(studyId: string): Promise<File[]> {
  logger.debug("Fetching files for study", { studyId });

  const { data } = await fetchApi<ApiResponse<File[]>>(
    `/api/files?studyId=${studyId}`,
  );

  logger.debug("Files retrieved successfully", {
    studyId,
    fileCount: data?.length || 0,
  });

  return data || [];
}

/**
 * Save extracted transcript text to a file record.
 * Used to cache Whisper transcriptions and PDF-extracted text so they
 * don't need to be re-processed on retries or re-runs.
 */
export async function updateFileTranscript(
  fileId: string,
  transcript: string,
): Promise<void> {
  logger.debug("Saving file transcript", {
    fileId,
    transcriptLength: transcript.length,
  });

  await fetchApi("/api/files/transcript", {
    method: "PATCH",
    body: JSON.stringify({ fileId, transcript }),
  });

  logger.debug("File transcript saved successfully", { fileId });
}

/**
 * Save extracted participant identifier to a file record.
 * Used by the AI worker to store the participant identifier
 * (e.g., "P1", "Participant A") extracted from the transcript.
 */
export async function updateFileIdentifier(
  fileId: string,
  identifier: string,
): Promise<void> {
  logger.debug("Saving file identifier", { fileId, identifier });

  await fetchApi("/api/files/identifier", {
    method: "PATCH",
    body: JSON.stringify({ fileId, identifier }),
  });

  logger.debug("File identifier saved successfully", { fileId });
}

// ============================================================================
// Credit Endpoints
// ============================================================================

/**
 * Update team balance
 * @param userId - User ID for attribution
 * @param credits - Positive for refund, negative for consume (legacy param name)
 * @param studyId - Optional study ID for team-based balance adjustment
 */
export async function updateCredits(
  userId: string,
  credits: number,
  studyId?: string,
): Promise<void> {
  // Backward compat path: adjust user credits if no studyId provided
  if (!studyId) {
    logger.debug("Updating user credits", { userId, credits });
    await fetchApi("/api/updateCredits", {
      method: "POST",
      body: JSON.stringify({ userId, delta: credits }),
    });
    logger.info("User credits updated successfully", { userId, credits });
    return;
  }

  // Preferred path: adjust team balance by study
  logger.debug("Adjusting team balance by study", { studyId, userId, credits });
  const endpoint = credits >= 0 ? "refund" : "consume";

  await fetchApi(`/api/team/balance/${endpoint}`, {
    method: "POST",
    body: JSON.stringify({ studyId, byUserId: userId }),
  });

  logger.info("Adjusted team balance by study", { studyId, userId, credits });
}

// ============================================================================
// Heuristic Evaluation Endpoints
// ============================================================================

/**
 * Get heuristics by family ID
 */
export async function getHeuristics(
  familyId: string,
  companyId?: string | null,
): Promise<Heuristic[]> {
  logger.debug("Fetching heuristics", { familyId, companyId });

  const url = new URL(`${baseUrl}/api/heuristic-evaluation/heuristics`);
  url.searchParams.append("familyId", familyId);
  if (companyId) {
    url.searchParams.append("companyId", companyId);
  }

  const { data } = await fetchApi<ApiResponse<Heuristic[]>>(url.toString());

  logger.debug("Heuristics retrieved successfully", {
    familyId,
    companyId,
    heuristicCount: data?.length || 0,
  });

  return data || [];
}

/**
 * Save heuristic evaluation results to database
 */
export async function addHeuristicEvaluation(
  jobData: JobEnvelopeV2_HE,
  results: HEResultData[],
): Promise<void> {
  const payload = JSON.stringify({
    studyData: jobData,
    results,
  });
  const payloadSizeKB = (
    new TextEncoder().encode(payload).length / 1024
  ).toFixed(2);

  logger.info("Saving heuristic evaluation to database", {
    studyId: jobData.studyId,
    responseCount: results.length,
    payloadSizeKB,
  });

  await fetchApi("/api/heuristic-evaluation", {
    method: "POST",
    body: payload,
  });

  logger.info("Heuristic evaluation saved to database successfully", {
    studyId: jobData.studyId,
  });
}

// ============================================================================
// Cognitive Walkthrough Endpoints
// ============================================================================

/**
 * Get cognitive walkthrough questions
 */
export async function getCWQuestions(version: number): Promise<CWQuestion[]> {
  logger.debug("Fetching cognitive walkthrough questions", { version });

  const { data } = await fetchApi<ApiResponse<CWQuestion[]>>(
    `/api/cognitive-walkthrough/questions?version=${version}`,
  );

  logger.debug("Cognitive walkthrough questions retrieved successfully", {
    version,
    questionCount: data?.length || 0,
  });

  return data || [];
}

/**
 * Save cognitive walkthrough results to database
 */
export async function addCognitiveWalkthrough(
  jobData: JobEnvelopeV2_CW,
  results: CWStepData[],
): Promise<void> {
  logger.info("Saving cognitive walkthrough to database", {
    studyId: jobData.studyId,
    responseCount: results.length,
  });

  await fetchApi("/api/cognitive-walkthrough", {
    method: "POST",
    body: JSON.stringify({ studyData: jobData, results }),
  });

  logger.info("Cognitive walkthrough saved to database successfully", {
    studyId: jobData.studyId,
  });
}

// ============================================================================
// Persona Endpoints
// ============================================================================

interface PersonaPayload {
  name: string;
  description?: string;
  photoKey?: string;
  coverKey?: string;
  payload: Record<string, unknown>;
}

// ============================================================================
// Qualitative Analysis Endpoints
// ============================================================================

/**
 * Save qualitative analysis results to database
 */
export async function addQualitativeAnalysis(
  jobData: JobEnvelopeV2_AN | JobEnvelopeV2_LS,
  result: QualitativeAnalysisResult,
): Promise<void> {
  const payload = JSON.stringify({ studyData: jobData, result });
  const payloadSizeKB = (
    new TextEncoder().encode(payload).length / 1024
  ).toFixed(2);

  logger.info("Saving qualitative analysis to database", {
    studyId: jobData.studyId,
    insightCount: result.insights.length,
    payloadSizeKB,
  });

  await fetchApi("/api/qualitative-analysis", {
    method: "POST",
    body: payload,
  });

  logger.info("Qualitative analysis saved to database successfully", {
    studyId: jobData.studyId,
  });
}

// ============================================================================
// Persona Endpoints
// ============================================================================

/**
 * Save persona to database
 */
export async function addPersona(
  studyData: Record<string, unknown>,
  persona: PersonaPayload,
): Promise<void> {
  logger.info("Saving persona to database", {
    studyId: (studyData as { studyId?: string }).studyId,
  });

  await fetchApi("/api/persona", {
    method: "POST",
    body: JSON.stringify({ studyData, persona }),
  });

  logger.info("Persona saved to database successfully", {
    studyId: (studyData as { studyId?: string }).studyId,
  });
}

// ============================================================================
// Live Session Endpoints
// ============================================================================

/**
 * Save transcript text and S3 key to a LiveSession record.
 * Also sets the session status to COMPLETED.
 */
export async function saveLiveSessionTranscript(
  liveSessionId: string,
  transcriptKey: string,
  transcriptText: string,
): Promise<void> {
  logger.debug("Saving live session transcript", {
    liveSessionId,
    transcriptLength: transcriptText.length,
  });

  await fetchApi("/api/study/live-session/transcript", {
    method: "POST",
    body: JSON.stringify({ liveSessionId, transcriptKey, transcriptText }),
  });

  logger.info("Live session transcript saved successfully", {
    liveSessionId,
  });
}

/**
 * Update the status of a LiveSession record.
 */
export async function updateLiveSessionStatus(
  liveSessionId: string,
  status: "SCHEDULED" | "LIVE" | "ENDED" | "PROCESSING" | "COMPLETED",
): Promise<void> {
  logger.debug("Updating live session status", { liveSessionId, status });

  await fetchApi("/api/study/live-session/status", {
    method: "PATCH",
    body: JSON.stringify({ liveSessionId, status }),
  });

  logger.info("Live session status updated successfully", {
    liveSessionId,
    newStatus: status,
  });
}
