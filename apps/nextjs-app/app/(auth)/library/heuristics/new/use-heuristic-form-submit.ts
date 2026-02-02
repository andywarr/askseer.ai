"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { newHeuristicSetSchema } from "@/apps/nextjs-app/lib/db/schema";
import {
  createHeuristicFamily,
  createHeuristic,
} from "@/apps/nextjs-app/lib/actions/heuristic-actions";
import { toast } from "sonner";

type HeuristicFormData = z.infer<typeof newHeuristicSetSchema>;

interface UseHeuristicFormSubmitOptions {
  companyId: string;
}

interface UseHeuristicFormSubmitReturn {
  handleSubmit: (data: HeuristicFormData) => Promise<void>;
  isSubmitting: boolean;
  formError: string;
  setFormError: (error: string) => void;
}

/**
 * Generates a key from text by converting to uppercase and replacing non-alphanumeric characters
 */
function generateKey(text: string): string {
  return text
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/**
 * Custom hook to handle heuristic form submission logic.
 * Extracts complex submission logic from the form component for better maintainability.
 */
export function useHeuristicFormSubmit({
  companyId,
}: UseHeuristicFormSubmitOptions): UseHeuristicFormSubmitReturn {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string>("");

  const handleSubmit = useCallback(
    async (data: HeuristicFormData) => {
      setFormError("");
      setIsSubmitting(true);

      try {
        // Generate key from name
        const generatedKey = generateKey(data.name);

        // First create the heuristic family
        const familyData = await createHeuristicFamily({
          name: data.name,
          key: generatedKey,
          description: data.description || undefined,
          companyId,
        });

        if (!familyData.success || !familyData.data) {
          throw new Error(
            (!familyData.success && familyData.error) ||
              "Failed to add heuristics",
          );
        }

        const familyId = familyData.data.id;

        // Create all heuristics in parallel for better performance
        const heuristicResults = await Promise.allSettled(
          data.heuristics.map((heuristic) =>
            createHeuristic({
              heuristicFamilyId: familyId,
              label: heuristic.label,
              category: heuristic.category,
              heuristic: heuristic.heuristic,
              companyId,
            }),
          ),
        );

        // Log any failures but don't block success
        const failures = heuristicResults.filter(
          (result) => result.status === "rejected",
        );
        if (failures.length > 0) {
          console.error(`Failed to create ${failures.length} heuristic(s)`);
        }

        toast.success("Heuristics added successfully");
        router.push("/library");
        router.refresh();
      } catch (error) {
        console.error("Error adding heuristics:", error);
        setFormError(
          error instanceof Error ? error.message : "Failed to add heuristics",
        );
      } finally {
        setIsSubmitting(false);
      }
    },
    [companyId, router],
  );

  return {
    handleSubmit,
    isSubmitting,
    formError,
    setFormError,
  };
}
