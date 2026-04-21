// Next imports
import { redirect } from "next/navigation";
import Link from "next/link";

// Lib function imports
import { getCurrentSession } from "@/apps/nextjs-app/lib/db/user";
import {
  getQualitativeAnalysis,
  getBookmarkedStudyIds,
  getStudyPublicRedirectInfo,
  getStudyShareInfo,
  isUserTeamAdmin,
  updateStudyName,
  getStudyTransferPermissions,
} from "@/apps/nextjs-app/lib/db/data";
import { logger } from "@/apps/shared/logger";
import {
  formatDateTime,
  buildDisplayUsers,
} from "@/apps/nextjs-app/lib/utils/study-helpers";
import { getUserImageUrl } from "@/apps/nextjs-app/lib/utils/user-image";
import { getStudyTakeaways } from "@/apps/nextjs-app/lib/db/data";
import { getPresignedUrlsBatch } from "@/apps/nextjs-app/lib/actions/s3-actions";

// Components imports
import MoreMenu from "@/apps/nextjs-app/components/study/study-details-more-menu";
import { StudyAccessDenied } from "@/apps/nextjs-app/components/study/study-access-denied";
import { BookmarkStudyButton } from "@/apps/nextjs-app/components/study/bookmark-study-button";
import { ShareStudyButton } from "@/apps/nextjs-app/components/study/share-study-button";
import { MenuSurface } from "@/apps/nextjs-app/lib/utils/constants";
import Title from "@/apps/nextjs-app/components/study/title";
import { AnalysisInsights } from "@/apps/nextjs-app/app/(auth)/analysis/[id]/analysis-insights";
import { EditableSummary } from "@/apps/nextjs-app/app/(auth)/analysis/[id]/editable-summary";
import { StudyTldr } from "@/apps/nextjs-app/components/study/study-tldr";
import {
  handleUpdateAnalysisSummary,
  handleUpdateAnalysisInsight,
  handleDeleteAnalysisQuote,
  handleAddAnalysisTag,
  handleRemoveAnalysisTag,
  handleDeleteAnalysisInsight,
  handleAddAnalysisQuote,
  handleAddAnalysisInsight,
} from "@/apps/nextjs-app/lib/actions/analysis-actions";

// UI component imports
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/apps/nextjs-app/components/ui/breadcrumb";
import { UserMetadataDisplay } from "@/apps/nextjs-app/components/study/user-metadata";
import { Music, Video, FileText } from "lucide-react";

function FileIcon({ fileType }: { fileType: string | null }) {
  const type = (fileType || "").toUpperCase();
  const className = "h-5 w-5 text-zinc-400";
  switch (type) {
    case "AUDIO":
      return <Music className={className} />;
    case "VIDEO":
      return <Video className={className} />;
    default:
      return <FileText className={className} />;
  }
}

const AUDIO_EXTS = new Set([
  "mp3",
  "wav",
  "m4a",
  "ogg",
  "flac",
  "aac",
  "wma",
  "webm",
]);
const VIDEO_EXTS = new Set(["mp4", "webm", "mov", "avi", "mkv", "wmv", "m4v"]);

