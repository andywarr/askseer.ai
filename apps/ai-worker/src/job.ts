// V2-only job envelope for the AI worker

export interface NormalizedJob {
  version: 2;
  studyId: string;
  userId: string;
  task: string; // e.g., "heuristic_evaluation" | "cognitive_walkthrough"
  payload: {
    name?: string;
    goal?: string;
    user?: string | null;
    context?: string | null;
    files?: { name: string; key: string; size: number; type: string }[];
    heuristic?: string | null;
  };
  retry?: boolean;
}

export function normalizeIncomingJob(raw: any): NormalizedJob {
  if (!raw || raw.version !== 2) {
    throw new Error("Unsupported job format: expected v2 envelope");
  }
  if (!raw.studyId || !raw.userId || !raw.task) {
    throw new Error("Invalid v2 job: missing studyId, userId, or task");
  }
  return {
    version: 2,
    studyId: raw.studyId,
    userId: raw.userId,
    task: String(raw.task).toLowerCase(),
    payload: raw.payload || {},
    retry: !!raw.retry,
  };
}
