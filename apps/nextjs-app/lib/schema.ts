// Zod imports
import { z } from "zod";

export const cognitiveWalkthroughSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, {
      message: "A study name must be included.",
    })
    .max(100, {
      message: "The study name must be less than 100 characters.",
    }),
  goal: z
    .string()
    .trim()
    .min(1, {
      message: "A user goal must be included.",
    })
    .max(1000, {
      message: "The user goal must be less than 1000 characters.",
    }),
  files: z
    .array(
      z
        .instanceof(File)
        .refine(
          (file) => file.size < 20 * 1024 * 1024,
          "Each file must be less than 20MB.",
        ),
    )
    .min(1, {
      message: "At least one image file must be uploaded.",
    })
    .refine(
      (files) => files.every((file) => file.size > 0),
      "At least one image file must be uploaded.",
    ),
  context: z.string().max(1000, {
    message: "The context must be less than 1000 characters.",
  }),
});

export const cognitiveWalkthroughResultFormat = z.object({
  results: z.object({
    step: z.number(),
    expected: z.boolean(),
    results: z.array(
      z.object({
        questionId: z.string(),
        answer: z.string(),
      }),
    ),
    issues: z.array(
      z.object({
        issueType: z.union([
          z.literal("DISCOVERABILITY"),
          z.literal("LEARNABILITY"),
          z.literal("USABILITY"),
        ]),
        issue: z.string(),
        recommendations: z.array(
          z.object({
            recommendation: z.string(),
          }),
        ),
      }),
    ),
  }),
});

export const heuristicEvaluationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, {
      message: "A study name must be included.",
    })
    .max(100, {
      message: "The study name must be less than 100 characters.",
    }),
  goal: z
    .string()
    .trim()
    .min(1, {
      message: "A user goal must be included.",
    })
    .max(1000, {
      message: "The user goal must be less than 1000 characters.",
    }),
  files: z
    .array(
      z
        .instanceof(File)
        .refine(
          (file) => file.size < 20 * 1024 * 1024,
          "Each file must be less than 20MB.",
        ),
    )
    .min(1, {
      message: "At least one image file must be uploaded.",
    })
    .refine(
      (files) => files.every((file) => file.size > 0),
      "At least one image file must be uploaded.",
    ),
  heuristic: z.union([z.literal("nielsen"), z.literal("tenets")]),
  context: z.string().max(1000, {
    message: "The context must be less than 1000 characters.",
  }),
});

export const heuristicEvaluationResultFormat = z.object({
  results: z.array(
    z.object({
      id: z.string(),
      heuristic: z.string(),
      type: z.string(),
      violated: z.union([z.literal("yes"), z.literal("no")]),
      reason: z.string(),
      recommendation: z.string(),
    }),
  ),
});

export const creditRequestSchema = z.object({
  name: z.string().trim().min(1, {
    message: "Your full name is required.",
  }),
  email: z.string().email({
    message: "A valid email address is required.",
  }),
  credits: z
    .number()
    .min(1, {
      message: "At least 1 credits must be purchased.",
    })
    .max(1000, {
      message:
        "To purchase more than 1000 credits, please email payments@askseer.ai.",
    }),
});
