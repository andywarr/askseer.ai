// Zod imports
import { z } from "zod";
import { MAX_FILE_SIZE_BYTES, MAX_FILE_SIZE_MB } from "@/apps/shared/constants";
import { type UploadPolicy } from "@/apps/nextjs-app/lib/db/study";

const getMsg = (
  t: ((key: string, values?: any) => string) | undefined,
  key: string,
  fallback: string,
  values?: any
) => {
  if (t) {
    try {
      return t(key, values);
    } catch {
      return fallback;
    }
  }
  if (values) {
    let msg = fallback;
    for (const [k, v] of Object.entries(values)) {
      msg = msg.replace(`{${k}}`, String(v));
    }
    return msg;
  }
  return fallback;
};

const createBaseFileSchema = (t?: (key: string, values?: any) => string) =>
  z
    .instanceof(File)
    .refine(
      (file) => file.size < MAX_FILE_SIZE_BYTES,
      getMsg(t, "fileSizeMax", `Each file must be less than ${MAX_FILE_SIZE_MB}MB.`, { max: MAX_FILE_SIZE_MB }),
    );

const createFileArraySchema = (
  maxFiles: number,
  emptyMessage: string,
  emptyMessageKey: string,
  zeroSizeMessage: string,
  zeroSizeMessageKey: string,
  allowEmpty = false,
  t?: (key: string, values?: any) => string,
) =>
  z
    .array(createBaseFileSchema(t))
    .min(allowEmpty ? 0 : 1, {
      message: emptyMessageKey ? getMsg(t, emptyMessageKey, emptyMessage) : emptyMessage,
    })
    .max(maxFiles, {
      message: getMsg(t, "filesMax", `A maximum of ${maxFiles} files can be uploaded.`, { max: maxFiles }),
    })
    .refine(
      (files) => files.every((file) => file.size > 0),
      zeroSizeMessageKey ? getMsg(t, zeroSizeMessageKey, zeroSizeMessage) : zeroSizeMessage
    )
    .refine(
      (files) => files.every((file) => file.size < MAX_FILE_SIZE_BYTES),
      (files) => {
        const oversized = files
          .filter((f) => f.size >= MAX_FILE_SIZE_BYTES)
          .map((f) => f.name);
        return {
          message: getMsg(t, "filesExceedLimit", `${oversized.length > 1 ? "Files" : "File"} ${oversized.join(", ")} exceed${oversized.length === 1 ? "s" : ""} the ${MAX_FILE_SIZE_MB}MB limit.`, {
            count: oversized.length,
            names: oversized.join(", "),
            max: MAX_FILE_SIZE_MB
          }),
        };
      },
    );

