"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/apps/nextjs-app/components/ui/button";
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
}

export default function ProjectTitle({
  children,
  projectId,
  userId,
  updateProjectTitle,
  canEdit = true,
}: ProjectTitleProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [newTitle, setNewTitle] = useState(children);
  const [isUpdating, setIsUpdating] = useState(false);

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

  return (
    <div className="group flex items-center">
      <h1 className="inline-block scroll-m-20 text-4xl font-extrabold tracking-tight md:text-5xl">
        {isEditing ? (
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !isUpdating) {
                handleSave();
              }
            }}
            className="w-full border-b-2 border-gray-300 bg-transparent focus:outline-hidden"
            disabled={isUpdating}
            autoFocus
          />
        ) : (
          newTitle
        )}
      </h1>
      {canEdit && !isEditing && (
        <Button
          variant="ghost"
          size="icon"
          className="ml-4 hidden group-hover:inline-flex"
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
