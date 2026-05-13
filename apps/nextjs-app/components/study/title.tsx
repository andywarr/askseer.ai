"use client";

// React function imports
import React, { useState, useEffect } from "react";

// UI component imports
import { Button } from "@/apps/nextjs-app/components/ui/button";
import { toast } from "sonner";
import { clientLogger } from "@/apps/nextjs-app/lib/utils/client-logger";
import { cn } from "@/apps/nextjs-app/lib/utils/utils";
import { useIsMobile } from "@/apps/nextjs-app/hooks/use-mobile";

interface TitleProps {
  children: string;
  studyId: string;
  userId: string;
  updateStudyName: (userId: string, studyId: string, newTitle: string) => void;
  canEdit?: boolean;
}

export default function Title({
  children,
  studyId,
  userId,
  updateStudyName,
  canEdit = true,
}: TitleProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [newTitle, setNewTitle] = useState(children);
  const [isUpdating, setIsUpdating] = useState(false);
  const isMobile = useIsMobile();

  // Update newTitle when children prop changes
  useEffect(() => {
    setNewTitle(children);
  }, [children]);

  const handleSave = async () => {
    if (!canEdit) return;
    if (isUpdating) return;

    setIsUpdating(true);
    try {
      await updateStudyName(userId, studyId, newTitle);
      setIsEditing(false);
      toast.success("Study name updated successfully");
    } catch (error) {
      clientLogger.error("Error updating study name", {
        error: error instanceof Error ? error.message : String(error),
        studyId,
        userId,
        newTitle,
      });
      toast.error("Failed to update study name. Please try again.");
      // Reset the title to the original value on error
      setNewTitle(children);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="group flex w-full items-center">
      <h2
        className={cn(
          "min-w-0 scroll-m-20 text-3xl font-semibold tracking-tight first:mt-0",
          isEditing && "flex-1",
        )}
      >
        {isEditing ? (
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !isUpdating) {
                handleSave();
              }
              if (e.key === "Escape") {
                setNewTitle(children);
                setIsEditing(false);
              }
            }}
            onBlur={() => {
              if (newTitle !== children) {
                handleSave();
              } else {
                setIsEditing(false);
              }
            }}
            autoFocus
            className="w-full border-b-2 border-gray-300 focus:outline-hidden"
            disabled={isUpdating}
          />
        ) : (
          <span
            className={canEdit && !isMobile ? "cursor-pointer" : undefined}
            onClick={() => canEdit && !isMobile && setIsEditing(true)}
          >
            {newTitle}
          </span>
        )}
      </h2>
      {canEdit && !isMobile && !isEditing && (
        <Button
          variant="ghost"
          size="icon"
          className="invisible ml-1 shrink-0 group-hover:visible"
          onClick={() => setIsEditing(true)}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            height="h-4"
            viewBox="0 -960 960 960"
            width="h-4"
            fill="currentColor"
          >
            <path d="M200-200h57l391-391-57-57-391 391v57Zm-80 80v-170l528-527q12-11 26.5-17t30.5-6q16 0 31 6t26 18l55 56q12 11 17.5 26t5.5 30q0 16-5.5 30.5T817-647L290-120H120Zm640-584-56-56 56 56Zm-141 85-28-29 57 57-29-28Z" />
          </svg>
        </Button>
      )}
      {canEdit && isEditing && (
        <Button
          variant="ghost"
          size="icon"
          onClick={handleSave}
          disabled={isUpdating}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            height="h-4"
            viewBox="0 -960 960 960"
            width="h-4"
            fill="#currentColor"
          >
            <path d="M382-240 154-468l57-57 171 171 367-367 57 57-424 424Z" />
          </svg>
        </Button>
      )}
    </div>
  );
}
