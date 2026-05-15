"use server";

import { requireAuth } from "@/apps/nextjs-app/lib/actions/shared";
import { canAccessStudy } from "@/apps/nextjs-app/lib/db/data";
import { logger } from "@/apps/shared/logger";

/**
 * Returns the benchmark context (prior issues/results) for a source study,
 * to be injected into the AI job payload for a benchmark run.
 */
export async function getBenchmarkContext(sourceStudyId: string) {
  const user = await requireAuth();

  const hasAccess = await canAccessStudy(sourceStudyId, user.id);
  if (!hasAccess) {
    throw new Error("You do not have access to this study");
  }

  try {
    const [heRes, cwRes] = await Promise.allSettled([
      fetch(
        `${process.env.DB_WORKER_URL}/api/heuristic-evaluation?studyId=${sourceStudyId}&userId=${user.id}`,
        { cache: "no-store" },
      ),
      fetch(
        `${process.env.DB_WORKER_URL}/api/walkthrough?studyId=${sourceStudyId}&userId=${user.id}`,
        { cache: "no-store" },
      ),
    ]);

    // Try HE first
    if (heRes.status === "fulfilled" && heRes.value.ok) {
      const { data: study } = await heRes.value.json();
      if (study?.heuristicEvaluation?.results?.length) {
        const results = study.heuristicEvaluation.results
          .filter((r: any) => r.violated)
          .map((r: any) => ({
            heuristic: r.heuristic?.id ?? r.heuristicId,
            violated: r.violated,
            reason: r.reason,
            severity: r.severity ?? null,
            recommendations: (r.recommendations ?? []).map(
              (rec: any) => rec.recommendation,
            ),
          }));
        return { sourceStudyId, results, issues: [] };
      }
    }

    // Try CW
    if (cwRes.status === "fulfilled" && cwRes.value.ok) {
      const { data: study } = await cwRes.value.json();
      if (study?.cognitiveWalkthrough?.steps?.length) {
        const issues = study.cognitiveWalkthrough.steps.flatMap((step: any) =>
          (step.issues ?? []).map((issue: any) => ({
            issue: issue.issue,
            issueType: issue.issueType,
            severity: issue.severity ?? null,
            recommendations: (issue.recommendations ?? []).map(
              (rec: any) => rec.recommendation,
            ),
          })),
        );
        return { sourceStudyId, results: [], issues };
      }
    }

    return { sourceStudyId, results: [], issues: [] };
  } catch (error) {
    logger.error("Failed to get benchmark context", { sourceStudyId, error });
    return { sourceStudyId, results: [], issues: [] };
  }
}

/**
 * Returns all benchmark studies for a given studyId (the study and its benchmarks).
 */
export async function getStudyBenchmarksAction(studyId: string) {
  const user = await requireAuth();

  try {
    const response = await fetch(
      `${process.env.DB_WORKER_URL}/api/study/benchmarks?studyId=${studyId}&userId=${user.id}`,
      { cache: "no-store" },
    );

    if (!response.ok) {
      logger.error("Failed to get study benchmarks", {
        studyId,
        status: response.status,
      });
      return [];
    }

    const { data } = await response.json();
    return data || [];
  } catch (error) {
    logger.error("Error fetching study benchmarks", { studyId, error });
    return [];
  }
}
