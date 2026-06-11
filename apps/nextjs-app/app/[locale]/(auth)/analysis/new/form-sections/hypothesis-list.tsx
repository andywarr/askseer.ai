"use client";

import { useState } from "react";
import { useFormContext } from "react-hook-form";
import { Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/apps/nextjs-app/components/ui/button";
import { Input } from "@/apps/nextjs-app/components/ui/input";
import { FormLabel } from "@/apps/nextjs-app/components/ui/form";
import type { QualAnalysisFormValues } from "@/apps/nextjs-app/lib/db/schema";

interface HypothesisListProps {
  loading: boolean;
}

export function HypothesisList({ loading }: HypothesisListProps) {
  const tc = useTranslations("StudyWizardForms.common");
  const { watch, setValue } = useFormContext<QualAnalysisFormValues>();
  const [newHypothesis, setNewHypothesis] = useState("");
  
  const hypotheses = watch("hypotheses") || [];

  const handleAddHypothesis = () => {
    const trimmed = newHypothesis.trim();
    if (!trimmed) return;
    setValue("hypotheses", [...hypotheses, trimmed], {
      shouldValidate: true,
      shouldDirty: true,
    });
    setNewHypothesis("");
  };

  const handleRemoveHypothesis = (index: number) => {
    const updated = hypotheses.filter((_, i) => i !== index);
    setValue("hypotheses", updated, {
      shouldValidate: true,
      shouldDirty: true,
    });
  };

  return (
    <div>
      <FormLabel>{tc("hypothesisLabel")}</FormLabel>
      {hypotheses.length > 0 && (
        <div className="mb-2 mt-2 space-y-2">
          {hypotheses.map((h, index) => (
            <div
              key={index}
              className="flex items-center justify-between rounded-md border px-3 py-2"
            >
              <span className="text-sm">{h}</span>
              <Button
                variant="ghost"
                size="sm"
                type="button"
                onClick={() => handleRemoveHypothesis(index)}
                disabled={loading}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
      <div className="mt-2 flex gap-2">
        <Input
          placeholder={tc("hypothesisPlaceholder")}
          value={newHypothesis}
          onChange={(e) => setNewHypothesis(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAddHypothesis();
            }
          }}
          disabled={loading}
        />
        <Button
          variant="outline"
          size="sm"
          type="button"
          onClick={handleAddHypothesis}
          disabled={loading || !newHypothesis.trim()}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
