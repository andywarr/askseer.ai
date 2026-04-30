import { notFound } from "next/navigation";

import {
  getStudy,
  isUserTeamAdmin,
  getBookmarkedStudyIds,
  getTeam,
} from "@/apps/nextjs-app/lib/db/data";
import {
  getCurrentUser,
  canManageTeamFunds,
} from "@/apps/nextjs-app/lib/db/user";
import { StudyType } from "@prisma/client";
import {
  formatDateTime,
  buildDisplayUsers,
} from "@/apps/nextjs-app/lib/utils/study-helpers";
import { getUserImageUrl } from "@/apps/nextjs-app/lib/utils/user-image";
import { getPresignedUrlsBatch } from "@/apps/nextjs-app/lib/actions/s3-actions";
import { getInterviewData } from "@/apps/nextjs-app/lib/actions/interview-actions";
import {
  PERSONAL_INTERVIEW_COST_CENTS,
  COMPANY_INTERVIEW_COST_CENTS,
} from "@/apps/shared/constants";

import { FileText } from "lucide-react";
import MoreMenu from "@/apps/nextjs-app/components/study/study-details-more-menu";
import { BookmarkStudyButton } from "@/apps/nextjs-app/components/study/bookmark-study-button";
import { MenuSurface } from "@/apps/nextjs-app/lib/utils/constants";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/apps/nextjs-app/components/ui/breadcrumb";
import { UserMetadataDisplay } from "@/apps/nextjs-app/components/study/user-metadata";
import { InterviewSessionsList } from "@/apps/nextjs-app/app/(auth)/interview/[id]/interview-sessions-list";

/** Shape returned by getStudy for INTERVIEW studies */
interface InterviewStudyData {
  id: string;
  name: string | null;
  teamId: string | null;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
  createdByUser: {
    id: string;
    name: string | null;
    email: string;
    status: string;
    image: string | null;
    imageKey: string | null;
  };
  lastModifiedByUser: {
    id: string;
    name: string | null;
    email: string;
    status: string;
    image: string | null;
    imageKey: string | null;
  } | null;
  jobData?: Record<string, any>;
  qualitativeAnalysis?: {
    goal?: string;
    inferredGoal?: string;
    _count?: { insights: number };
  } | null;
  files?: { id: string; key?: string; originalName?: string }[];
}

