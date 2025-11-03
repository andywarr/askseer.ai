// Next imports
import { redirect } from "next/navigation";
import Link from "next/link";

// Lib function imports
import { getPresignedUrls } from "@/apps/nextjs-app/lib/action";
import { getCurrentUser } from "@/apps/nextjs-app/lib/user";
import { getProject, getStudies } from "@/apps/nextjs-app/lib/data";
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
import { ProjectContent } from "@/apps/nextjs-app/components/project-content";

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

  // Fetch all studies for the team
  const allStudies = await getStudies(session.userId, {
    teamId: user.selectedTeamId,
  });

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

      <ProjectContent
        project={project}
        coverUrl={coverUrl}
        photoUrl={photoUrl}
        ownerDisplayName={ownerDisplayName}
        createdAtFormatted={createdAtFormatted}
        updatedAtFormatted={updatedAtFormatted}
        currentUserId={session.userId}
        allStudies={allStudies}
      />
    </div>
  );
}
