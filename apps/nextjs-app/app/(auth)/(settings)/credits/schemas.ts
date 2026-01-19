import { z } from "zod";

// Schema for purchase credits form
export const purchaseCreditsSchema = z.object({
  teamId: z
    .string()
    .min(1, "Please select a team"),
  credits: z
    .number()
    .int("Credits must be a whole number")
    .min(1, "Minimum 1 credit required")
    .max(1000, "Maximum 1000 credits per purchase"),
});

export type PurchaseCreditsInput = z.infer<typeof purchaseCreditsSchema>;

// Schema for transfer credits form
export const transferCreditsSchema = z.object({
  fromTeamId: z
    .string()
    .min(1, "Please select a source team"),
  toTeamId: z
    .string()
    .min(1, "Please select a destination team"),
  credits: z
    .number()
    .int("Credits must be a whole number")
    .min(1, "Minimum 1 credit required")
    .max(1000, "Maximum 1000 credits per transfer"),
}).refine((data) => data.fromTeamId !== data.toTeamId, {
  message: "Source and destination teams must be different",
  path: ["toTeamId"],
});

export type TransferCreditsInput = z.infer<typeof transferCreditsSchema>;

// Schema for auto-refill settings
export const autoRefillSettingsSchema = z.object({
  teamId: z
    .string()
    .min(1, "Please select a team"),
  autoRefillEnabled: z.boolean(),
  autoRefillThreshold: z
    .number()
    .int("Threshold must be a whole number")
    .min(1, "Minimum threshold is 1 credit")
    .max(100, "Maximum threshold is 100 credits"),
  autoRefillAmount: z
    .number()
    .int("Amount must be a whole number")
    .min(1, "Minimum 1 credit required")
    .max(1000, "Maximum 1000 credits per refill"),
});

export type AutoRefillSettingsInput = z.infer<typeof autoRefillSettingsSchema>;

// Validation helper
export function validateForm<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
): { success: true; data: T } | { success: false; errors: Record<string, string> } {
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