export default async function InterviewDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { user } = await getCurrentUser();
  const study = (await getStudy(
    id,
    user.id,
    StudyType.INTERVIEW,
  )) as InterviewStudyData | null;

  if (!study) {
    return notFound();
  }

  const isOwner = study.createdByUserId === user.id;

  const [isTeamAdmin, bookmarkedStudyIds, interviewResult, team, canPurchaseCredits] = await Promise.all([
    study.teamId
      ? isUserTeamAdmin(user.id, study.teamId)
      : Promise.resolve(false),
    getBookmarkedStudyIds(user.id),
    getInterviewData(id),
    study.teamId ? getTeam(study.teamId) : Promise.resolve(null),
    study.teamId
      ? canManageTeamFunds(user.id, study.teamId)
      : Promise.resolve(false),
  ]);

  const sessionCostCents = team?.companyId
    ? COMPANY_INTERVIEW_COST_CENTS
    : PERSONAL_INTERVIEW_COST_CENTS;

  const canManageStudy = isOwner || isTeamAdmin;
  const isBookmarked = bookmarkedStudyIds.includes(id);

  // Interview-specific data (questions, sessions, system prompt)
  const interviewData = interviewResult.success ? interviewResult.data : null;

  // Study context extracted from jobData and qualitativeAnalysis
  const jobData = study.jobData ?? {};
  const qa = study.qualitativeAnalysis;
  const goal = qa?.goal || qa?.inferredGoal || jobData.goal;
  const researchQuestions: string[] = jobData.researchQuestions || [];
  const hypotheses: string[] = jobData.hypotheses || [];
  const context: string | undefined = jobData.context;

  // Build user display objects
  const [createdByImageUrl, lastModifiedByImageUrl] = await Promise.all([
    getUserImageUrl(study.createdByUser),
    getUserImageUrl(study.lastModifiedByUser ?? study.createdByUser),
  ]);

  const { createdByDisplayUser, lastModifiedByDisplayUser } = buildDisplayUsers(
    study,
    createdByImageUrl,
    lastModifiedByImageUrl,
  );

  // Generate presigned URLs for guide file downloads
  const files = study.files || [];
  const fileKeys = files
    .map((f) => f.key)
    .filter((key): key is string => !!key);
  const presignedUrls =
    fileKeys.length > 0 ? await getPresignedUrlsBatch(fileKeys) : [];
  const fileUrlMap = new Map<string, string>();
  fileKeys.forEach((key, i) => {
    fileUrlMap.set(key, presignedUrls[i]);
  });

  // Generate presigned URLs for session recordings
  const sessions = interviewData?.sessions || [];
  const recordingKeys = sessions
    .map((s: any) => s.recordingKey)
    .filter((key: string | null | undefined): key is string => !!key);
  const recordingUrls =
    recordingKeys.length > 0
      ? await getPresignedUrlsBatch(recordingKeys)
      : [];
  const recordingUrlMap = new Map<string, string>();
  recordingKeys.forEach((key: string, i: number) => {
    recordingUrlMap.set(key, recordingUrls[i]);
  });

  // Attach recordingUrl to each session
  const sessionsWithUrls = sessions.map((s: any) => ({
    ...s,
    recordingUrl: s.recordingKey
      ? recordingUrlMap.get(s.recordingKey) || null
      : null,
  }));

  return (
    <div className="flex flex-col gap-6">
      {/* Breadcrumb */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/studies">Studies</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{study.name || "AI Interview"}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <small className="text-sm leading-none font-bold text-zinc-500 uppercase">
            Interview
          </small>
          <h1 className="text-3xl font-bold tracking-tight">
            {study.name || "AI Interview"}
          </h1>
        </div>
        <div className="flex items-center gap-1">
          <BookmarkStudyButton
            studyId={study.id}
            userId={user.id}
            isBookmarked={isBookmarked}
          />
          <MoreMenu
            study={study}
            userId={user.id}
            surface={MenuSurface.INTERVIEW}
            canDelete={canManageStudy}
            deleteDisabledReason={
              !canManageStudy
                ? "Only the owner or an admin can delete this study"
                : undefined
            }
            isBookmarked={isBookmarked}
          />
        </div>
      </div>

      {/* Study Metadata */}
      <div className="min-w-0 overflow-hidden rounded-lg bg-gray-100 p-6 text-sm dark:bg-zinc-900">
        {goal && (
          <div className="mb-4">
            <p className="leading-5 font-semibold tracking-tight">
              Research Goal
            </p>
            <p className="leading-5 text-zinc-600 dark:text-zinc-400">{goal}</p>
          </div>
        )}

        {files.length > 0 && (
          <div
            className="mb-4 flex gap-3 overflow-x-auto pb-2"
            style={{ scrollbarWidth: "none" }}
          >
            {files.map((file) => {
              const url = file.key ? fileUrlMap.get(file.key) : undefined;
              return (
                <a
                  key={file.id}
                  href={url || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex shrink-0 items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 py-2 transition-colors hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:border-zinc-500 dark:hover:bg-zinc-700"
                >
                  <FileText className="h-5 w-5 text-zinc-400" />
                  <span className="max-w-40 truncate text-xs text-zinc-600 dark:text-zinc-300">
                    {file.originalName || "Discussion Guide"}
                  </span>
                </a>
              );
            })}
          </div>
        )}

        {researchQuestions.length > 0 && (
          <div className="mb-4">
            <p className="leading-5 font-semibold tracking-tight">
              Research Questions
            </p>
            <ul className="mt-1 list-disc space-y-1 pl-4 text-zinc-600 dark:text-zinc-400">
              {researchQuestions.map((q: string, i: number) => (
                <li key={i}>{q}</li>
              ))}
            </ul>
          </div>
        )}

        {hypotheses.length > 0 && (
          <div className="mb-4">
            <p className="leading-5 font-semibold tracking-tight">Hypotheses</p>
            <ul className="mt-1 list-disc space-y-1 pl-4 text-zinc-600 dark:text-zinc-400">
              {hypotheses.map((h: string, i: number) => (
                <li key={i}>{h}</li>
              ))}
            </ul>
          </div>
        )}

        {context && (
          <div className="mb-4">
            <p className="leading-5 font-semibold tracking-tight">Context</p>
            <p className="leading-5 text-zinc-600 dark:text-zinc-400">
              {context}
            </p>
          </div>
        )}

        <div className="grid gap-4 text-sm text-zinc-600 sm:grid-cols-4 dark:text-zinc-400">
          <div>
            <p className="font-semibold text-zinc-700 dark:text-zinc-300">
              Created by
            </p>
            <UserMetadataDisplay user={createdByDisplayUser} className="mt-1" />
          </div>
          <div>
            <p className="font-semibold text-zinc-700 dark:text-zinc-300">
              Created on
            </p>
            <p>{formatDateTime(study.createdAt)}</p>
          </div>
          <div>
            <p className="font-semibold text-zinc-700 dark:text-zinc-300">
              Modified by
            </p>
            <UserMetadataDisplay
              user={lastModifiedByDisplayUser}
              className="mt-1"
            />
          </div>
          <div>
            <p className="font-semibold text-zinc-700 dark:text-zinc-300">
              Last modified
            </p>
            <p>{formatDateTime(study.updatedAt)}</p>
          </div>
        </div>
      </div>

      {/* Sessions */}
      <InterviewSessionsList
        studyId={study.id}
        interviewId={interviewData?.id || null}
        initialSessions={sessionsWithUrls}
        hasAnalysis={!!qa && (qa._count?.insights ?? 0) > 0}
        isCreator={isOwner}
        balanceCents={team?.balanceCents ?? 0}
        sessionCostCents={sessionCostCents}
        canPurchaseCredits={canPurchaseCredits}
      />
    </div>
  );
}