function extOf(name: string) {
  return (name.split(".").pop() || "").toLowerCase();
}
function isAudioExtension(name: string) {
  return AUDIO_EXTS.has(extOf(name));
}
function isVideoExtension(name: string) {
  return VIDEO_EXTS.has(extOf(name));
}
function isMediaExtension(name: string) {
  return isAudioExtension(name) || isVideoExtension(name);
}

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const session = await getCurrentSession();

  const [study, bookmarkedStudyIds, shareInfo] = await Promise.all([
    getQualitativeAnalysis(id, session.userId),
    getBookmarkedStudyIds(session.userId),
    getStudyShareInfo(id, session.userId),
  ]);

  const hasCompany = !!shareInfo?.team?.companyId;
  const isPersonalTeam = shareInfo?.team?.isPersonal ?? false;

  const isBookmarked = bookmarkedStudyIds.includes(id);

  if (!study || !study.qualitativeAnalysis) {
    const publicInfo = await getStudyPublicRedirectInfo(id);
    if (publicInfo?.shareToken) {
      redirect(`/shared/${publicInfo.shareToken}`);
    }

    logger.warn("Qualitative analysis not found or access denied", {
      userId: session.userId,
      studyId: id,
      studyExists: !!study,
      qualitativeAnalysisExists: !!study?.qualitativeAnalysis,
    });
    return <StudyAccessDenied studyType="study" />;
  }

  const isOwner = session.userId === study.createdByUserId;
  const isTeamAdmin = study.teamId
    ? await isUserTeamAdmin(session.userId, study.teamId)
    : false;

  const canManage = isOwner || isTeamAdmin;

  // Build transfer permissions — only relevant for company studies
  const { adminTeams, canTransfer, transferDisabledReason } =
    hasCompany && shareInfo?.team?.companyId
      ? await getStudyTransferPermissions(
          shareInfo.team.companyId,
          session.userId,
        )
      : {
          adminTeams: [],
          canTransfer: false,
          transferDisabledReason: undefined,
        };

  const [createdByImageUrl, lastModifiedByImageUrl, takeaways] =
    await Promise.all([
      getUserImageUrl(study.createdByUser),
      getUserImageUrl(study.lastModifiedByUser ?? study.createdByUser),
      getStudyTakeaways(id, session.userId),
    ]);

  const { createdByDisplayUser, lastModifiedByDisplayUser } = buildDisplayUsers(
    study,
    createdByImageUrl,
    lastModifiedByImageUrl,
  );

  const qa = study.qualitativeAnalysis;
  const insights = qa.insights || [];
  const files = study.files || [];

  // Generate presigned URLs for file downloads
  const fileKeys = files
    .map((f: { key?: string }) => f.key)
    .filter((key: string | undefined): key is string => !!key);
  const presignedUrls = await getPresignedUrlsBatch(fileKeys);
  const fileUrlMap = new Map<string, string>();
  fileKeys.forEach((key: string, i: number) => {
    fileUrlMap.set(key, presignedUrls[i]);
  });

  return (
    <div>
      <Breadcrumb className="mb-6">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/studies">Studies</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Analysis</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="mb-4 flex items-start justify-between">
        <div className="flex grow flex-col">
          <small className="text-sm leading-none font-bold text-zinc-500 uppercase">
            Analysis
          </small>
          <Title
            studyId={study.id}
            userId={session.userId}
            updateStudyName={updateStudyName}
            canEdit={canManage}
          >
            {study.name ? study.name : "Untitled Analysis"}
          </Title>
        </div>
        <div className="ml-4 flex items-center gap-1 print:hidden">
          <BookmarkStudyButton
            studyId={id}
            userId={session.userId}
            isBookmarked={isBookmarked}
          />
          {shareInfo && (
            <ShareStudyButton
              studyId={id}
              visibility={shareInfo.visibility}
              shareToken={shareInfo.shareToken}
              hasCompany={hasCompany}
              isPersonalTeam={isPersonalTeam}
            />
          )}
          <MoreMenu
            study={study}
            userId={session.userId}
            surface={MenuSurface.ANALYSIS}
            canDelete={canManage}
            canShare={canManage}
            shareDisabledReason={
              !canManage ? "Only the owner can share this study" : undefined
            }
            isBookmarked={isBookmarked}
            hasCompany={hasCompany}
            isPersonalTeam={isPersonalTeam}
            canTransfer={canTransfer}
            transferDisabledReason={transferDisabledReason}
            adminTeams={adminTeams}
          />
        </div>
      </div>

      {/* Study Metadata */}
      <div className="mb-8 min-w-0 overflow-hidden rounded-lg bg-gray-100 p-6 text-sm">
        {(qa.goal || qa.inferredGoal) && (
          <div className="mb-4">
            <p className="leading-5 font-semibold tracking-tight">
              Research Goal
            </p>
            <p className="leading-5">{qa.goal || qa.inferredGoal}</p>
          </div>
        )}

        {files.length > 0 && (
          <div
            className="mb-4 flex gap-3 overflow-x-auto pb-2"
            style={{ scrollbarWidth: "none" }}
          >
            {files.map(
              (file: {
                id: string;
                key?: string;
                originalName?: string;
                fileType?: string;
              }) => {
                const url = file.key ? fileUrlMap.get(file.key) : undefined;
                return (
                  <a
                    key={file.id}
                    href={url || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex shrink-0 items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 py-2 transition-colors hover:border-zinc-400 hover:bg-zinc-50"
                  >
                    <FileIcon fileType={file.fileType || null} />
                    <span className="max-w-40 truncate text-xs text-zinc-600">
                      {file.originalName || "Untitled"}
                    </span>
                  </a>
                );
              },
            )}
          </div>
        )}

        <div className="grid gap-4 text-sm text-zinc-600 sm:grid-cols-4">
          <div>
            <p className="font-semibold text-zinc-700">Created by</p>
            <UserMetadataDisplay user={createdByDisplayUser} className="mt-1" />
          </div>
          <div>
            <p className="font-semibold text-zinc-700">Created on</p>
            <p>{formatDateTime(study.createdAt)}</p>
          </div>
          <div>
            <p className="font-semibold text-zinc-700">Modified by</p>
            <UserMetadataDisplay
              user={lastModifiedByDisplayUser}
              className="mt-1"
            />
          </div>
          <div>
            <p className="font-semibold text-zinc-700">Last modified</p>
            <p>{formatDateTime(study.updatedAt)}</p>
          </div>
        </div>
      </div>

      {/* Key Takeaways */}
      <StudyTldr
        studyId={study.id}
        userId={session.userId}
        initialTldrStatus={(study as any).tldrStatus || "PENDING"}
        initialTakeaways={takeaways}
        canManage={canManage}
      />

      {/* Analysis Summary */}
      <EditableSummary
        summary={qa.summary || ""}
        summarySource={qa.summarySource || "AI"}
        qualitativeAnalysisId={qa.id}
        userId={session.userId}
        studyId={id}
        canEdit={canManage}
        updateSummary={handleUpdateAnalysisSummary}
      />

      {/* Insights */}
      <AnalysisInsights
        insights={insights}
        studyId={id}
        canEdit={canManage}
        userId={session.userId}
        updateInsight={handleUpdateAnalysisInsight}
        deleteQuote={handleDeleteAnalysisQuote}
        addTag={handleAddAnalysisTag}
        removeTag={handleRemoveAnalysisTag}
        deleteInsight={handleDeleteAnalysisInsight}
        addQuote={handleAddAnalysisQuote}
        addInsight={handleAddAnalysisInsight}
        qualitativeAnalysisId={qa.id}
        sourceFiles={files.map(
          (f: {
            id: string;
            key?: string;
            originalName?: string;
            fileType?: string;
            transcript?: string | null;
            identifier?: string | null;
          }) => {
            // Determine effective media type from fileType or file extension
            const ft = (f.fileType || "").toUpperCase();
            const isMedia =
              ft === "AUDIO" ||
              ft === "VIDEO" ||
              (ft === "UNKNOWN" &&
                isMediaExtension(f.originalName || f.key || ""));
            const effectiveType =
              ft === "AUDIO"
                ? "AUDIO"
                : ft === "VIDEO"
                  ? "VIDEO"
                  : isAudioExtension(f.originalName || f.key || "")
                    ? "AUDIO"
                    : isVideoExtension(f.originalName || f.key || "")
                      ? "VIDEO"
                      : ft;
            return {
              id: f.id,
              originalName: f.originalName || null,
              fileType: effectiveType || null,
              transcript: f.transcript || null,
              identifier: f.identifier || null,
              mediaUrl: isMedia && f.key ? fileUrlMap.get(f.key) || null : null,
            };
          },
        )}
      />
    </div>
  );
}
