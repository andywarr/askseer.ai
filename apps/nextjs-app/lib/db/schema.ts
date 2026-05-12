// Zod imports
import { z } from "zod";
import { MAX_FILE_SIZE_BYTES, MAX_FILE_SIZE_MB } from "@/apps/shared/constants";
import { type UploadPolicy } from "@/apps/nextjs-app/lib/db/study";

const baseFileSchema = z
  .instanceof(File)
  .refine(
    (file) => file.size < MAX_FILE_SIZE_BYTES,
    `Each file must be less than ${MAX_FILE_SIZE_MB}MB.`,
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
    .refine((files) => files.every((file) => file.size > 0), zeroSizeMessage)
    .refine(
      (files) => files.every((file) => file.size < MAX_FILE_SIZE_BYTES),
      (files) => {
        const oversized = files
          .filter((f) => f.size >= MAX_FILE_SIZE_BYTES)
          .map((f) => f.name);
        return {
          message: `${oversized.length > 1 ? "Files" : "File"} ${oversized.join(", ")} exceed${oversized.length === 1 ? "s" : ""} the ${MAX_FILE_SIZE_MB}MB limit.`,
        };
      },
    );

export const createCognitiveWalkthroughSchema = (maxFiles: number) =>
  z.object({
    name: z
      .string()
      .trim()
      .max(100, {
        message: "The study name must be less than 100 characters.",
      })
      .optional()
      .default(""),
    goal: z
      .string()
      .trim()
      .max(1000, {
        message: "The user goal must be less than 1000 characters.",
      })
      .optional()
      .default(""),
    user: z
      .string()
      .trim()
      .max(1000, {
        message:
          "Information about the target user must be less than 1000 characters.",
      })
      .optional()
      .default(""),
    files: createFileArraySchema(
      maxFiles,
      "At least one image file must be uploaded.",
      "Each file must be greater than 0MB.",
    ),
    context: z
      .string()
      .max(1000, {
        message: "The context must be less than 1000 characters.",
      })
      .optional()
      .default(""),
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
      .max(100, {
        message: "The study name must be less than 100 characters.",
      })
      .optional()
      .default(""),
    goal: z
      .string()
      .trim()
      .max(1000, {
        message: "The user goal must be less than 1000 characters.",
      })
      .optional()
      .default(""),
    user: z
      .string()
      .trim()
      .max(1000, {
        message:
          "Information about the target user must be less than 1000 characters.",
      })
      .optional()
      .default(""),
    files: createFileArraySchema(
      maxFiles,
      "At least one image file must be uploaded.",
      "Each file must be greater than 0MB.",
    ),
    heuristic: z.string().optional().default(""),
    context: z
      .string()
      .max(1000, {
        message: "The context must be less than 1000 characters.",
      })
      .optional()
      .default(""),
  });

export type HeuristicEvaluationSchema = ReturnType<
  typeof createHeuristicEvaluationSchema
>;
export type HeuristicEvaluationFormValues = z.infer<HeuristicEvaluationSchema>;

export const createQualAnalysisSchema = (policy: UploadPolicy) =>
  z.object({
    name: z
      .string()
      .trim()
      .max(100, {
        message: "The study name must be less than 100 characters.",
      })
      .optional()
      .default(""),
    goal: z
      .string()
      .trim()
      .max(1000, {
        message: "The research goal must be less than 1000 characters.",
      })
      .optional()
      .default(""),
    researchQuestions: z
      .array(z.string().trim().min(1).max(500))
      .optional()
      .default([]),
    hypotheses: z
      .array(z.string().trim().min(1).max(500))
      .optional()
      .default([]),
    discussionGuide: z
      .string()
      .trim()
      .max(5000, {
        message: "The discussion guide must be less than 5000 characters.",
      })
      .optional()
      .default(""),
    context: z
      .string()
      .max(2000, {
        message: "The context must be less than 2000 characters.",
      })
      .optional()
      .default(""),
    files: z
      .array(z.instanceof(File))
      .min(1, {
        message:
          "At least one file must be uploaded (audio, video, or transcript).",
      })
      .max(policy.maxFiles, {
        message: `A maximum of ${policy.maxFiles} files can be uploaded.`,
      })
      .refine(
        (files) => files.every((file) => file.size > 0),
        "Each file must be greater than 0MB.",
      )
      .refine(
        (files) => files.every((file) => file.size < policy.maxSizeBytes),
        (files) => {
          const oversized = files
            .filter((f) => f.size >= policy.maxSizeBytes)
            .map((f) => f.name);
          return {
            message: `${oversized.length > 1 ? "Files" : "File"} ${oversized.join(", ")} exceed${oversized.length === 1 ? "s" : ""} the ${policy.maxSizeMb}MB limit.`,
          };
        },
      )
      .refine((files) => {
        if (policy.acceptsAudioVideo) return true;
        // Personal tier text-only validation
        return files.every(
          (f) =>
            f.type.startsWith("text/") ||
            f.name.match(/\.(txt|md|csv|pdf|doc|docx|vtt|srt)$/i),
        );
      }, "Audio and video files are not supported on personal tier."),
    contextFiles: z
      .array(baseFileSchema)
      .max(10, {
        message: "A maximum of 10 additional context files can be uploaded.",
      })
      .optional()
      .default([]),
  });

export type QualAnalysisSchema = ReturnType<typeof createQualAnalysisSchema>;
export type QualAnalysisFormValues = z.infer<QualAnalysisSchema>;

export const createLiveSessionSchema = (policy: UploadPolicy) =>
  z.object({
    name: z
      .string()
      .trim()
      .max(100, {
        message: "The study name must be less than 100 characters.",
      })
      .optional()
      .default(""),
    goal: z
      .string()
      .trim()
      .max(1000, {
        message: "The research goal must be less than 1000 characters.",
      })
      .optional()
      .default(""),
    researchQuestions: z
      .array(z.string().trim().min(1).max(500))
      .optional()
      .default([]),
    hypotheses: z
      .array(z.string().trim().min(1).max(500))
      .optional()
      .default([]),
    context: z
      .string()
      .max(2000, {
        message: "The context must be less than 2000 characters.",
      })
      .optional()
      .default(""),
    participantCount: z.coerce
      .number()
      .min(1, "At least 1 session is required")
      .max(24, "Maximum 24 sessions")
      .default(1),
    guideFiles: z
      .array(z.instanceof(File))
      .min(1, {
        message: "A discussion guide file must be uploaded.",
      })
      .max(1, {
        message: "Only one discussion guide file can be uploaded.",
      })
      .refine(
        (files) => files.every((file) => file.size > 0),
        "File must be greater than 0 bytes.",
      )
      .refine(
        (files) => files.every((file) => file.size <= 1 * 1024 * 1024),
        "File exceeds the 1MB limit.",
      ),
  });

export type LiveSessionSchema = ReturnType<typeof createLiveSessionSchema>;
export type LiveSessionFormValues = z.infer<LiveSessionSchema>;

export const createInterviewSchema = () =>
  z.object({
    name: z
      .string()
      .trim()
      .max(100, {
        message: "The study name must be less than 100 characters.",
      })
      .optional()
      .default(""),
    goal: z
      .string()
      .trim()
      .max(1000, {
        message: "The research goal must be less than 1000 characters.",
      })
      .optional()
      .default(""),
    researchQuestions: z
      .array(z.string().trim().min(1).max(500))
      .optional()
      .default([]),
    hypotheses: z
      .array(z.string().trim().min(1).max(500))
      .optional()
      .default([]),
    context: z
      .string()
      .max(2000, {
        message: "The context must be less than 2000 characters.",
      })
      .optional()
      .default(""),
    participantCount: z.coerce
      .number()
      .min(1, "At least 1 session is required")
      .max(24, "Maximum 24 sessions")
      .default(1),
    guideFiles: z
      .array(z.instanceof(File))
      .min(1, {
        message: "A discussion guide file must be uploaded.",
      })
      .max(1, {
        message: "Only one discussion guide file can be uploaded.",
      })
      .refine(
        (files) => files.every((file) => file.size > 0),
        "File must be greater than 0 bytes.",
      )
      .refine(
        (files) => files.every((file) => file.size <= 1 * 1024 * 1024),
        "File exceeds the 1MB limit.",
      ),
    contextFiles: z
      .array(baseFileSchema)
      .max(10, {
        message: "A maximum of 10 additional context files can be uploaded.",
      })
      .optional()
      .default([]),
    endDate: z
      .string()
      .optional()
      .refine((val) => !val || !isNaN(Date.parse(val)), "Invalid date"),
    startDate: z
      .string()
      .optional()
      .refine((val) => !val || !isNaN(Date.parse(val)), "Invalid date"),
  });

export type InterviewSchema = ReturnType<typeof createInterviewSchema>;
export type InterviewFormValues = z.infer<InterviewSchema>;

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

export const demoRequestSchema = z.object({
  name: z.string().trim().min(1, {
    message: "Your full name is required.",
  }),
  email: z.string().email({
    message: "A valid email address is required.",
  }),
  phone: z
    .string()
    .trim()
    .min(1, {
      message: "Your phone number is required.",
    })
    .max(30, {
      message: "Phone number must be less than 30 characters.",
    }),
  company: z.string().trim().min(1, {
    message: "Your company name is required.",
  }),
  jobRole: z.string().trim().min(1, {
    message: "Your job role is required.",
  }),
  howDidYouHear: z.string().trim().min(1, {
    message: "Please let us know how you heard about us.",
  }),
  useCase: z
    .string()
    .trim()
    .min(1, {
      message: "Please describe your use case.",
    })
    .max(2000, {
      message: "Use case description must be less than 2000 characters.",
    }),
});

export const contactRequestSchema = z.object({
  name: z.string().trim().min(1, {
    message: "Your full name is required.",
  }),
  email: z.string().email({
    message: "A valid email address is required.",
  }),
  phone: z
    .string()
    .trim()
    .min(1, {
      message: "Your phone number is required.",
    })
    .max(30, {
      message: "Phone number must be less than 30 characters.",
    }),
  company: z.string().trim().min(1, {
    message: "Your company name is required.",
  }),
  jobRole: z.string().trim().min(1, {
    message: "Your job role is required.",
  }),
  howDidYouHear: z.string().trim().min(1, {
    message: "Please let us know how you heard about us.",
  }),
  message: z
    .string()
    .trim()
    .min(1, {
      message: "Please enter your message.",
    })
    .max(2000, {
      message: "Message must be less than 2000 characters.",
    }),
});
