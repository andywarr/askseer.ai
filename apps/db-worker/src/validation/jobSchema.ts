import { z } from "zod";

export const JobFileSchema = z.object({
  name: z.string(),
  key: z.string(),
  size: z.number(),
  type: z.string(),
});

export const JobPayloadV2Schema = z.object({
  name: z.string().optional(),
  goal: z.string().optional(),
  user: z.string().nullable().optional(),
  context: z.string().nullable().optional(),
  files: z.array(JobFileSchema).optional(),
  heuristic: z.string().nullable().optional(),
});

export const JobEnvelopeV2Schema = z.object({
  version: z.literal(2),
  studyId: z.string(),
  userId: z.string(),
  task: z.string(),
  payload: JobPayloadV2Schema,
  retry: z.boolean().optional(),
});

// Export TS types inferred from the schemas for consistent usage
export type JobFileV2 = z.infer<typeof JobFileSchema>;
export type JobPayloadV2 = z.infer<typeof JobPayloadV2Schema>;
export type JobEnvelopeV2 = z.infer<typeof JobEnvelopeV2Schema>;
