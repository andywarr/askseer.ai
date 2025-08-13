import { z } from "zod";

export const JobFileSchema = z.object({
  name: z.string(),
  key: z.string(),
  size: z.number(),
  type: z.string(),
});

export const TaskV2Enum = z.enum([
  "cognitive_walkthrough",
  "heuristic_evaluation",
]);

export const CognitiveWalkthroughPayloadV2Schema = z
  .object({
    name: z.string().optional(),
    goal: z.string().optional(),
    user: z.string().nullable().optional(),
    context: z.string().nullable().optional(),
    files: z.array(JobFileSchema).optional(),
  })
  .strict();

export const HeuristicEvaluationPayloadV2Schema = z
  .object({
    name: z.string().optional(),
    goal: z.string().optional(),
    user: z.string().nullable().optional(),
    context: z.string().nullable().optional(),
    files: z.array(JobFileSchema).optional(),
    heuristic: z.enum(["NIELSEN", "TENETS"]),
  })
  .strict();

export const JobEnvelopeV2Schema = z.discriminatedUnion("task", [
  z
    .object({
      version: z.literal(2),
      studyId: z.string(),
      userId: z.string(),
  task: z.literal("cognitive_walkthrough"),
      payload: CognitiveWalkthroughPayloadV2Schema,
      retry: z.boolean().optional(),
    })
    .strict(),
  z
    .object({
      version: z.literal(2),
      studyId: z.string(),
      userId: z.string(),
  task: z.literal("heuristic_evaluation"),
      payload: HeuristicEvaluationPayloadV2Schema,
      retry: z.boolean().optional(),
    })
    .strict(),
]);

export type JobEnvelopeV2 = z.infer<typeof JobEnvelopeV2Schema>;
export type JobEnvelopeV2_CW = Extract<
  JobEnvelopeV2,
  { task: "cognitive_walkthrough" }
>;
export type JobEnvelopeV2_HE = Extract<
  JobEnvelopeV2,
  { task: "heuristic_evaluation" }
>;
