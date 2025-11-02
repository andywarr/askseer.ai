"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  addStudyToProject,
  removeStudyFromProject,
} from "@/apps/nextjs-app/lib/data";

import { Button } from "@/apps/nextjs-app/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/apps/nextjs-app/components/ui/select";
import { Badge } from "@/apps/nextjs-app/components/ui/badge";

import { toast } from "sonner";
import { X } from "lucide-react";

import { cn } from "@/apps/nextjs-app/lib/utils";

type ProjectSummary = {
  id: string;
  name: string;
};

interface StudyProjectsManagerProps {
  studyId: string;
  currentUserId: string;
  teamId: string;
  projects: ProjectSummary[];
  assigned: ProjectSummary[];
}

export function StudyProjectsManager({
  studyId,
  currentUserId,
  teamId,
  projects,
  assigned,
}: StudyProjectsManagerProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [assignedProjects, setAssignedProjects] = useState<ProjectSummary[]>(
    assigned,
  );

  const availableProjects = useMemo(() => {
    const assignedIds = new Set(assignedProjects.map((project) => project.id));
    return projects.filter((project) => !assignedIds.has(project.id));
  }, [projects, assignedProjects]);

  const updateAssignments = (next: ProjectSummary[]) => {
    setAssignedProjects(next);
  };

  const handleAdd = () => {
    if (!selectedProjectId) {
      toast.error("Select a project to add");
      return;
    }

    startTransition(async () => {
      try {
        const updated = await addStudyToProject(
          currentUserId,
          selectedProjectId,
          studyId,
        );
        if (updated) {
          const summary = { id: updated.id, name: updated.name };
          updateAssignments([...assignedProjects, summary]);
          toast.success("Study added to project");
          setSelectedProjectId("");
          router.refresh();
        }
      } catch (error: any) {
        toast.error(error?.message || "Failed to add to project");
      }
    });
  };

  const handleRemove = (projectId: string) => {
    startTransition(async () => {
      try {
        await removeStudyFromProject(currentUserId, projectId, studyId);
        updateAssignments(
          assignedProjects.filter((project) => project.id !== projectId),
        );
        toast.success("Study removed from project");
        router.refresh();
      } catch (error: any) {
        toast.error(error?.message || "Failed to remove from project");
      }
    });
  };

  if (!teamId) {
    return null;
  }

  return (
    <div className="space-y-3 rounded-lg border bg-card p-4">
      <div>
        <h2 className="text-base font-semibold">Projects</h2>
        <p className="text-sm text-muted-foreground">
          Add this study to one or more projects for your team.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {assignedProjects.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Not part of any project yet.
          </p>
        ) : (
          assignedProjects.map((project) => (
            <Badge
              key={project.id}
              variant="secondary"
              className="flex items-center gap-1"
            >
              <span>{project.name}</span>
              <button
                type="button"
                aria-label={`Remove from ${project.name}`}
                className={cn(
                  "flex h-4 w-4 items-center justify-center rounded-full",
                  "bg-muted hover:bg-muted-foreground/20",
                )}
                onClick={() => handleRemove(project.id)}
                disabled={pending}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2 md:flex-nowrap">
        <Select
          value={selectedProjectId}
          onValueChange={(value) => setSelectedProjectId(value)}
        >
          <SelectTrigger className="w-full md:w-auto md:flex-1">
            <SelectValue placeholder="Select a project" />
          </SelectTrigger>
          <SelectContent>
            {availableProjects.length === 0 ? (
              <SelectItem value="" disabled>
                No available projects
              </SelectItem>
            ) : (
              availableProjects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="secondary"
          onClick={handleAdd}
          disabled={pending || availableProjects.length === 0}
        >
          Add to project
        </Button>
      </div>
    </div>
  );
}

