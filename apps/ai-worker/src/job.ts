// Shared job envelope and helpers for AI worker

export interface NormalizedJob {
  version: number; // 2 for new, 1 for legacy-derived
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
  if (raw && raw.version === 2 && raw.studyId && raw.userId && raw.task) {
    return {
      version: 2,
      studyId: raw.studyId,
      userId: raw.userId,
      task: String(raw.task).toLowerCase(),
      payload: raw.payload || {},
      retry: !!raw.retry,
    };
  }
  const d = raw?.data || {};
  return {
    version: 1,
    studyId: raw?.studyId,
    userId: d?.userId,
    task: String(raw?.task || d?.type || "").toLowerCase(),
    payload: {
      name: d?.name,
      goal: d?.goal,
      user: d?.user ?? null,
      context: d?.context ?? null,
      files: Array.isArray(d?.files) ? d.files : [],
      heuristic: d?.heuristic ?? null,
    },
    retry: !!raw?.retry,
  };
}

export function toLegacyJob(job: NormalizedJob) {
  return {
    data: {
      name: job.payload.name,
      goal: job.payload.goal,
      user: job.payload.user ?? null,
      files: Array.isArray(job.payload.files) ? job.payload.files : [],
      context: job.payload.context ?? null,
      heuristic: job.payload.heuristic ?? null,
      type: job.task,
      userId: job.userId,
    },
    studyId: job.studyId,
    task: job.task,
    retry: job.retry,
  } as const;
}
