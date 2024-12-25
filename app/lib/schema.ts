// Zod imports
import { z } from "zod";

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
