"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/apps/nextjs-app/components/ui/card";
import { Badge } from "@/apps/nextjs-app/components/ui/badge";
import { Button } from "@/apps/nextjs-app/components/ui/button";
import { AddStudyToProjectDialog } from "@/apps/nextjs-app/components/add-study-to-project-dialog";
import { AddSectionDialog } from "@/apps/nextjs-app/components/add-section-dialog";
import SectionTitle from "@/apps/nextjs-app/components/section-title";
import ProjectTitle from "@/apps/nextjs-app/components/project-title";
import ProjectDescription from "@/apps/nextjs-app/components/project-description";
import { StudyStatus, StudyType } from "@prisma/client";
import { toast } from "sonner";
import {
  addStudyToProject,
  createSection,
  updateSection,
  updateProject,
} from "@/apps/nextjs-app/lib/data";

type ProjectStudy = {
  id: string;
  name: string | null;
  status: StudyStatus;
  type: StudyType;
  createdByUserId: string;
  createdAt: string;
  addedAt?: string;
};

type Study = {
  id: string;
  name: string | null;
  type: StudyType;
  status: StudyStatus;
  createdAt: string;
};

type Section = {
  id: string;
  title: string;
  description: string | null;
  order: number;
  createdAt: string;
  updatedAt: string;
  studies: Array<{
    studyId: string;
    addedAt: string;
    study: {
      id: string;
      name: string | null;
      status: StudyStatus;
      type: StudyType;
      createdByUserId: string;
      createdAt: string;
    };
  }>;
};

type ProjectData = {
  id: string;
  name: string;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
  teamId: string;
  createdByUserId: string;
  photoFile?: { id: string; key: string; bucket: string } | null;
  coverFile?: { id: string; key: string; bucket: string } | null;
  createdByUser?: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  sections: Section[];
  studies: ProjectStudy[];
};

interface ProjectContentProps {
  project: ProjectData;
  coverUrl: string | null;
  photoUrl: string | null;
  ownerDisplayName: string;
  createdAtFormatted: string;
  updatedAtFormatted: string;
  currentUserId: string;
  allStudies: Study[];
}

