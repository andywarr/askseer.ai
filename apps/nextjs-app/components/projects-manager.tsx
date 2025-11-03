"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { createProject } from "@/apps/nextjs-app/lib/data";
import { getProjectImagePutUrl } from "@/apps/nextjs-app/lib/action";

import { Button } from "@/apps/nextjs-app/components/ui/button";
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
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const studiesById = useMemo(() => {
    const map = new Map<string, StudySummary>();
    for (const study of studies) {
      map.set(study.id, study);
    }
    return map;
  }, [studies]);

  const handleCreateProject = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    if (!newName.trim()) {
      toast.error("Project name is required");
      return;
    }
    startTransition(async () => {
      try {
        // Upload images if provided
        let photoKey: string | undefined;
        let coverKey: string | undefined;

        if (photoFile) {
          const { uploadURL, key } = await getProjectImagePutUrl(
            teamId,
            photoFile.name,
            photoFile.type,
            photoFile.size,
            "photo",
          );
          const res = await fetch(uploadURL, {
            method: "PUT",
            headers: { "Content-Type": photoFile.type },
            body: photoFile,
          });
          if (!res.ok) throw new Error("Failed to upload photo");
          photoKey = key;
        }

        if (coverFile) {
          const { uploadURL, key } = await getProjectImagePutUrl(
            teamId,
            coverFile.name,
            coverFile.type,
            coverFile.size,
            "cover",
          );
          const res = await fetch(uploadURL, {
            method: "PUT",
            headers: { "Content-Type": coverFile.type },
            body: coverFile,
          });
          if (!res.ok) throw new Error("Failed to upload cover");
          coverKey = key;
        }

        const created = await createProject(
          currentUserId,
          teamId,
          newName.trim(),
          newDescription.trim() || undefined,
          photoKey,
          coverKey,
        );
        if (created) {
          setProjects((prev) => [created, ...prev]);
          toast.success("Project created");
          setIsCreateOpen(false);
          setNewName("");
          setNewDescription("");
          setPhotoFile(null);
          setCoverFile(null);
          setPhotoPreview(null);
          setCoverPreview(null);
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
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button disabled={pending}>New Project</Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleCreateProject}>
              <DialogHeader>
                <DialogTitle>Create a project</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
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
                <div className="grid gap-2">
                  <label
                    className="text-sm font-medium"
                    htmlFor="project-description"
                  >
                    Description{" "}
                    <span className="text-muted-foreground">(optional)</span>
                  </label>
                  <Textarea
                    id="project-description"
                    value={newDescription}
                    onChange={(event) => setNewDescription(event.target.value)}
                    placeholder="Describe this project"
                    rows={3}
                  />
                </div>

                {/* Photo upload */}
                <div className="grid gap-2">
                  <label className="text-sm font-medium">
                    Photo{" "}
                    <span className="text-muted-foreground">(optional)</span>
                  </label>
                  <div className="flex items-center gap-3">
                    <div className="h-16 w-16 overflow-hidden rounded-full border bg-zinc-100 dark:border-zinc-800">
                      {photoPreview ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={photoPreview}
                          alt="Preview"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs text-zinc-400">
                          No photo
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        id="project-photo-input"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (!f) return;
                          setPhotoFile(f);
                          setPhotoPreview((prev) => {
                            if (prev) URL.revokeObjectURL(prev);
                            return URL.createObjectURL(f);
                          });
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                          document
                            .getElementById("project-photo-input")
                            ?.click()
                        }
                      >
                        {photoFile ? "Change" : "Upload"}
                      </Button>
                      {photoFile && (
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => {
                            setPhotoFile(null);
                            setPhotoPreview(null);
                          }}
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Cover upload */}
                <div className="grid gap-2">
                  <label className="text-sm font-medium">
                    Cover image{" "}
                    <span className="text-muted-foreground">(optional)</span>
                  </label>
                  <div className="flex items-center gap-3">
                    <div className="h-16 w-32 overflow-hidden rounded-md border bg-zinc-100 dark:border-zinc-800">
                      {coverPreview ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={coverPreview}
                          alt="Preview"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs text-zinc-400">
                          No cover
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        id="project-cover-input"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (!f) return;
                          setCoverFile(f);
                          setCoverPreview((prev) => {
                            if (prev) URL.revokeObjectURL(prev);
                            return URL.createObjectURL(f);
                          });
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                          document
                            .getElementById("project-cover-input")
                            ?.click()
                        }
                      >
                        {coverFile ? "Change" : "Upload"}
                      </Button>
                      {coverFile && (
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => {
                            setCoverFile(null);
                            setCoverPreview(null);
                          }}
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
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
