"use client";

import { useState } from "react";
import { useFormContext } from "react-hook-form";
import { Plus, X } from "lucide-react";
import { Button } from "@/apps/nextjs-app/components/ui/button";
import { Input } from "@/apps/nextjs-app/components/ui/input";
import { FormLabel } from "@/apps/nextjs-app/components/ui/form";
import type { AnalyzeFormValues } from "@/apps/nextjs-app/lib/db/schema";

interface QuestionsListProps {
  loading: boolean;
}

export function QuestionsList({ loading }: QuestionsListProps) {
  const { watch, setValue } = useFormContext<AnalyzeFormValues>();
  const [newQuestion, setNewQuestion] = useState("");
  
  const researchQuestions = watch("researchQuestions") || [];

  const handleAddQuestion = () => {
    const trimmed = newQuestion.trim();
    if (!trimmed) return;
    setValue("researchQuestions", [...researchQuestions, trimmed], {
      shouldValidate: true,
      shouldDirty: true,
    });
    setNewQuestion("");
  };

  const handleRemoveQuestion = (index: number) => {
    const updated = researchQuestions.filter((_, i) => i !== index);
    setValue("researchQuestions", updated, {
      shouldValidate: true,
      shouldDirty: true,
    });
  };

  return (
    <div>
      <FormLabel>What specific questions are you investigating?</FormLabel>
      {researchQuestions.length > 0 && (
        <div className="mb-2 mt-2 space-y-2">
          {researchQuestions.map((q, index) => (
            <div
              key={index}
              className="flex items-center justify-between rounded-md border px-3 py-2"
            >
              <span className="text-sm">{q}</span>
              <Button
                variant="ghost"
                size="sm"
                type="button"
                onClick={() => handleRemoveQuestion(index)}
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
          placeholder="e.g., What are the primary friction points in onboarding?"
          value={newQuestion}
          onChange={(e) => setNewQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAddQuestion();
            }
          }}
          disabled={loading}
        />
        <Button
          variant="outline"
          size="sm"
          type="button"
          onClick={handleAddQuestion}
          disabled={loading || !newQuestion.trim()}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
