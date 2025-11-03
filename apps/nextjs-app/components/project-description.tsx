"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/apps/nextjs-app/components/ui/button";
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
}

export default function ProjectDescription({
  children,
  projectId,
  userId,
  updateProjectDescription,
  canEdit = true,
}: ProjectDescriptionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [newDescription, setNewDescription] = useState(children || "");
  const [isUpdating, setIsUpdating] = useState(false);

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

  const handleCancel = () => {
    setNewDescription(children || "");
    setIsEditing(false);
  };

  if (!children && !isEditing && canEdit) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsEditing(true)}
        className="text-muted-foreground mt-2 -ml-2"
      >
        Add description
      </Button>
    );
  }

  return (
    <div className="group mt-2">
      {isEditing ? (
        <div className="space-y-2">
          <Textarea
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && e.metaKey && !isUpdating) {
                handleSave();
              }
              if (e.key === "Escape") {
                handleCancel();
              }
            }}
            className="resize-none"
            rows={3}
            disabled={isUpdating}
            placeholder="Add a description..."
            autoFocus
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} disabled={isUpdating}>
              Save
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleCancel}
              disabled={isUpdating}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="relative">
          <p className="text-muted-foreground text-lg">{newDescription}</p>
          {canEdit && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-0 -right-10 hidden group-hover:inline-flex"
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
        </div>
      )}
    </div>
  );
}
