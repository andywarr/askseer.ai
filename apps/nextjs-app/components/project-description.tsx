"use client";

import React, { useState, useEffect, useRef } from "react";
import { Textarea } from "@/apps/nextjs-app/components/ui/textarea";
import { toast } from "sonner";
import { clientLogger } from "@/apps/nextjs-app/lib/client-logger";

interface ProjectDescriptionProps {
  children: string | null | undefined;
  projectId: string;
  userId: string;
  updateProjectDescription: (
    userId: string,
    projectId: string,
    newDescription: string | null,
  ) => void;
  canEdit?: boolean;
  placeholder?: string;
}

export default function ProjectDescription({
  children,
  projectId,
  userId,
  updateProjectDescription,
  canEdit = true,
  placeholder = "Add a description...",
}: ProjectDescriptionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [newDescription, setNewDescription] = useState(children || "");
  const [isUpdating, setIsUpdating] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setNewDescription(children || "");
  }, [children]);

  const handleSave = async () => {
    if (!canEdit) return;
    if (isUpdating) return;

    setIsUpdating(true);
    try {
      const trimmed = newDescription.trim();
      await updateProjectDescription(userId, projectId, trimmed || null);
      setIsEditing(false);
      toast.success("Project description updated successfully");
    } catch (error) {
      clientLogger.error("Error updating project description", {
        error: error instanceof Error ? error.message : String(error),
        projectId,
        userId,
      });
      toast.error("Failed to update project description. Please try again.");
      setNewDescription(children || "");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleBlur = () => {
    if (isEditing && !isUpdating) {
      handleSave();
    }
  };

  const handleClick = () => {
    if (canEdit && !isEditing) {
      setIsEditing(true);
    }
  };

  return (
    <div className="mt-2">
      {isEditing ? (
        <Textarea
          ref={textareaRef}
          value={newDescription}
          onChange={(e) => setNewDescription(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && e.metaKey && !isUpdating) {
              handleSave();
            }
            if (e.key === "Escape") {
              setNewDescription(children || "");
              setIsEditing(false);
            }
          }}
          onBlur={handleBlur}
          className="resize-none"
          rows={3}
          disabled={isUpdating}
          placeholder={placeholder}
          autoFocus
        />
      ) : (
        <p
          onClick={handleClick}
          className={`text-muted-foreground text-lg ${
            canEdit ? "cursor-pointer hover:opacity-70" : ""
          } ${!newDescription && canEdit ? "italic" : ""}`}
        >
          {newDescription || placeholder}
        </p>
      )}
    </div>
  );
}
