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
  user: z.string().trim().max(1000, {
    message:
      "Information about the target user must be less than 1000 characters.",
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
    .max(20, {
      message: "A maximum of 20 files can be uploaded.",
    })
    .refine(
      (files) => files.every((file) => file.size > 0),
      "At least one image file must be uploaded.",
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
  user: z.string().trim().max(1000, {
    message:
      "Information about the target user must be less than 1000 characters.",
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
    .max(20, {
      message: "A maximum of 20 files can be uploaded.",
    })
    .refine(
      (files) => files.every((file) => file.size > 0),
      "Each file must be greater than 0MB.",
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

// Persona form schema: all sections and fields optional, trimmed and length-limited
// Support structured goal items: { want: string; soThat: string }
const goalItem = z.object({
  want: z.string().trim().min(1).max(250),
  soThat: z.string().trim().min(1).max(250),
});

export const personaSchema = z.object({
  name: z.string().trim().max(100).optional(),
  description: z.string().trim().max(1000).optional(),
  images: z
    .object({
      photoKey: z.string().trim().max(255).optional(),
      coverKey: z.string().trim().max(255).optional(),
    })
    .optional(),
  demographics: z
    .object({
      age: z.string().trim().max(50).optional(),
      gender: z.string().trim().max(50).optional(),
      ethnicity: z.string().trim().max(100).optional(),
      location: z.string().trim().max(50).optional(),
      education: z.string().trim().max(50).optional(),
      income: z.string().trim().max(50).optional(),
      maritalStatus: z.string().trim().max(50).optional(),
      householdSize: z.string().trim().max(50).optional(),
    })
    .optional(),
  psychographics: z
    .object({
      personality: z.string().trim().max(1000).optional(),
      interests: z
        .union([
          z.string().trim().max(1000),
          z.array(z.string().trim().max(100)).max(10),
        ])
        .optional(),
      values: z
        .union([
          z.string().trim().max(1000),
          z.array(z.string().trim().max(100)).max(10),
        ])
        .optional(),
      motivations: z
        .union([
          z.string().trim().max(1000),
          z.array(z.string().trim().max(100)).max(10),
        ])
        .optional(),
      painPoints: z
        .union([
          z.string().trim().max(1000),
          z.array(z.string().trim().max(100)).max(10),
        ])
        .optional(),
    })
    .optional(),
  behaviors: z
    .object({
      techProficiency: z.string().trim().max(50).optional(),
      primaryDevices: z
        .union([
          z.string().trim().max(500),
          z.array(z.string().trim().max(50)).max(10),
        ])
        .optional(),
      preferredChannels: z
        .union([
          z.string().trim().max(500),
          z.array(z.string().trim().max(50)).max(10),
        ])
        .optional(),
      purchaseTriggers: z
        .union([
          z.string().trim().max(500),
          z.array(z.string().trim().max(50)).max(10),
        ])
        .optional(),
    })
    .optional(),
  firmographics: z
    .object({
      companySize: z.string().trim().max(50).optional(),
      industry: z.string().trim().max(50).optional(),
      roleSeniority: z.string().trim().max(50).optional(),
      department: z.string().trim().max(50).optional(),
      jobTitle: z.string().trim().max(100).optional(),
      decisionPower: z.string().trim().max(50).optional(),
      budgetRange: z.string().trim().max(50).optional(),
    })
    .optional(),
  goals: z
    .union([
      z.string().trim().max(1000),
      z.array(z.string().trim().max(250)).max(25),
      z.array(goalItem).max(25),
    ])
    .optional(),
  quotes: z
    .union([
      z.string().trim().max(1000),
      z.array(z.string().trim().max(1000)).max(10),
    ])
    .optional(),
});
