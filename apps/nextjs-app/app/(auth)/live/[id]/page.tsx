import { notFound, redirect } from "next/navigation";
import Link from "next/link";

import { getStudy } from "@/apps/nextjs-app/lib/db/data";
import { getCurrentUser } from "@/apps/nextjs-app/lib/db/user";
import { StudyType } from "@prisma/client";
import {
  formatDateTime,
  buildDisplayUsers,
} from "@/apps/nextjs-app/lib/utils/study-helpers";
import { getUserImageUrl } from "@/apps/nextjs-app/lib/utils/user-image";
import { getPresignedUrlsBatch } from "@/apps/nextjs-app/lib/actions/s3-actions";
import {
  renameLiveSession,
  deleteLiveSessionAction,
} from "@/apps/nextjs-app/lib/actions/study-lifecycle-actions";

import { FileText } from "lucide-react";
import { BookmarkStudyButton } from "@/apps/nextjs-app/components/study/bookmark-study-button";
import { ShareStudyButton } from "@/apps/nextjs-app/components/study/share-study-button";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/apps/nextjs-app/components/ui/breadcrumb";
import { UserMetadataDisplay } from "@/apps/nextjs-app/components/study/user-metadata";
import { LiveSessionsList } from "@/apps/nextjs-app/app/(auth)/live/[id]/live-sessions-list";

export default async function LiveSessionDashboard({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { user } = await getCurrentUser();
  const study = await getStudy(id, user.id, StudyType.LIVE_SESSION);

  if (!study) {
    return notFound();
  }

  // Study context extracted from jobData and qualitativeAnalysis
  const jobData = (study as any).jobData ?? {};
  const qa = (study as any).qualitativeAnalysis;
  const goal = qa?.goal || qa?.inferredGoal || jobData.goal;
  const researchQuestions: string[] = jobData.researchQuestions || [];
  const hypotheses: string[] = jobData.hypotheses || [];
  const context: string | undefined = jobData.context;
  const sessions: any[] = (study as any).liveSessions || [];

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
  const files: { id: string; key?: string; originalName?: string }[] =
    (study as any).files || [];
  const fileKeys = files
    .map((f) => f.key)
    .filter((key): key is string => !!key);
  const presignedUrls =
    fileKeys.length > 0 ? await getPresignedUrlsBatch(fileKeys) : [];
  const fileUrlMap = new Map<string, string>();
  fileKeys.forEach((key, i) => {
    fileUrlMap.set(key, presignedUrls[i]);
  });

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
            <BreadcrumbPage>{study.name || "Live Session"}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <small className="text-sm leading-none font-bold text-zinc-500 uppercase">
            Backroom
          </small>
          <h1 className="text-3xl font-bold tracking-tight">
            {study.name || "Live Session"}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <BookmarkStudyButton
            studyId={study.id}
            userId={user.id}
            isBookmarked={false}
          />
          <ShareStudyButton
            studyId={study.id}
            visibility={study.visibility}
            shareToken={study.shareToken}
            hasCompany={!!study.team?.company}
            isPersonalTeam={study.team?.isPersonal}
            variant="icon"
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
                  className="flex shrink-0 items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 py-2 transition-colors hover:border-zinc-400 hover:bg-zinc-50"
                >
                  <FileText className="h-5 w-5 text-zinc-400" />
                  <span className="max-w-40 truncate text-xs text-zinc-600">
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
      <LiveSessionsList
        studyId={study.id}
        initialSessions={sessions}
        hasAnalysis={!!qa}
        renameLiveSession={renameLiveSession}
        deleteLiveSessionAction={deleteLiveSessionAction}
      />
    </div>
  );
}