export const createCognitiveWalkthroughSchema = (
  maxFiles: number,
  allowEmptyFiles = false,
  t?: (key: string, values?: any) => string,
) =>
  z.object({
    name: z
      .string()
      .trim()
      .max(100, {
        message: getMsg(t, "nameMax", "The study name must be less than 100 characters.", { max: 100 }),
      })
      .optional()
      .default(""),
    goal: z
      .string()
      .trim()
      .max(1000, {
        message: getMsg(t, "goalMax", "The user goal must be less than 1000 characters.", { max: 1000 }),
      })
      .optional()
      .default(""),
    user: z
      .string()
      .trim()
      .max(1000, {
        message:
          getMsg(t, "userMax", "Information about the target user must be less than 1000 characters.", { max: 1000 }),
      })
      .optional()
      .default(""),
    files: createFileArraySchema(
      maxFiles,
      "At least one image file must be uploaded.",
      "filesMinImages",
      "Each file must be greater than 0MB.",
      "fileSizeMin",
      allowEmptyFiles,
      t,
    ),
    context: z
      .string()
      .max(1000, {
        message: getMsg(t, "contextMax", "The context must be less than 1000 characters.", { max: 1000 }),
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

export const createHeuristicEvaluationSchema = (
  maxFiles: number,
  allowEmptyFiles = false,
  t?: (key: string, values?: any) => string,
) =>
  z.object({
    name: z
      .string()
      .trim()
      .max(100, {
        message: getMsg(t, "nameMax", "The study name must be less than 100 characters.", { max: 100 }),
      })
      .optional()
      .default(""),
    goal: z
      .string()
      .trim()
      .max(1000, {
        message: getMsg(t, "goalMax", "The user goal must be less than 1000 characters.", { max: 1000 }),
      })
      .optional()
      .default(""),
    user: z
      .string()
      .trim()
      .max(1000, {
        message:
          getMsg(t, "userMax", "Information about the target user must be less than 1000 characters.", { max: 1000 }),
      })
      .optional()
      .default(""),
    files: createFileArraySchema(
      maxFiles,
      "At least one image file must be uploaded.",
      "filesMinImages",
      "Each file must be greater than 0MB.",
      "fileSizeMin",
      allowEmptyFiles,
      t,
    ),
    heuristic: z.string().optional().default(""),
    context: z
      .string()
      .max(1000, {
        message: getMsg(t, "contextMax", "The context must be less than 1000 characters.", { max: 1000 }),
      })
      .optional()
      .default(""),
  });

export type HeuristicEvaluationSchema = ReturnType<
  typeof createHeuristicEvaluationSchema
>;
export type HeuristicEvaluationFormValues = z.infer<HeuristicEvaluationSchema>;

export const createQualAnalysisSchema = (
  policy: UploadPolicy,
  t?: (key: string, values?: any) => string,
) =>
  z.object({
    name: z
      .string()
      .trim()
      .max(100, {
        message: getMsg(t, "nameMax", "The study name must be less than 100 characters.", { max: 100 }),
      })
      .optional()
      .default(""),
    goal: z
      .string()
      .trim()
      .max(1000, {
        message: getMsg(t, "researchGoalMax", "The research goal must be less than 1000 characters.", { max: 1000 }),
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
        message: getMsg(t, "discussionGuideMax", "The discussion guide must be less than 5000 characters.", { max: 5000 }),
      })
      .optional()
      .default(""),
    context: z
      .string()
      .max(2000, {
        message: getMsg(t, "contextMax", "The context must be less than 2000 characters.", { max: 2000 }),
      })
      .optional()
      .default(""),
    files: z
      .array(createBaseFileSchema(t))
      .min(1, {
        message:
          getMsg(t, "filesMinQual", "At least one file must be uploaded (audio, video, or transcript)."),
      })
      .max(policy.maxFiles, {
        message: getMsg(t, "filesMax", `A maximum of ${policy.maxFiles} files can be uploaded.`, { max: policy.maxFiles }),
      })
      .refine(
        (files) => files.every((file) => file.size > 0),
        getMsg(t, "fileSizeMin", "Each file must be greater than 0MB."),
      )
      .refine(
        (files) => files.every((file) => file.size < policy.maxSizeBytes),
        (files) => {
          const oversized = files
            .filter((f) => f.size >= policy.maxSizeBytes)
            .map((f) => f.name);
          return {
            message: getMsg(t, "filesExceedLimit", `${oversized.length > 1 ? "Files" : "File"} ${oversized.join(", ")} exceed${oversized.length === 1 ? "s" : ""} the ${policy.maxSizeMb}MB limit.`, {
              count: oversized.length,
              names: oversized.join(", "),
              max: policy.maxSizeMb
            }),
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
      }, getMsg(t, "audioVideoNotSupportedPersonal", "Audio and video files are not supported on personal tier.")),
    contextFiles: z
      .array(createBaseFileSchema(t))
      .max(10, {
        message: getMsg(t, "contextFilesMax", "A maximum of 10 additional context files can be uploaded.", { max: 10 }),
      })
      .optional()
      .default([]),
  });

export type QualAnalysisSchema = ReturnType<typeof createQualAnalysisSchema>;
export type QualAnalysisFormValues = z.infer<QualAnalysisSchema>;

export const createLiveSessionSchema = (
  policy: UploadPolicy,
  t?: (key: string, values?: any) => string,
) =>
  z.object({
    name: z
      .string()
      .trim()
      .max(100, {
        message: getMsg(t, "nameMax", "The study name must be less than 100 characters.", { max: 100 }),
      })
      .optional()
      .default(""),
    goal: z
      .string()
      .trim()
      .max(1000, {
        message: getMsg(t, "researchGoalMax", "The research goal must be less than 1000 characters.", { max: 1000 }),
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
        message: getMsg(t, "contextMax", "The context must be less than 2000 characters.", { max: 2000 }),
      })
      .optional()
      .default(""),
    participantCount: z.coerce
      .number()
      .min(1, getMsg(t, "participantCountMin", "At least 1 session is required"))
      .max(24, getMsg(t, "participantCountMax", "Maximum 24 sessions"))
      .default(1),
    guideFiles: z
      .array(z.instanceof(File))
      .min(1, {
        message: getMsg(t, "filesMinGuide", "A discussion guide file must be uploaded."),
      })
      .max(1, {
        message: getMsg(t, "filesMaxGuide", "Only one discussion guide file can be uploaded."),
      })
      .refine(
        (files) => files.every((file) => file.size > 0),
        getMsg(t, "fileSizeMaxLimitBytes", "File must be greater than 0 bytes."),
      )
      .refine(
        (files) => files.every((file) => file.size <= 1 * 1024 * 1024),
        getMsg(t, "fileSizeMaxLimit", "File exceeds the 1MB limit.", { max: 1 }),
      ),
  });

export type LiveSessionSchema = ReturnType<typeof createLiveSessionSchema>;
export type LiveSessionFormValues = z.infer<LiveSessionSchema>;

export const createInterviewSchema = (
  t?: (key: string, values?: any) => string,
) =>
  z.object({
    name: z
      .string()
      .trim()
      .max(100, {
        message: getMsg(t, "nameMax", "The study name must be less than 100 characters.", { max: 100 }),
      })
      .optional()
      .default(""),
    goal: z
      .string()
      .trim()
      .max(1000, {
        message: getMsg(t, "researchGoalMax", "The research goal must be less than 1000 characters.", { max: 1000 }),
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
        message: getMsg(t, "contextMax", "The context must be less than 2000 characters.", { max: 2000 }),
      })
      .optional()
      .default(""),
    participantCount: z.coerce
      .number()
      .min(1, getMsg(t, "participantCountMin", "At least 1 session is required"))
      .max(24, getMsg(t, "participantCountMax", "Maximum 24 sessions"))
      .default(1),
    guideFiles: z
      .array(z.instanceof(File))
      .min(1, {
        message: getMsg(t, "filesMinGuide", "A discussion guide file must be uploaded."),
      })
      .max(1, {
        message: getMsg(t, "filesMaxGuide", "Only one discussion guide file can be uploaded."),
      })
      .refine(
        (files) => files.every((file) => file.size > 0),
        getMsg(t, "fileSizeMaxLimitBytes", "File must be greater than 0 bytes."),
      )
      .refine(
        (files) => files.every((file) => file.size <= 1 * 1024 * 1024),
        getMsg(t, "fileSizeMaxLimit", "File exceeds the 1MB limit.", { max: 1 }),
      ),
    contextFiles: z
      .array(createBaseFileSchema(t))
      .max(10, {
        message: getMsg(t, "contextFilesMax", "A maximum of 10 additional context files can be uploaded.", { max: 10 }),
      })
      .optional()
      .default([]),
    endDate: z
      .string()
      .optional()
      .refine((val) => !val || !isNaN(Date.parse(val)), getMsg(t, "invalidDate", "Invalid date")),
    startDate: z
      .string()
      .optional()
      .refine((val) => !val || !isNaN(Date.parse(val)), getMsg(t, "invalidDate", "Invalid date")),
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

export const getHeuristicItemSchema = (t: any) =>
  z.object({
    id: z.string(),
    label: z.string().trim().min(1, {
      message: t("validation.labelRequired"),
    }),
    category: z.string().trim().optional(),
    heuristic: z.string().trim().min(1, {
      message: t("validation.heuristicRequired"),
    }),
  });

export const getNewHeuristicSetSchema = (t: any) =>
  z.object({
    name: z
      .string()
      .trim()
      .min(1, {
        message: t("validation.nameRequired"),
      })
      .max(200, {
        message: t("validation.nameTooLong"),
      }),
    description: z
      .string()
      .trim()
      .max(1000, {
        message: t("validation.descriptionTooLong"),
      })
      .optional(),
    heuristics: z.array(getHeuristicItemSchema(t)).min(1, {
      message: t("validation.minHeuristics"),
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
