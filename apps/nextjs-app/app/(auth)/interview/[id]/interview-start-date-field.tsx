"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Input } from "@/apps/nextjs-app/components/ui/input";
import { updateInterviewStartDate } from "@/apps/nextjs-app/lib/actions/interview-actions";

interface InterviewStartDateFieldProps {
  interviewId: string;
  initialStartDate?: string | null;
}

export function InterviewStartDateField({
  interviewId,
  initialStartDate,
}: InterviewStartDateFieldProps) {
  const [saving, setSaving] = useState(false);

  const handleChange = useCallback(
    async (value: string) => {
      setSaving(true);
      try {
        const startDate = value ? new Date(value) : null;
        const result = await updateInterviewStartDate(interviewId, startDate);
        if (!result.success) {
          toast.error(result.error || "Failed to save start date");
        }
      } catch {
        toast.error("Failed to save start date");
      } finally {
        setSaving(false);
      }
    },
    [interviewId],
  );

  return (
    <div className="mb-4">
      <p className="leading-5 font-semibold tracking-tight">Start Date</p>
      <div className="mt-1 flex items-center gap-2">
        <Input
          type="date"
          className="w-fit"
          defaultValue={
            initialStartDate
              ? new Date(initialStartDate).toISOString().split("T")[0]
              : ""
          }
          onChange={(e) => handleChange(e.target.value)}
          disabled={saving}
        />
        {saving && <Loader2 className="h-3 w-3 animate-spin text-zinc-500" />}
      </div>
    </div>
  );
}
