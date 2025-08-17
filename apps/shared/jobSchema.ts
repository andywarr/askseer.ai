import { z } from "zod";

export const FileSchema = z.object({
  name: z.string(),
  key: z.string(),
  size: z.number(),
  type: z.string(),
});

export const TaskV2Enum = z.enum([
  "cognitive_walkthrough",
  "heuristic_evaluation",
  "persona",
]);

export const CognitiveWalkthroughPayloadV2Schema = z
  .object({
    name: z.string().optional(),
    goal: z.string().optional(),
    user: z.string().nullable().optional(),
    context: z.string().nullable().optional(),
    files: z.array(FileSchema).optional(),
  })
  .strict();

export const HeuristicEvaluationPayloadV2Schema = z
  .object({
    name: z.string().optional(),
    goal: z.string().optional(),
    user: z.string().nullable().optional(),
    context: z.string().nullable().optional(),
    files: z.array(FileSchema).optional(),
    heuristic: z.enum(["NIELSEN", "TENETS"]),
  })
  .strict();

// Persona study payload: accepts the common base fields and allows
// attaching a structured persona object or an "extra" bag for flexible data
export const PersonaPayloadV2Schema = z
  .object({
    name: z.string().optional(),
    files: z.array(FileSchema).optional(),
    // Optional rich persona object; shape can evolve independently of the job envelope
    persona: z
      .object({
        name: z.string().optional(),
        oneLiner: z.string().optional(),
        photoUrl: z.string().url().nullable().optional(),
        coverUrl: z.string().url().nullable().optional(),
        files: z.array(FileSchema).optional(),
        extra: z.unknown().optional(),
      })
      .optional(),
    // Optional extra key-value data container for future fields
    extra: z.record(z.unknown()).optional(),
  })
  .strict();

export const JobEnvelopeV2Schema = z.discriminatedUnion("type", [
  z
    .object({
      version: z.literal(2),
      studyId: z.string(),
      userId: z.string(),
      type: z.literal("cognitive_walkthrough"),
      payload: CognitiveWalkthroughPayloadV2Schema,
      retry: z.boolean().optional(),
    })
    .strict(),
  z
    .object({
      version: z.literal(2),
      studyId: z.string(),
      userId: z.string(),
      type: z.literal("heuristic_evaluation"),
      payload: HeuristicEvaluationPayloadV2Schema,
      retry: z.boolean().optional(),
    })
    .strict(),
  z
    .object({
      version: z.literal(2),
      studyId: z.string(),
      userId: z.string(),
      type: z.literal("persona"),
      payload: PersonaPayloadV2Schema,
      retry: z.boolean().optional(),
    })
    .strict(),
]);

export type JobEnvelopeV2 = z.infer<typeof JobEnvelopeV2Schema>;
export type CognitiveWalkthroughPayloadV2 = z.infer<
  typeof CognitiveWalkthroughPayloadV2Schema
>;
export type HeuristicEvaluationPayloadV2 = z.infer<
  typeof HeuristicEvaluationPayloadV2Schema
>;
export type PersonaPayloadV2 = z.infer<typeof PersonaPayloadV2Schema>;
export type JobEnvelopeV2_CW = Extract<
  JobEnvelopeV2,
  { type: "cognitive_walkthrough" }
>;
export type JobEnvelopeV2_HE = Extract<
  JobEnvelopeV2,
  { type: "heuristic_evaluation" }
>;
export type JobEnvelopeV2_PE = Extract<JobEnvelopeV2, { type: "persona" }>;

// Helper to parse and validate a v2 job envelope from unknown input
export function parseJobEnvelope(raw: unknown): JobEnvelopeV2 {
  const parsed = JobEnvelopeV2Schema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(
      `Invalid v2 job envelope: ${parsed.error.issues
        .map((i) => (Array.isArray(i.path) ? i.path.join(".") : String(i.path)))
        .join(", ")}`
    );
  }
  return parsed.data;
}
