// Zod imports
import { z } from "zod";

const baseFileSchema = z
  .instanceof(File)
  .refine(
    (file) => file.size < 20 * 1024 * 1024,
    "Each file must be less than 20MB.",
  );

const createFileArraySchema = (
  maxFiles: number,
  emptyMessage: string,
  zeroSizeMessage: string,
) =>
  z
    .array(baseFileSchema)
    .min(1, {
      message: emptyMessage,
    })
    .max(maxFiles, {
      message: `A maximum of ${maxFiles} files can be uploaded.`,
    })
    .refine((files) => files.every((file) => file.size > 0), zeroSizeMessage);

export const createCognitiveWalkthroughSchema = (maxFiles: number) =>
  z.object({
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
    user: z
      .string()
      .trim()
      .max(1000, {
        message:
          "Information about the target user must be less than 1000 characters.",
      })
      .optional(),
    files: createFileArraySchema(
      maxFiles,
      "At least one image file must be uploaded.",
      "Each file must be greater than 0MB.",
    ),
    context: z.string().max(1000, {
      message: "The context must be less than 1000 characters.",
    }),
    // Optional persona selection metadata carried through the client only
    persona: z
      .object({
        studyId: z.string().optional(),
        name: z.string().optional(),
        description: z.string().optional(),
        data: z.any().optional(),
      })
      .optional(),
  });

export type CognitiveWalkthroughSchema = ReturnType<
  typeof createCognitiveWalkthroughSchema
>;
export type CognitiveWalkthroughFormValues =
  z.infer<CognitiveWalkthroughSchema>;

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

export const createHeuristicEvaluationSchema = (maxFiles: number) =>
  z.object({
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
    user: z
      .string()
      .trim()
      .max(1000, {
        message:
          "Information about the target user must be less than 1000 characters.",
      })
      .optional(),
    files: createFileArraySchema(
      maxFiles,
      "At least one image file must be uploaded.",
      "Each file must be greater than 0MB.",
    ),
    heuristic: z.string().min(1, {
      message: "A set of heuristics must be selected.",
    }),
    context: z.string().max(1000, {
      message: "The context must be less than 1000 characters.",
    }),
  });

export type HeuristicEvaluationSchema = ReturnType<
  typeof createHeuristicEvaluationSchema
>;
export type HeuristicEvaluationFormValues = z.infer<HeuristicEvaluationSchema>;

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

export const heuristicItemSchema = z.object({
  id: z.string(),
  label: z.string().trim().min(1, {
    message: "A label is required for the heuristic.",
  }),
  category: z.string().trim().optional(),
  heuristic: z.string().trim().min(1, {
    message: "A heuristic is required.",
  }),
});

export const newHeuristicSetSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, {
      message: "A name is required for the heuristics.",
    })
    .max(200, {
      message: "The name must be less than 200 characters.",
    }),
  description: z
    .string()
    .trim()
    .max(1000, {
      message: "The description must be less than 1000 characters.",
    })
    .optional(),
  heuristics: z.array(heuristicItemSchema).min(1, {
    message: "At least one heuristic must be added.",
  }),
});
