"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { createProject } from "@/apps/nextjs-app/lib/data";

import { Button } from "@/apps/nextjs-app/components/ui/button";

import { ProjectCard } from "@/apps/nextjs-app/components/project-card";

import { toast } from "sonner";

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
  photoFile?: { id: string; key: string; bucket: string } | null;
  coverFile?: { id: string; key: string; bucket: string } | null;
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
  const [pending, startTransition] = useTransition();

  const studiesById = useMemo(() => {
    const map = new Map<string, StudySummary>();
    for (const study of studies) {
      map.set(study.id, study);
    }
    return map;
  }, [studies]);

  const handleCreateProject = async () => {
    startTransition(async () => {
      try {
        const created = await createProject(
          currentUserId,
          teamId,
          "Untitled",
          undefined,
          undefined,
          undefined,
        );
        if (created) {
          setProjects((prev) => [created, ...prev]);
          toast.success("Project created");
          // Navigate to the new project page with a flag to enter edit mode
          router.push(`/project/${created.id}?edit=true`);
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

  const getCoverUrl = (project: ProjectSummary) => {
    if (!project.coverFile) return null;
    return `https://${project.coverFile.bucket}.s3.amazonaws.com/${project.coverFile.key}`;
  };

  const getPhotoUrl = (project: ProjectSummary) => {
    if (!project.photoFile) return null;
    return `https://${project.photoFile.bucket}.s3.amazonaws.com/${project.photoFile.key}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="scroll-m-20 text-4xl font-extrabold tracking-tight md:text-5xl">
            Projects
          </h1>
          <p className="text-muted-foreground mt-2">
            Group related studies to organize your team&apos;s work.
          </p>
        </div>
        <Button disabled={pending} onClick={handleCreateProject}>
          New Project
        </Button>
      </div>

      {projects.length === 0 ? (
        <div className="mt-4 mb-2 text-center italic">No projects!</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => {
            const coverUrl = getCoverUrl(project);
            const photoUrl = getPhotoUrl(project);

            return (
              <ProjectCard
                key={project.id}
                project={project}
                currentUserId={currentUserId}
                teamId={teamId}
                coverUrl={coverUrl}
                photoUrl={photoUrl}
                studiesById={studiesById}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
