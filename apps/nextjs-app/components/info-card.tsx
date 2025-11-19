import { useState } from "react";
import { useIsMobile } from "@/apps/nextjs-app/hooks/use-mobile";
import { useRouter } from "next/navigation";

import {
  Card,
  CardContent,
  CardFooter,
} from "@/apps/nextjs-app/components/ui/card";
import { Textarea } from "@/apps/nextjs-app/components/ui/textarea";
import { toast } from "sonner";
import {
  updateStudyContent,
  deleteStudyContent,
  updateIssueSeverity,
} from "@/apps/nextjs-app/lib/data";
import { SeverityBadge } from "@/apps/nextjs-app/components/severity-badge";
import type { SeverityRating } from "@/apps/nextjs-app/utils/severity";

interface InfoCardProps {
  id: string;
  studyType: "cognitiveWalkthrough" | "heuristicEvaluation";
  type: "issue" | "recommendation";
  content: string;
  source: string;
  severity?: number | null;
  onEdit?: (newContent: string) => void;
  onDelete?: () => void;
  onSeverityChange?: (newSeverity: number) => void;
  isEditing?: boolean;
  onSave?: (content: string) => void;
  onCancel?: () => void;
  canManage?: boolean;
}

export function InfoCard({
  id,
  studyType,
  type,
  content,
  source: initialSource,
  severity: initialSeverity,
  onEdit,
  onDelete,
  onSeverityChange,
  isEditing: isEditingProp,
  onSave,
  onCancel,
  canManage = true,
}: InfoCardProps) {
  const router = useRouter();
  const [isEditingInternal, setIsEditingInternal] = useState(false);
  const isEditing =
    isEditingProp !== undefined ? isEditingProp : isEditingInternal;
  const [editedContent, setEditedContent] = useState(content);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [source, setSource] = useState(initialSource);
  const [severity, setSeverity] = useState(initialSeverity);
  const isMobile = useIsMobile();

  const handleEditClick = () => {
    if (!canManage) return;
    if (isEditingProp === undefined) setIsEditingInternal(true);
  };

  const handleSaveClick = async () => {
    if (!canManage && !onSave) return;
    if (onSave) {
      onSave(editedContent);
      return;
    }
    if (editedContent === content) {
      setIsEditingInternal(false);
      return;
    }
    setIsUpdating(true);
    try {
      const data = await updateStudyContent(id, studyType, type, editedContent);
      onEdit?.(editedContent);
      setIsEditingInternal(false);
      setSource(data.data.source);
      router.refresh(); // Refresh server component to update study metadata
      toast.success(`Successfully updated ${type}`);
    } catch (error) {
      console.error(`Error updating ${type}:`, error);
      toast.error(`Failed to update ${type}. Please try again.`);
      setEditedContent(content); // Reset to original content on error
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancelClick = () => {
    if (onCancel) {
      onCancel();
      return;
    }
    setIsEditingInternal(false);
    setEditedContent(content);
  };

  const handleDeleteClick = async () => {
    if (!canManage) return;
    setIsDeleting(true);
    try {
      await deleteStudyContent(id, studyType, type);
      onDelete?.();
      router.refresh(); // Refresh server component to update study metadata
      toast.success(`Successfully deleted ${type}`);
    } catch (error) {
      console.error(`Error deleting ${type}:`, error);
      toast.error(`Failed to delete ${type}. Please try again.`);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSeverityChange = async (newSeverity: SeverityRating) => {
    if (!canManage || type !== "issue") return;

    const previousSeverity = severity;
    setSeverity(newSeverity);

    try {
      await updateIssueSeverity(id, studyType, newSeverity);
      onSeverityChange?.(newSeverity);
      router.refresh(); // Refresh server component to update study metadata
      toast.success("Successfully updated severity");
    } catch (error) {
      console.error("Error updating severity:", error);
      toast.error("Failed to update severity. Please try again.");
      setSeverity(previousSeverity); // Rollback on error
    }
  };

  return (
    <Card
      className={`group relative flex h-full flex-col text-sm ${
        type === "issue"
          ? "border-0! shadow-none! print:w-full print:p-0"
          : "pt-4"
      } ${
        type === "recommendation"
          ? "print:w-full print:border-0 print:p-0 print:shadow-none"
          : ""
      }`}
    >
      <CardContent
        className={`flex-1 ${
          studyType === "cognitiveWalkthrough" && type === "issue" ? "px-0" : ""
        } ${type === "recommendation" || type === "issue" ? "print:p-0" : ""}`}
      >
        <div className={!isMobile ? "pr-8 print:pr-0" : ""}>
          {isEditing ? (
            <Textarea
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSaveClick();
                }
              }}
              className="w-full resize-none rounded-none border-0 bg-transparent p-0 shadow-none ring-0! ring-offset-0! focus:outline-hidden"
              disabled={isUpdating}
              autoFocus
            />
          ) : (
            <p>{editedContent}</p>
          )}
        </div>

        <div
          className={`flex items-center justify-between gap-2 pt-4 text-xs text-gray-500 ${
            studyType === "cognitiveWalkthrough" && type === "issue"
              ? "px-0"
              : ""
          } ${
            type === "recommendation" || type === "issue" ? "print:pt-0" : ""
          }`}
        >
          <span>
            {source === "AI"
              ? "Generated by AI"
              : source === "AI_HUMAN"
                ? "Generated by AI, edited by a human"
                : source === "HUMAN"
                  ? "Created by a human"
                  : source}
          </span>
          {type === "issue" && (
            <SeverityBadge
              severity={severity}
              onSeverityChange={canManage ? handleSeverityChange : undefined}
            />
          )}
        </div>
      </CardContent>

      {/* Controls positioned outside CardContent to avoid affecting content height */}
      {canManage && !isMobile && (
        <div className="absolute right-2 flex flex-col gap-2 opacity-0 transition-opacity group-hover:opacity-100">
          {isEditing ? (
            <>
              <button
                onClick={handleSaveClick}
                disabled={isUpdating}
                className={`text-gray-600 transition-colors hover:text-green-600 ${isUpdating ? "cursor-not-allowed opacity-50" : ""}`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  height="16"
                  viewBox="0 -960 960 960"
                  width="16"
                  fill="currentColor"
                >
                  <path d="M382-240 154-468l57-57 171 171 367-367 57 57-424 424Z" />
                </svg>
              </button>
              <button
                onClick={handleCancelClick}
                className="text-gray-600 transition-colors hover:text-red-600"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  height="16"
                  width="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleEditClick}
                className="text-gray-600 transition-colors hover:text-gray-900"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  height="16"
                  viewBox="0 -960 960 960"
                  width="16"
                  fill="currentColor"
                >
                  <path d="M200-200h57l391-391-57-57-391 391v57Zm-80 80v-170l528-527q12-11 26.5-17t30.5-6q16 0 31 6t26 18l55 56q12 11 17.5 26t5.5 30q0 16-5.5 30.5T817-647L290-120H120Zm640-584-56-56 56 56Zm-141 85-28-29 57 57-29-28Z" />
                </svg>
              </button>
              <button
                onClick={handleDeleteClick}
                disabled={isDeleting}
                className={`text-gray-600 transition-colors hover:text-red-600 ${isDeleting ? "cursor-not-allowed opacity-50" : ""}`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  height="16"
                  width="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </>
          )}
        </div>
      )}
    </Card>
  );
}
