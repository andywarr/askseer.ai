// Next imports
import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

// Lib function imports
import { getPresignedUrls } from "@/apps/nextjs-app/lib/action";
import { getCurrentUser } from "@/apps/nextjs-app/lib/user";
import { getProject } from "@/apps/nextjs-app/lib/data";
import { logger } from "@/apps/shared/logger";

// UI component imports
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/apps/nextjs-app/components/ui/breadcrumb";
import { Card, CardContent } from "@/apps/nextjs-app/components/ui/card";
import { Badge } from "@/apps/nextjs-app/components/ui/badge";
import { Skeleton } from "@/apps/nextjs-app/components/ui/skeleton";

// Prisma imports
import { StudyStatus, StudyType } from "@prisma/client";

// Force dynamic rendering to ensure fresh data
export const dynamic = "force-dynamic";

type ProjectStudy = {
  id: string;
  name: string | null;
  status: StudyStatus;
  type: StudyType;
  createdByUserId: string;
  createdAt: string;
  addedAt?: string;
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
  studies: ProjectStudy[];
};

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;

  // Get user and session data (authentication already verified in layout)
  const { user, session } = await getCurrentUser();

  // Fetch the project
  const project: ProjectData = await getProject(
    id,
    session.userId,
    user.selectedTeamId,
  );

  if (!project) {
    logger.warn("Project not found", {
      userId: session.userId,
      projectId: id,
    });
    redirect("/error");
  }

  logger.info("Project page rendered successfully", {
    userId: session.userId,
    projectId: project.id,
    studyCount: project.studies.length,
  });

  const isOwner = session.userId === project.createdByUserId;

  // Get presigned URLs for project images
  let coverUrl: string | null = null;
  let photoUrl: string | null = null;

  if (project.coverFile?.key) {
    coverUrl = await getPresignedUrls(project.coverFile.key);
  }

  if (project.photoFile?.key) {
    photoUrl = await getPresignedUrls(project.photoFile.key);
  }

  const ownerDisplayName =
    project.createdByUser?.name?.trim() ||
    project.createdByUser?.email ||
    "Unknown member";

  const formatDateTime = (value: string | Date) =>
    new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));

  const createdAtFormatted = formatDateTime(project.createdAt);
  const updatedAtFormatted = formatDateTime(project.updatedAt);

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

  const getStudyHref = (study: ProjectStudy) => {
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

  return (
    <div>
      <Breadcrumb className="mb-6">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/project">Projects</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{project.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

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
        <h1 className="scroll-m-20 text-4xl font-extrabold tracking-tight md:text-5xl">
          {project.name}
        </h1>
        {project.description && (
          <p className="text-muted-foreground mt-2 text-lg">
            {project.description}
          </p>
        )}
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
        <h2 className="mb-4 scroll-m-20 text-2xl font-semibold tracking-tight">
          Studies
        </h2>
        {project.studies.length > 0 ? (
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
        ) : (
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
