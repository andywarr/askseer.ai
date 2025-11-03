"use client";

import Link from "next/link";
import Image from "next/image";

import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/apps/nextjs-app/components/ui/card";
import { Skeleton } from "@/apps/nextjs-app/components/ui/skeleton";
import { Badge } from "@/apps/nextjs-app/components/ui/badge";
import { Button } from "@/apps/nextjs-app/components/ui/button";

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

interface ProjectCardProps {
  project: ProjectSummary;
  currentUserId: string;
  teamId: string;
  coverUrl?: string | null;
  photoUrl?: string | null;
  className?: string;
  imageClassName?: string;
  imagePriority?: boolean;
  studiesById: Map<string, StudySummary>;
}

export function ProjectCard({
  project,
  currentUserId,
  teamId,
  coverUrl,
  photoUrl,
  className,
  imageClassName,
  imagePriority,
  studiesById,
}: ProjectCardProps) {
  const renderStudyLabel = (study: StudySummary | ProjectStudy) => {
    if (!study) return "Untitled";
    return study.name?.trim() || "Untitled";
  };

  return (
    <Card className={cn("w-full gap-3 overflow-hidden pt-0 pb-6", className)}>
      <CardHeader className={cn("relative h-56", imageClassName)}>
        {coverUrl ? (
          <Image
            className="object-cover"
            src={coverUrl}
            fill
            alt={`Cover for ${project.name}`}
            priority={imagePriority}
            unoptimized
          />
        ) : (
          <Skeleton className="absolute inset-0" />
        )}
      </CardHeader>
      <CardContent>
        <div className="mt-4 flex flex-col gap-2">
          <div>
            <div className="flex items-center justify-between gap-2">
              <h3 className="scroll-m-20 text-xl font-semibold tracking-tight">
                {project.name}
              </h3>
              <Badge variant="secondary" className="text-xs">
                {project.studies.length}{" "}
                {project.studies.length === 1 ? "study" : "studies"}
              </Badge>
            </div>
            {project.description && (
              <p className="text-muted-foreground mt-1 text-sm">
                {project.description}
              </p>
            )}
          </div>

          {/* Studies list */}
          {project.studies.length > 0 && (
            <div className="mt-3 space-y-2">
              <div className="text-muted-foreground text-xs font-medium uppercase">
                Studies
              </div>
              <div className="flex flex-wrap gap-2">
                {project.studies.map((study) => {
                  const fullStudy = studiesById.get(study.id) || study;
                  return (
                    <Badge key={study.id} variant="secondary">
                      <span>{renderStudyLabel(fullStudy)}</span>
                    </Badge>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter className="pt-0">
        <Button asChild variant="outline">
          <Link href={`/team/${teamId}/project/${project.id}`}>View</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
