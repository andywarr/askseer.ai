import { useState } from "react";

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
} from "@/apps/nextjs-app/lib/data";

interface InfoCardProps {
  id: string;
  studyType: "cognitiveWalkthrough" | "heuristicEvaluation";
  type: "issue" | "recommendation";
  content: string;
  source: string;
  onEdit?: (newContent: string) => void;
  onDelete?: () => void;
}

export function InfoCard({
  id,
  studyType,
  type,
  content,
  source: initialSource,
  onEdit,
  onDelete,
}: InfoCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(content);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [source, setSource] = useState(initialSource);

  const handleEditClick = () => {
    setIsEditing(true);
  };

  const handleSaveClick = async () => {
    if (editedContent === content) {
      setIsEditing(false);
      return;
    }

    setIsUpdating(true);
    try {
      const data = await updateStudyContent(id, studyType, type, editedContent);
      onEdit?.(editedContent);
      setIsEditing(false);
      setSource(data.data.source);
      toast.success("Successfully updated content");
    } catch (error) {
      console.error("Error updating content:", error);
      toast.error("Failed to update content. Please try again.");
      setEditedContent(content); // Reset to original content on error
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteClick = async () => {
    setIsDeleting(true);
    try {
      await deleteStudyContent(id, studyType, type);
      onDelete?.();
      toast.success("Successfully deleted content");
    } catch (error) {
      console.error("Error deleting content:", error);
      toast.error("Failed to delete content. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSaveClick();
    }
  };

  return (
    <Card
      className={`group relative ${type === "issue" ? "!border-0 !shadow-none" : "!border-0"}`}
    >
      <CardContent className={`p-4 ${type === "issue" ? "pt-0 text-lg" : ""}`}>
        <div className="flex items-start">
          <div className="flex-1">
            {isEditing ? (
              <Textarea
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full resize-none rounded-none border-0 bg-transparent p-0 shadow-none !ring-0 !ring-offset-0 focus:outline-none"
                disabled={isUpdating}
                autoFocus
              />
            ) : (
              <p>{editedContent}</p>
            )}
          </div>
          <div className="ml-4 flex flex-col gap-2 opacity-0 transition-opacity group-hover:opacity-100">
            {isEditing ? (
              <button
                onClick={handleSaveClick}
                disabled={isUpdating}
                className={`text-gray-600 transition-colors hover:text-green-600 ${
                  isUpdating ? "cursor-not-allowed opacity-50" : ""
                }`}
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
                  className={`text-gray-600 transition-colors hover:text-red-600 ${
                    isDeleting ? "cursor-not-allowed opacity-50" : ""
                  }`}
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
        </div>
      </CardContent>
      <CardFooter className={`p-4 pt-0 text-xs text-gray-500`}>
        Generated by {source === "AI_HUMAN" ? "AI, edited by a human" : source}
      </CardFooter>
    </Card>
  );
}