export function ProjectContent({
  project,
  coverUrl,
  photoUrl,
  ownerDisplayName,
  createdAtFormatted,
  updatedAtFormatted,
  currentUserId,
  allStudies,
}: ProjectContentProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [isAddStudyOpen, setIsAddStudyOpen] = useState(false);
  const [isAddSectionOpen, setIsAddSectionOpen] = useState(false);

  const formatDateTime = (value: string | Date) =>
    new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));

  const renderStudyLabel = (study: ProjectStudy) => {
    if (!study) return "Untitled";
    return study.name?.trim() || "Untitled";
  };

  const getStudyTypeLabel = (type: StudyType) => {
    switch (type) {
      case StudyType.HEURISTIC_EVALUATION:
        return "Evaluation";
      case StudyType.COGNITIVE_WALKTHROUGH:
        return "Walkthrough";
      case StudyType.PERSONA:
        return "Persona";
      default:
        return type;
    }
  };

  const getStudyHref = (
    study:
      | ProjectStudy
      | {
          id: string;
          type: StudyType;
        },
  ) => {
    switch (study.type) {
      case StudyType.HEURISTIC_EVALUATION:
        return `/evaluation/${study.id}`;
      case StudyType.COGNITIVE_WALKTHROUGH:
        return `/walkthrough/${study.id}`;
      case StudyType.PERSONA:
        return `/persona/${study.id}`;
      default:
        return `/studies`;
    }
  };

  // Filter out studies that are already in the project
  const projectStudyIds = new Set(project.studies.map((s) => s.id));
  const availableStudies = allStudies.filter(
    (study) => !projectStudyIds.has(study.id),
  );

  const handleAddStudy = async (studyId: string) => {
    try {
      await addStudyToProject(currentUserId, project.id, studyId);
      toast.success("Study added to project");
      setIsAddStudyOpen(false);
      router.refresh();
    } catch (error) {
      console.error("Error adding study to project:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to add study to project",
      );
    }
  };

  const handleCreateSection = async (title: string, description?: string) => {
    try {
      await createSection(currentUserId, project.id, title, description);
      toast.success("Section created");
      setIsAddSectionOpen(false);
      router.refresh();
    } catch (error) {
      console.error("Error creating section:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to create section",
      );
    }
  };

  const handleUpdateSectionTitle = async (
    userId: string,
    sectionId: string,
    newTitle: string,
  ) => {
    try {
      await updateSection(userId, sectionId, newTitle);
      router.refresh();
    } catch (error) {
      console.error("Error updating section title:", error);
      throw error; // Re-throw so SectionTitle component can handle it
    }
  };

  const handleUpdateProjectTitle = async (
    userId: string,
    projectId: string,
    newTitle: string,
  ) => {
    try {
      await updateProject(userId, projectId, newTitle);
      router.refresh();
    } catch (error) {
      console.error("Error updating project title:", error);
      throw error; // Re-throw so ProjectTitle component can handle it
    }
  };

  const handleUpdateProjectDescription = async (
    userId: string,
    projectId: string,
    newDescription: string | null,
  ) => {
    try {
      await updateProject(userId, projectId, undefined, newDescription);
      router.refresh();
    } catch (error) {
      console.error("Error updating project description:", error);
      throw error; // Re-throw so ProjectDescription component can handle it
    }
  };

  return (
    <div>
      {/* Cover Image */}
      {coverUrl && (
        <div className="relative mb-6 h-64 w-full overflow-hidden rounded-lg">
          <Image
            className="object-cover"
            src={coverUrl}
            fill
            alt={`Cover for ${project.name}`}
            priority
            unoptimized
          />
        </div>
      )}

      {/* Project Header */}
      <div className="mb-6">
        <ProjectTitle
          projectId={project.id}
          userId={currentUserId}
          updateProjectTitle={handleUpdateProjectTitle}
          canEdit={true}
        >
          {project.name}
        </ProjectTitle>
        <ProjectDescription
          projectId={project.id}
          userId={currentUserId}
          updateProjectDescription={handleUpdateProjectDescription}
          canEdit={true}
        >
          {project.description}
        </ProjectDescription>
      </div>

      {/* Project Metadata */}
      <div className="mb-8 rounded-lg bg-gray-100 p-6 text-sm">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <p className="leading-5 font-semibold tracking-tight">Created by</p>
            <p className="leading-5">{ownerDisplayName}</p>
          </div>
          <div>
            <p className="leading-5 font-semibold tracking-tight">Created on</p>
            <p className="leading-5">{createdAtFormatted}</p>
          </div>
          <div>
            <p className="leading-5 font-semibold tracking-tight">
              Last updated
            </p>
            <p className="leading-5">{updatedAtFormatted}</p>
          </div>
          <div>
            <p className="leading-5 font-semibold tracking-tight">
              Total studies
            </p>
            <p className="leading-5">{project.studies.length}</p>
          </div>
        </div>
      </div>

      {/* Studies Section */}
      <div className="mb-8">
        <div className="mb-4 flex items-center justify-end">
          <div className="flex gap-2">
            <AddSectionDialog
              open={isAddSectionOpen}
              onOpenChange={setIsAddSectionOpen}
              onSubmit={handleCreateSection}
              triggerButton={
                <Button variant="outline" size="sm">
                  Add Section
                </Button>
              }
            />
            <AddStudyToProjectDialog
              open={isAddStudyOpen}
              onOpenChange={setIsAddStudyOpen}
              onSubmit={handleAddStudy}
              availableStudies={availableStudies}
              triggerButton={<Button size="sm">Add Study</Button>}
            />
          </div>
        </div>

        {/* Sections */}
        {project.sections.map((section) => (
          <div key={section.id} className="mb-8">
            <div className="mb-4">
              <SectionTitle
                sectionId={section.id}
                userId={currentUserId}
                updateSectionTitle={handleUpdateSectionTitle}
                canEdit={true}
              >
                {section.title}
              </SectionTitle>
              {section.description && (
                <p className="text-muted-foreground mt-1 text-sm">
                  {section.description}
                </p>
              )}
            </div>
            {section.studies.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {section.studies.map(({ study, addedAt }) => (
                  <Card key={study.id} className="overflow-hidden">
                    <CardContent className="p-4">
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <h3 className="line-clamp-2 text-lg font-semibold">
                          <Link
                            href={getStudyHref(study)}
                            className="hover:underline"
                          >
                            {study.name?.trim() || "Untitled"}
                          </Link>
                        </h3>
                        <Badge variant="outline" className="shrink-0 text-xs">
                          {getStudyTypeLabel(study.type)}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            study.status === StudyStatus.COMPLETED
                              ? "default"
                              : "secondary"
                          }
                          className="text-xs"
                        >
                          {study.status}
                        </Badge>
                        {addedAt && (
                          <p className="text-muted-foreground text-xs">
                            Added {formatDateTime(addedAt)}
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="p-8 text-center">
                  <p className="text-muted-foreground">
                    No studies in this section yet.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        ))}

        {/* Studies without a section */}
        {project.studies.length > 0 && (
          <div className="mb-8">
            {project.sections.length > 0 && (
              <h3 className="mb-4 scroll-m-20 text-xl font-semibold tracking-tight">
                Uncategorized Studies
              </h3>
            )}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {project.studies.map((study) => (
                <Card key={study.id} className="overflow-hidden">
                  <CardContent className="p-4">
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <h3 className="line-clamp-2 text-lg font-semibold">
                        <Link
                          href={getStudyHref(study)}
                          className="hover:underline"
                        >
                          {renderStudyLabel(study)}
                        </Link>
                      </h3>
                      <Badge variant="outline" className="shrink-0 text-xs">
                        {getStudyTypeLabel(study.type)}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          study.status === StudyStatus.COMPLETED
                            ? "default"
                            : "secondary"
                        }
                        className="text-xs"
                      >
                        {study.status}
                      </Badge>
                      {study.addedAt && (
                        <p className="text-muted-foreground text-xs">
                          Added {formatDateTime(study.addedAt)}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {project.studies.length === 0 && project.sections.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">
                No studies have been added to this project yet.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
