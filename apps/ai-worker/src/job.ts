// V2-only job envelope: use shared discriminated union schema/types
import {
  JobEnvelopeV2Schema,
  type JobEnvelopeV2,
} from "../../shared/jobSchema.ts";

export type NormalizedJob = JobEnvelopeV2;

export function normalizeIncomingJob(raw: unknown): NormalizedJob {
  const parsed = JobEnvelopeV2Schema.safeParse(raw as unknown);
  if (!parsed.success) {
    throw new Error(
      `Invalid v2 job envelope: ${parsed.error.issues
        .map((i: { path: (string | number | symbol)[] }) => i.path.join("."))
        .join(", ")}`
    );
  }
  return parsed.data;
}
