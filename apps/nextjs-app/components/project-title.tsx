"use client";

import React, { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { clientLogger } from "@/apps/nextjs-app/lib/client-logger";

interface ProjectTitleProps {
  children: string;
  projectId: string;
  userId: string;
  updateProjectTitle: (
    userId: string,
    projectId: string,
    newTitle: string,
  ) => void;
  canEdit?: boolean;
  initialEditMode?: boolean;
  placeholder?: string;
}

export default function ProjectTitle({
  children,
  projectId,
  userId,
  updateProjectTitle,
  canEdit = true,
  initialEditMode = false,
  placeholder,
}: ProjectTitleProps) {
  const [isEditing, setIsEditing] = useState(initialEditMode);
  const [newTitle, setNewTitle] = useState(children);
  const [isUpdating, setIsUpdating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setNewTitle(children);
  }, [children]);

  const handleSave = async () => {
    if (!canEdit) return;
    if (isUpdating) return;

    setIsUpdating(true);
    try {
      await updateProjectTitle(userId, projectId, newTitle);
      setIsEditing(false);
      toast.success("Project name updated successfully");
    } catch (error) {
      clientLogger.error("Error updating project name", {
        error: error instanceof Error ? error.message : String(error),
        projectId,
        userId,
        newTitle,
      });
      toast.error("Failed to update project name. Please try again.");
      setNewTitle(children);
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
    <div>
      <h1 className="inline-block scroll-m-20 text-4xl font-extrabold tracking-tight md:text-5xl">
        {isEditing ? (
          <input
            ref={inputRef}
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
            onBlur={handleBlur}
            className="w-full border-b-2 border-gray-300 bg-transparent focus:outline-hidden"
            disabled={isUpdating}
            placeholder={placeholder}
            autoFocus
          />
        ) : (
          <span
            onClick={handleClick}
            className={canEdit ? "cursor-pointer hover:opacity-70" : ""}
          >
            {newTitle}
          </span>
        )}
      </h1>
    </div>
  );
}
