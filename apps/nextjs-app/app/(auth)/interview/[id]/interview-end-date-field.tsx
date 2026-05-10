"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Input } from "@/apps/nextjs-app/components/ui/input";
import { updateInterviewEndDate } from "@/apps/nextjs-app/lib/actions/interview-actions";

interface InterviewEndDateFieldProps {
  interviewId: string;
  initialEndDate?: string | null;
}

export function InterviewEndDateField({
  interviewId,
  initialEndDate,
}: InterviewEndDateFieldProps) {
  const [saving, setSaving] = useState(false);
  const today = new Date().toISOString().split("T")[0];

  const handleChange = useCallback(
    async (value: string) => {
      setSaving(true);
      try {
        const endDate = value ? new Date(value) : null;
        const result = await updateInterviewEndDate(interviewId, endDate);
        if (!result.success) {
          toast.error(result.error || "Failed to save end date");
        }
      } catch {
        toast.error("Failed to save end date");
      } finally {
        setSaving(false);
      }
    },
    [interviewId],
  );

  return (
    <div className="mb-4">
      <p className="leading-5 font-semibold tracking-tight">End Date</p>
      <div className="mt-1 flex items-center gap-2">
        <Input
          type="date"
          className="w-fit"
          defaultValue={
            initialEndDate
              ? new Date(initialEndDate).toISOString().split("T")[0]
              : ""
          }
          min={today}
          onChange={(e) => handleChange(e.target.value)}
          disabled={saving}
        />
        {saving && <Loader2 className="h-3 w-3 animate-spin text-zinc-500" />}
      </div>
    </div>
  );
}
