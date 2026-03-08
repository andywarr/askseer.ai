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
  "qual_analysis",
  "live_session",
]);

export const CognitiveWalkthroughPayloadV2Schema = z
  .object({
    name: z.string().optional(),
    goal: z.string().optional(),
    user: z.string().nullable().optional(),
    context: z.string().nullable().optional(),
    files: z.array(FileSchema).optional(),
    persona: z
      .object({
        studyId: z.string().optional(),
        name: z.string().optional(),
        description: z.string().optional(),
        // Allow any structured persona data without importing the HE schema here
        data: z.any().optional(),
      })
      .optional(),
  })
  .strict();

// Define Persona schema first so HE schema can reference it below
const PersonaGoalItemSchema_HE = z.object({
  want: z.string().trim().min(1).max(250),
  soThat: z.string().trim().min(1).max(250),
});

const PersonaToolItemSchema_HE = z.object({
  tool: z.string().trim().min(1).max(100),
  expertise: z.string().trim().max(50).optional(),
  frequency: z.string().trim().max(50).optional(),
  satisfaction: z.string().trim().max(50).optional(),
});

const PersonaToolItemSchema = z.object({
  tool: z.string().trim().min(1).max(100),
  expertise: z.string().trim().max(50).optional(),
  frequency: z.string().trim().max(50).optional(),
  satisfaction: z.string().trim().max(50).optional(),
});

const PersonaSchema_HE = z.object({
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
  tools: z
    .union([
      z.string().trim().max(1000),
      z.array(z.string().trim().max(100)).max(20),
      z.array(PersonaToolItemSchema).max(20),
    ])
    .optional(),
  firmographics: z
    .object({
      employmentStatus: z.string().trim().max(50).optional(),
      companySize: z.string().trim().max(50).optional(),
      industry: z.string().trim().max(50).optional(),
      roleSeniority: z.string().trim().max(50).optional(),
      department: z.string().trim().max(50).optional(),
      jobTitle: z.string().trim().max(100).optional(),
      decisionPower: z.string().trim().max(50).optional(),
      budgetRange: z.string().trim().max(50).optional(),
      annualRecurringRevenue: z.string().trim().max(50).optional(),
    })
    .optional(),
  goals: z
    .union([
      z.string().trim().max(1000),
      z.array(z.string().trim().max(250)).max(25),
      z.array(PersonaGoalItemSchema_HE).max(25),
    ])
    .optional(),
  quotes: z
    .union([
      z.string().trim().max(1000),
      z.array(z.string().trim().max(1000)).max(10),
    ])
    .optional(),
});

export const HeuristicEvaluationPayloadV2Schema = z
  .object({
    name: z.string().optional(),
    goal: z.string().optional(),
    user: z.string().nullable().optional(),
    context: z.string().nullable().optional(),
    files: z.array(FileSchema).optional(),
    heuristic: z.string().min(1),
    persona: z
      .object({
        studyId: z.string().optional(),
        name: z.string().optional(),
        description: z.string().optional(),
        data: PersonaSchema_HE.optional(),
      })
      .optional(),
  })
  .strict();

// Persona authoring schema (shared): mirrors the Next.js persona form schema
// All fields are optional to allow partial authoring payloads.
const PersonaGoalItemSchema = z.object({
  want: z.string().trim().min(1).max(250),
  soThat: z.string().trim().min(1).max(250),
});

export const PersonaSchema = z.object({
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
  tools: z
    .union([
      z.string().trim().max(1000),
      z.array(z.string().trim().max(100)).max(20),
      z.array(PersonaToolItemSchema_HE).max(20),
    ])
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
      employmentStatus: z.string().trim().max(50).optional(),
      annualRecurringRevenue: z.string().trim().max(50).optional(),
    })
    .optional(),
  goals: z
    .union([
      z.string().trim().max(1000),
      z.array(z.string().trim().max(250)).max(25),
      z.array(PersonaGoalItemSchema).max(25),
    ])
    .optional(),
  quotes: z
    .union([
      z.string().trim().max(1000),
      z.array(z.string().trim().max(1000)).max(10),
    ])
    .optional(),
});

// Persona study payload: accepts the common base fields and allows
// attaching a structured persona object or an "extra" bag for flexible data
export const PersonaPayloadV2Schema = z
  .object({
    // Optional rich persona object
    persona: z
      .object({
        photoUrl: z.string().url().nullable().optional(),
        coverUrl: z.string().url().nullable().optional(),
        files: z.array(FileSchema).optional(),
        data: PersonaSchema.optional(),
      })
      .optional(),
  })
  .strict();

