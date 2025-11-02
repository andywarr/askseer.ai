"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  addStudyToProject,
  createProject,
  removeStudyFromProject,
} from "@/apps/nextjs-app/lib/data";

import { Button } from "@/apps/nextjs-app/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/apps/nextjs-app/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/apps/nextjs-app/components/ui/dialog";
import { Input } from "@/apps/nextjs-app/components/ui/input";
import { Textarea } from "@/apps/nextjs-app/components/ui/textarea";
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

import { StudyStatus, StudyType } from "@prisma/client";

type ProjectStudy = {
  id: string;
  name: string | null;
  status: StudyStatus;
  type: StudyType;
  createdByUserId: string;
  createdAt: string;
  addedAt?: string;
};

type ProjectSummary = {
  id: string;
  name: string;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
  studies: ProjectStudy[];
};

type StudySummary = {
  id: string;
  name: string | null;
  status: StudyStatus;
  type: StudyType;
  createdByUserId: string;
};

interface ProjectsManagerProps {
  projects: ProjectSummary[];
  studies: StudySummary[];
  currentUserId: string;
  teamId: string;
}

export function ProjectsManager({
  projects: initialProjects,
  studies,
  currentUserId,
  teamId,
}: ProjectsManagerProps) {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectSummary[]>(initialProjects);
  const [selectedStudy, setSelectedStudy] = useState<Record<string, string>>({});
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [pending, startTransition] = useTransition();

  const studiesById = useMemo(() => {
    const map = new Map<string, StudySummary>();
    for (const study of studies) {
      map.set(study.id, study);
    }
    return map;
  }, [studies]);

  const handleCreateProject = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newName.trim()) {
      toast.error("Project name is required");
      return;
    }
    startTransition(async () => {
      try {
        const created = await createProject(
          currentUserId,
          teamId,
          newName.trim(),
          newDescription.trim() || undefined,
        );
        if (created) {
          setProjects((prev) => [created, ...prev]);
          toast.success("Project created");
          setIsCreateOpen(false);
          setNewName("");
          setNewDescription("");
          router.refresh();
        }
      } catch (error: any) {
        toast.error(error?.message || "Failed to create project");
      }
    });
  };

  const updateProjectState = (updated: ProjectSummary) => {
    setProjects((prev) => {
      const index = prev.findIndex((project) => project.id === updated.id);
      if (index === -1) {
        return [updated, ...prev];
      }
      const next = [...prev];
      next[index] = updated;
      return next;
    });
  };

  const handleAddStudy = (projectId: string) => {
    const studyId = selectedStudy[projectId];
    if (!studyId) {
      toast.error("Select a study to add");
      return;
    }
    startTransition(async () => {
      try {
        const updated = await addStudyToProject(
          currentUserId,
          projectId,
          studyId,
        );
        if (updated) {
          updateProjectState(updated);
          setSelectedStudy((prev) => ({ ...prev, [projectId]: "" }));
          toast.success("Study added to project");
          router.refresh();
        }
      } catch (error: any) {
        toast.error(error?.message || "Failed to add study to project");
      }
    });
  };

  const handleRemoveStudy = (projectId: string, studyId: string) => {
    startTransition(async () => {
      try {
        const updated = await removeStudyFromProject(
          currentUserId,
          projectId,
          studyId,
        );
        if (updated) {
          updateProjectState(updated);
          toast.success("Study removed from project");
          router.refresh();
        }
      } catch (error: any) {
        toast.error(error?.message || "Failed to remove study from project");
      }
    });
  };

  const getAvailableStudies = (project: ProjectSummary) => {
    const assignedIds = new Set(project.studies.map((study) => study.id));
    return studies.filter((study) => !assignedIds.has(study.id));
  };

  const renderStudyLabel = (study: StudySummary | ProjectStudy) => {
    if (!study) return "Untitled";
    return study.name?.trim() || "Untitled";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="scroll-m-20 text-3xl font-semibold tracking-tight">
            Projects
          </h1>
          <p className="text-muted-foreground">
            Group related studies to organize your team&apos;s work.
          </p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button disabled={pending}>New Project</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create a project</DialogTitle>
            </DialogHeader>
            <form className="space-y-4" onSubmit={handleCreateProject}>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="project-name">
                  Name
                </label>
                <Input
                  id="project-name"
                  value={newName}
                  onChange={(event) => setNewName(event.target.value)}
                  placeholder="My project"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <label
                  className="text-sm font-medium"
                  htmlFor="project-description"
                >
                  Description <span className="text-muted-foreground">(optional)</span>
                </label>
                <Textarea
                  id="project-description"
                  value={newDescription}
                  onChange={(event) => setNewDescription(event.target.value)}
                  placeholder="Describe this project"
                  rows={3}
                />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={pending}>
                  Create project
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {projects.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No projects yet</CardTitle>
            <CardDescription>
              Create a project to start grouping your studies.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => {
            const availableStudies = getAvailableStudies(project);
            const selectionValue = selectedStudy[project.id] || "";

            return (
              <Card key={project.id} className="flex flex-col">
                <CardHeader>
                  <CardTitle className="text-xl font-semibold">
                    {project.name}
                  </CardTitle>
                  {project.description && (
                    <CardDescription>{project.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-4">
                  <div className="space-y-2">
                    <div className="text-sm font-medium text-muted-foreground">
                      Studies
                    </div>
                    {project.studies.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No studies added yet.
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {project.studies.map((study) => {
                          const fullStudy = studiesById.get(study.id) || study;
                          return (
                            <Badge
                              key={study.id}
                              variant="secondary"
                              className="flex items-center gap-1"
                            >
                              <span>{renderStudyLabel(fullStudy)}</span>
                              <button
                                type="button"
                                aria-label="Remove study from project"
                                className={cn(
                                  "flex h-4 w-4 items-center justify-center rounded-full",
                                  "bg-muted hover:bg-muted-foreground/20",
                                )}
                                onClick={() => handleRemoveStudy(project.id, study.id)}
                                disabled={pending}
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </Badge>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="text-sm font-medium text-muted-foreground">
                      Add a study
                    </div>
                    <div className="flex items-center gap-2">
                      <Select
                        value={selectionValue}
                        onValueChange={(value) =>
                          setSelectedStudy((prev) => ({
                            ...prev,
                            [project.id]: value,
                          }))
                        }
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Choose a study" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableStudies.length === 0 ? (
                            <SelectItem value="" disabled>
                              No available studies
                            </SelectItem>
                          ) : (
                            availableStudies.map((study) => (
                              <SelectItem key={study.id} value={study.id}>
                                {renderStudyLabel(study)}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => handleAddStudy(project.id)}
                        disabled={pending || availableStudies.length === 0}
                      >
                        Add
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

