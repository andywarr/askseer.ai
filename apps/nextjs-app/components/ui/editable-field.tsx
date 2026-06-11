"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/apps/nextjs-app/components/ui/button";
import { Check, X, Pencil, Loader2 } from "lucide-react";
import { cn } from "@/apps/nextjs-app/lib/utils/utils";
import { useIsMobile } from "@/apps/nextjs-app/hooks/use-mobile";
import { TranslationWrapper } from "@/apps/nextjs-app/components/i18n/translation-wrapper";

interface EditableFieldProps {
  value: string;
  canEdit: boolean;
  onSave: (newValue: string) => void;
  isSaving: boolean;
  className?: string;
  textClassName?: string;
  multiline?: boolean;
  placeholder?: string;
  sourceLocale?: string;
}

export function EditableField({
  value,
  canEdit,
  onSave,
  isSaving,
  className,
  textClassName,
  multiline = false,
  placeholder,
  sourceLocale = "en",
}: EditableFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      if (multiline && inputRef.current instanceof HTMLTextAreaElement) {
        inputRef.current.style.height = "auto";
        inputRef.current.style.height = `${inputRef.current.scrollHeight}px`;
      }
    }
  }, [isEditing, multiline]);

  const handleSave = () => {
    const trimmed = editValue.trim();
    if (trimmed === value) {
      setIsEditing(false);
      return;
    }
    onSave(trimmed);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(value);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") handleCancel();
    if (e.key === "Enter" && !multiline) handleSave();
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSave();
  };

  if (isEditing) {
    return (
      <div className={cn("flex flex-col gap-1", className)}>
        {multiline ? (
          <textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={editValue}
            onChange={(e) => {
              setEditValue(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = `${e.target.scrollHeight}px`;
            }}
            onKeyDown={handleKeyDown}
            disabled={isSaving}
            className="w-full resize-none rounded border border-zinc-300 px-2 py-1 text-sm focus:border-zinc-400 focus:outline-none"
            rows={2}
            placeholder={placeholder}
          />
        ) : (
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isSaving}
            className="w-full rounded border border-zinc-300 px-2 py-1 text-sm focus:border-zinc-400 focus:outline-none"
            placeholder={placeholder}
          />
        )}
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
            Save
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-xs"
            onClick={handleCancel}
            disabled={isSaving}
          >
            <X className="mr-1 h-3 w-3" />
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group/field relative block",
        canEdit && !isMobile && "cursor-pointer",
        className,
      )}
      onClick={() => {
        if (!canEdit) return;
        if (isMobile) return;
        const selection = window.getSelection();
        if (selection && selection.toString().length > 0) return;
        setIsEditing(true);
      }}
    >
      <span className={textClassName}>
        {value ? (
          <TranslationWrapper text={value} sourceLocale={sourceLocale} inline />
        ) : (
          <span className="italic text-zinc-400">{placeholder || ""}</span>
        )}
        {canEdit && !isMobile && (
          <span className="inline-block align-baseline pl-2">
            <Pencil className="inline h-3 w-3 text-zinc-400 opacity-0 transition-opacity group-hover/field:opacity-100 relative -top-[1px]" />
          </span>
        )}
      </span>
    </div>
  );
}