export const QualAnalysisPayloadV2Schema = z
  .object({
    name: z.string().optional(),
    goal: z.string().optional(),
    researchQuestions: z.array(z.string()).optional(),
    hypotheses: z.array(z.string()).optional(),
    discussionGuide: z.string().optional(),
    context: z.string().nullable().optional(),
    files: z.array(FileSchema).optional(),
    contextFiles: z.array(FileSchema).optional(), // Additional uploads like research plan, discussion guide docs
    personas: z
      .array(
        z.object({
          studyId: z.string(),
          name: z.string().optional(),
          description: z.string().optional(),
          data: z.any().optional(),
        }),
      )
      .optional(), // Linked personas for context
  })
  .strict();

export const LiveSessionPayloadV2Schema = z
  .object({
    liveSessionId: z.string().optional(),
    name: z.string().optional(),
    goal: z.string().optional(),
    researchQuestions: z.array(z.string()).optional(),
    hypotheses: z.array(z.string()).optional(),
    discussionGuide: z.string().optional(),
    context: z.string().nullable().optional(),
    files: z.array(FileSchema).optional(),
    contextFiles: z.array(FileSchema).optional(),
    participantCount: z.number().int().min(1).max(24).optional(),
    personas: z
      .array(
        z.object({
          studyId: z.string(),
          name: z.string().optional(),
          description: z.string().optional(),
          data: z.any().optional(),
        }),
      )
      .optional(),
  })
  .strict();

export const JobEnvelopeV2Schema = z.discriminatedUnion("type", [
  z
    .object({
      version: z.literal(2),
      studyId: z.string(),
      userId: z.string(),
      teamId: z.string().optional(), // Optional for backward compatibility
      companyId: z.string().optional().nullable(), // Optional, for heuristic access control
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
      teamId: z.string().optional(), // Optional for backward compatibility
      companyId: z.string().optional().nullable(), // Optional, for heuristic access control
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
      teamId: z.string().optional(), // Optional for backward compatibility
      companyId: z.string().optional().nullable(), // Optional, for heuristic access control
      type: z.literal("persona"),
      payload: PersonaPayloadV2Schema,
      retry: z.boolean().optional(),
    })
    .strict(),
  z
    .object({
      version: z.literal(2),
      studyId: z.string(),
      userId: z.string(),
      teamId: z.string().optional(),
      companyId: z.string().optional().nullable(),
      type: z.literal("qual_analysis"),
      payload: QualAnalysisPayloadV2Schema,
      retry: z.boolean().optional(),
    })
    .strict(),
  z
    .object({
      version: z.literal(2),
      studyId: z.string(),
      userId: z.string(),
      teamId: z.string().optional(),
      companyId: z.string().optional().nullable(),
      type: z.literal("live_session"),
      payload: LiveSessionPayloadV2Schema,
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
export type Persona = z.infer<typeof PersonaSchema>;
export type QualAnalysisPayloadV2 = z.infer<typeof QualAnalysisPayloadV2Schema>;
export type LiveSessionPayloadV2 = z.infer<typeof LiveSessionPayloadV2Schema>;
export type JobEnvelopeV2_CW = Extract<
  JobEnvelopeV2,
  { type: "cognitive_walkthrough" }
>;
export type JobEnvelopeV2_HE = Extract<
  JobEnvelopeV2,
  { type: "heuristic_evaluation" }
>;
export type JobEnvelopeV2_PE = Extract<JobEnvelopeV2, { type: "persona" }>;
export type JobEnvelopeV2_AN = Extract<
  JobEnvelopeV2,
  { type: "qual_analysis" }
>;
export type JobEnvelopeV2_LS = Extract<JobEnvelopeV2, { type: "live_session" }>;

// Helper to parse and validate a v2 job envelope from unknown input
export function parseJobEnvelope(raw: unknown): JobEnvelopeV2 {
  const parsed = JobEnvelopeV2Schema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(
      `Invalid v2 job envelope: ${parsed.error.issues
        .map((i) => (Array.isArray(i.path) ? i.path.join(".") : String(i.path)))
        .join(", ")}`,
    );
  }
  return parsed.data;
}
