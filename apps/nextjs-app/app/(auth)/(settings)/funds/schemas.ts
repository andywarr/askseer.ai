import { z } from "zod";
import {
  PERSONAL_STUDY_COST_CENTS,
  MAX_FUND_AMOUNT_CENTS,
} from "@/apps/shared/constants";

// Schema for add funds form (minimum depends on team type)
export const createAddFundsSchema = (minAmountCents: number) =>
  z.object({
    teamId: z.string().min(1, "Please select a team"),
    amountCents: z
      .number()
      .int("Amount must be in whole cents")
      .min(
        minAmountCents,
        `Minimum $${(minAmountCents / 100).toFixed(2)} required`,
      )
      .max(MAX_FUND_AMOUNT_CENTS, "Maximum $5,000.00 per purchase"),
  });

// Default schema for backwards-compatible type inference
export const addFundsSchema = createAddFundsSchema(PERSONAL_STUDY_COST_CENTS);

export type AddFundsInput = z.infer<typeof addFundsSchema>;

// Schema for transfer balance form
export const transferBalanceSchema = z
  .object({
    fromTeamId: z.string().min(1, "Please select a source team"),
    toTeamId: z.string().min(1, "Please select a destination team"),
    amountCents: z
      .number()
      .int("Amount must be in whole cents")
      .min(1, "Minimum $0.01 required")
      .max(50000000, "Maximum $500,000.00 per transfer"),
  })
  .refine((data) => data.fromTeamId !== data.toTeamId, {
    message: "Source and destination teams must be different",
    path: ["toTeamId"],
  });

export type TransferBalanceInput = z.infer<typeof transferBalanceSchema>;

// Schema for auto-refill settings (minimum depends on team type)
export const createAutoRefillSettingsSchema = (minAmountCents: number) =>
  z.object({
    teamId: z.string().min(1, "Please select a team"),
    autoRefillEnabled: z.boolean(),
    autoRefillThreshold: z
      .number()
      .int("Threshold must be in whole cents")
      .min(100, "Minimum threshold is $1.00")
      .max(1000000, "Maximum threshold is $10,000.00"),
    autoRefillAmount: z
      .number()
      .int("Amount must be in whole cents")
      .min(
        minAmountCents,
        `Minimum $${(minAmountCents / 100).toFixed(2)} required`,
      )
      .max(MAX_FUND_AMOUNT_CENTS, "Maximum $5,000.00 per refill"),
  });

// Default schema for backwards-compatible type inference
export const autoRefillSettingsSchema = createAutoRefillSettingsSchema(
  PERSONAL_STUDY_COST_CENTS,
);

export type AutoRefillSettingsInput = z.infer<typeof autoRefillSettingsSchema>;

// Validation helper
export function validateForm<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
):
  | { success: true; data: T }
  | { success: false; errors: Record<string, string> } {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const path = issue.path.join(".");
    if (!errors[path]) {
      errors[path] = issue.message;
    }
  }

  return { success: false, errors };
}
