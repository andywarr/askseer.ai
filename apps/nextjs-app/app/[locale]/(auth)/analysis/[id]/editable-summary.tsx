"use client";

import { useState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/apps/nextjs-app/components/ui/button";
import {
  Pencil,
  Check,
  X,
  Loader2,
  Bot,
  UserPen,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { clientLogger } from "@/apps/nextjs-app/lib/utils/client-logger";
import type { ActionResult } from "@/apps/nextjs-app/lib/actions/shared";
import { useIsMobile } from "@/apps/nextjs-app/hooks/use-mobile";
import { TranslationWrapper } from "@/apps/nextjs-app/components/i18n/translation-wrapper";

interface EditableSummaryProps {
  summary: string;
  summarySource: string;
  qualitativeAnalysisId: string;
  userId: string;
  studyId: string;
  canEdit: boolean;
  updateSummary: (
    qualitativeAnalysisId: string,
    summary: string,
    userId: string,
    studyId: string,
  ) => Promise<ActionResult>;
  studyLocale?: string;
}

export function EditableSummary({
  summary,
  summarySource,
  qualitativeAnalysisId,
  userId,
  studyId,
  canEdit,
  updateSummary,
  studyLocale = "en",
}: EditableSummaryProps) {
  const t = useTranslations("AnalysisDetail");
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(summary);
  const [currentSummary, setCurrentSummary] = useState(summary);
  const [isSaving, setIsSaving] = useState(false);
  const [currentSource, setCurrentSource] = useState(summarySource);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      // Auto-resize on mount
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [isEditing]);

  const handleSave = async () => {
    if (isSaving) return;

    const trimmed = editValue.trim();
    if (trimmed === currentSummary) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      const result = await updateSummary(
        qualitativeAnalysisId,
        trimmed,
        userId,
        studyId,
      );

      if (result.success) {
        setCurrentSummary(trimmed);
        setCurrentSource("AI_HUMAN");
        setIsEditing(false);
        toast.success(t("summaryUpdated"));
      } else {
        toast.error(result.error || t("failedUpdateSummary"));
      }
    } catch (error) {
      clientLogger.error("Error updating analysis summary", {
        error: error instanceof Error ? error.message : String(error),
        qualitativeAnalysisId,
      });
      toast.error(t("failedUpdateSummaryRetry"));
      setEditValue(currentSummary);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditValue(currentSummary);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      handleCancel();
    }
    // Cmd/Ctrl + Enter to save
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      handleSave();
    }
  };

  return (
    <div className="mb-8">
      <div className="mb-3">
        <h3 className="scroll-m-20 text-2xl font-semibold tracking-tight">
          {t("summary")}
        </h3>
      </div>

      {isEditing ? (
        <div className="flex flex-col gap-1">
          <textarea
            ref={textareaRef}
            value={editValue}
            onChange={(e) => {
              setEditValue(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = `${e.target.scrollHeight}px`;
            }}
            onKeyDown={handleKeyDown}
            disabled={isSaving}
            className="w-full resize-none rounded border border-zinc-300 px-2 py-1 text-sm leading-relaxed whitespace-pre-wrap focus:border-zinc-400 focus:outline-none"
            rows={4}
          />
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-xs"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : (
                <Check className="mr-1 h-3 w-3" />
              )}
              {t("save")}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-xs"
              onClick={handleCancel}
              disabled={isSaving}
            >
              <X className="mr-1 h-3 w-3" />
              {t("cancel")}
            </Button>
          </div>
        </div>
      ) : (
        <div
          className={`group/field relative ${canEdit && !isMobile ? "cursor-pointer" : ""}`}
          onClick={() => {
            if (!canEdit) return;
            if (isMobile) return;
            const selection = window.getSelection();
            if (selection && selection.toString().length > 0) return;
            setIsEditing(true);
          }}
        >
          <div className="border-l-4 border-zinc-300 pl-4 leading-relaxed whitespace-pre-wrap">
            {currentSummary ? (
              <TranslationWrapper text={currentSummary} sourceLocale={studyLocale} />
            ) : (
              t("noSummary")
            )}
            {canEdit && !isMobile && (
              <Pencil className="ml-1.5 inline h-3 w-3 text-zinc-400 opacity-0 transition-opacity group-hover/field:opacity-100" />
            )}
          </div>
          <div className="mt-3">
            <SummarySourceLabel source={currentSource} />
          </div>
        </div>
      )}
    </div>
  );
}

function SummarySourceLabel({ source }: { source: string }) {
  const t = useTranslations("AnalysisDetail");
  switch (source) {
    case "AI":
      return (
        <span className="flex items-center gap-1.5 text-xs text-zinc-400">
          <Bot className="h-3.5 w-3.5" />
          {t("generatedByAI")}
        </span>
      );
    case "AI_HUMAN":
      return (
        <span className="flex items-center gap-1.5 text-xs text-zinc-400">
          <UserPen className="h-3.5 w-3.5" />
          {t("generatedByAIAccent")}
        </span>
      );
    case "HUMAN":
      return (
        <span className="flex items-center gap-1.5 text-xs text-zinc-400">
          <UserPlus className="h-3.5 w-3.5" />
          {t("createdByHuman")}
        </span>
      );
    default:
      return null;
  }
}
