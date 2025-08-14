/*
 * Migration Script: Normalize Study.jobData to v2 JobEnvelope
 *
 * What it does
 *  - Scans studies and builds a v2 envelope from DB fields (Study, HeuristicEvaluation, CognitiveWalkthrough)
 *  - Validates with shared zod schema
 *  - Writes back to Study.jobData if missing/invalid or when FORCE=true
 *
 * Safety
 *  - DRY_RUN=true by default (logs actions, makes no writes)
 *  - FORCE=false by default (skips rows where jobData already validates)
 *
 * Usage (from apps/db-worker/)
 *   DRY_RUN=true  npm run script:jobdata
 *   DRY_RUN=false npm run script:jobdata
 *   DRY_RUN=false FORCE=true npm run script:jobdata
 */
import * as dotenv from "dotenv";
dotenv.config();

import prisma from "../src/services/db";
import { JobEnvelopeV2Schema } from "@/apps/shared/jobSchema";
import type { z } from "zod";

type JobEnvelopeV2 = z.infer<typeof JobEnvelopeV2Schema>;

const DRY_RUN = (process.env.DRY_RUN ?? "true").toLowerCase() !== "false"; // default true
const FORCE = (process.env.FORCE ?? "false").toLowerCase() === "true"; // default false
const LIMIT = Number(process.env.LIMIT ?? 0) || undefined; // optional cap

function studyTypeToEnvelopeType(t?: string | null): "heuristic_evaluation" | "cognitive_walkthrough" | null {
  switch ((t || "").toUpperCase()) {
    case "HEURISTIC_EVALUATION":
      return "heuristic_evaluation";
    case "COGNITIVE_WALKTHROUGH":
      return "cognitive_walkthrough";
    default:
      return null;
  }
}

function tryExtractHeuristicFromUnknown(raw: unknown): "NIELSEN" | "TENETS" | null {
  if (!raw || typeof raw !== "object") return null;
  try {
    const anyObj: any = raw;
    const candidate = (anyObj?.payload?.heuristic || anyObj?.heuristic || anyObj?.payload?.type || anyObj?.type || "").toString().toUpperCase();
    if (candidate === "NIELSEN" || candidate === "TENETS") return candidate;
  } catch {}
  return null;
}

async function main() {
  console.log(`[JOBDATA] Starting migration: DRY_RUN=${DRY_RUN} FORCE=${FORCE} LIMIT=${LIMIT ?? "none"}`);

  const studies = await prisma.study.findMany({
    take: LIMIT,
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      userId: true,
      name: true,
      type: true,
      jobData: true,
      heuristicEvaluation: {
        select: { goal: true, user: true, context: true, type: true },
      },
      cognitiveWalkthrough: {
        select: { goal: true, user: true, context: true },
      },
    },
  });

  console.log(`[JOBDATA] Loaded studies: ${studies.length}`);

  let processed = 0;
  let updated = 0;
  let skippedValid = 0;
  let skippedUnknown = 0;
  let failed = 0;

  for (const s of studies) {
    processed++;

    const envType = studyTypeToEnvelopeType(s.type);
    if (!envType) {
      skippedUnknown++;
      console.log(`[JOBDATA][SKIP][UNKNOWN_TYPE] studyId=${s.id} type=${s.type}`);
      continue;
    }

    // If existing jobData already validates and not forcing, skip
    const existing = s.jobData as unknown;
    const parsed = JobEnvelopeV2Schema.safeParse(existing);
    if (parsed.success && !FORCE) {
      skippedValid++;
      continue;
    }

    // Build payload fields from related rows (falling back to null/undefined)
    const goal = s.heuristicEvaluation?.goal ?? s.cognitiveWalkthrough?.goal ?? undefined;
    const user = (s.heuristicEvaluation?.user ?? s.cognitiveWalkthrough?.user) ?? null;
    const context = s.heuristicEvaluation?.context ?? s.cognitiveWalkthrough?.context ?? null;

    // Construct envelope skeleton
    const base: Partial<JobEnvelopeV2> = {
      version: 2 as const,
      studyId: s.id,
      userId: s.userId,
      type: envType,
      payload: {
        name: s.name ?? undefined,
        goal: goal,
        user: user ?? undefined, // schema allows nullable + optional
        context: context ?? undefined, // schema allows nullable + optional
        // files omitted; optional in schema and we cannot reliably reconstruct name/type
      } as any,
    };

    // Heuristic type is required for heuristic_evaluation
    if (envType === "heuristic_evaluation") {
      let heuristic: any = s.heuristicEvaluation?.type || tryExtractHeuristicFromUnknown(existing);
      heuristic = typeof heuristic === "string" ? heuristic.toUpperCase() : heuristic;
      if (heuristic !== "NIELSEN" && heuristic !== "TENETS") {
        // As a last resort, set a default to pass validation; safer choice could be TENETS/NIELSEN depending on product default
        heuristic = "NIELSEN";
        console.warn(`[JOBDATA][WARN] Missing heuristic for studyId=${s.id}; defaulting to ${heuristic}`);
      }
      (base.payload as any).heuristic = heuristic;
    }

    // Validate the composed envelope
    const check = JobEnvelopeV2Schema.safeParse(base);
    if (!check.success) {
      failed++;
      console.error(`[JOBDATA][INVALID_COMPOSED] studyId=${s.id} issues=${check.error.issues.map(i => i.path.join(".")).join(",")}`);
      continue;
    }

    if (DRY_RUN) {
      updated++;
      console.log(`[JOBDATA][DRY_RUN][WOULD_UPDATE] studyId=${s.id} type=${envType}`);
      continue;
    }

    try {
      await prisma.study.update({
        where: { id: s.id },
        data: { jobData: check.data },
      });
      updated++;
      console.log(`[JOBDATA][UPDATED] studyId=${s.id}`);
    } catch (e) {
      failed++;
      console.error(`[JOBDATA][ERROR_UPDATE] studyId=${s.id}`, e);
    }
  }

  console.log(`[JOBDATA] Done: processed=${processed} updated=${updated} skippedValid=${skippedValid} skippedUnknownType=${skippedUnknown} failed=${failed}`);
}

main()
  .catch((e) => {
    console.error("[JOBDATA][FATAL]", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
