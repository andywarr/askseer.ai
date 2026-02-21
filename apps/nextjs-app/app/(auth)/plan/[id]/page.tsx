// Next imports
import { redirect } from "next/navigation";
import Link from "next/link";

// Lib function imports
import { getCurrentSession } from "@/apps/nextjs-app/lib/db/user";
import {
  getStudy,
  getBookmarkedStudyIds,
  getStudyShareInfo,
  updateStudyName,
  isUserTeamAdmin,
} from "@/apps/nextjs-app/lib/db/data";
import { logger } from "@/apps/shared/logger";
import {
  formatDateTime,
  buildDisplayUsers,
} from "@/apps/nextjs-app/lib/utils/study-helpers";
import { getUserImageUrl } from "@/apps/nextjs-app/lib/utils/user-image";
import { StudyType } from "@prisma/client";

// Components imports
import { StudyAccessDenied } from "@/apps/nextjs-app/components/study/study-access-denied";
import { BookmarkStudyButton } from "@/apps/nextjs-app/components/study/bookmark-study-button";
import { ShareStudyButton } from "@/apps/nextjs-app/components/study/share-study-button";
import MoreMenu from "@/apps/nextjs-app/components/study/study-details-more-menu";
import { MenuSurface } from "@/apps/nextjs-app/lib/utils/constants";
import Title from "@/apps/nextjs-app/components/study/title";

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

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const session = await getCurrentSession();

  const [study, bookmarkedStudyIds, shareInfo] = await Promise.all([
    getStudy(id, session.userId, StudyType.PLAN).catch(() => null),
    getBookmarkedStudyIds(session.userId),
    getStudyShareInfo(id, session.userId),
  ]);

  const isBookmarked = bookmarkedStudyIds.includes(id);
  const hasCompany = !!shareInfo?.team?.companyId;
  const isPersonalTeam = shareInfo?.team?.isPersonal ?? false;

  if (!study) {
    logger.warn("Study plan not found or access denied", {
      userId: session.userId,
      studyId: id,
    });
    return <StudyAccessDenied studyType="study" />;
  }

  const isOwner = session.userId === study.createdByUserId;
  const isTeamAdmin = study.teamId
    ? await isUserTeamAdmin(session.userId, study.teamId)
    : false;
  const canManageStudy = isOwner || isTeamAdmin;

  const [createdByImageUrl, lastModifiedByImageUrl] = await Promise.all([
    getUserImageUrl(study.createdByUser),
    getUserImageUrl(study.lastModifiedByUser ?? study.createdByUser),
  ]);

  const { createdByDisplayUser, lastModifiedByDisplayUser } = buildDisplayUsers(
    study,
    createdByImageUrl,
    lastModifiedByImageUrl,
  );

  const createdAtFormatted = formatDateTime(study.createdAt);
  const updatedAtFormatted = formatDateTime(study.updatedAt);

  // Extract study plan metadata from jobData
  const jobData = study.jobData as Record<string, unknown> | null;
  const payload = (jobData?.payload ?? {}) as Record<string, unknown>;
  const goal = (payload.goal as string) ?? null;
  const researchQuestions = (payload.researchQuestions as string[]) ?? [];
  const hypotheses = (payload.hypotheses as string[]) ?? [];
  const targetUsers = (payload.targetUsers as string) ?? null;
  const context = (payload.context as string) ?? null;

  return (
    <div>
      <Breadcrumb className="mb-6 print:hidden">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/studies">Studies</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Study Plan</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="mb-4 flex items-start justify-between">
        <div className="flex grow flex-col">
          <small className="text-sm leading-none font-bold text-zinc-500 uppercase">
            Study Plan
          </small>
          <Title
            studyId={study.id}
            userId={session.userId}
            updateStudyName={updateStudyName}
            canEdit={canManageStudy}
          >
            {study.name ? study.name : "Untitled"}
          </Title>
        </div>
        <div className="ml-4 flex items-center gap-1 print:hidden">
          <BookmarkStudyButton
            studyId={study.id}
            userId={session.userId}
            isBookmarked={isBookmarked}
          />
          {shareInfo && (
            <ShareStudyButton
              studyId={study.id}
              visibility={shareInfo.visibility}
              shareToken={shareInfo.shareToken}
              hasCompany={hasCompany}
              isPersonalTeam={isPersonalTeam}
            />
          )}
          <MoreMenu
            study={study}
            userId={session.userId}
            surface={MenuSurface.EVALUATION}
            canDelete={canManageStudy}
            canShare={canManageStudy}
            shareDisabledReason={
              !canManageStudy
                ? "Only the owner can share this study"
                : undefined
            }
            isBookmarked={isBookmarked}
            hasCompany={hasCompany}
            isPersonalTeam={isPersonalTeam}
          />
        </div>
      </div>

      {/* Study Metadata */}
      <div className="mb-8 min-w-0 overflow-hidden rounded-lg bg-gray-100 p-6 text-sm">
        {/* Research Goal - full width */}
        {goal && (
          <div className="mb-4">
            <p className="leading-5 font-semibold tracking-tight">
              Research Goal
            </p>
            <p className="mt-1 leading-5">{goal}</p>
          </div>
        )}

        {/* Research Questions & Hypotheses - side by side on desktop, stacked on mobile */}
        {(researchQuestions.length > 0 || hypotheses.length > 0) && (
          <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {researchQuestions.length > 0 && (
              <div>
                <p className="leading-5 font-semibold tracking-tight">
                  Research Questions
                </p>
                <div className="mt-2 space-y-2">
                  {researchQuestions.map((q, i) => (
                    <div
                      key={i}
                      className="rounded-md border border-gray-200 px-3 py-2 leading-5"
                    >
                      <span className="font-medium text-zinc-500">
                        RQ{i + 1}.
                      </span>{" "}
                      {q}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {hypotheses.length > 0 && (
              <div>
                <p className="leading-5 font-semibold tracking-tight">
                  Hypotheses
                </p>
                <div className="mt-2 space-y-2">
                  {hypotheses.map((h, i) => (
                    <div
                      key={i}
                      className="rounded-md border border-gray-200 px-3 py-2 leading-5"
                    >
                      <span className="font-medium text-zinc-500">
                        H{i + 1}.
                      </span>{" "}
                      {h}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Target Users & Context */}
        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {targetUsers && (
            <div>
              <p className="leading-5 font-semibold tracking-tight">
                Target Users
              </p>
              <p className="mt-1 leading-5">{targetUsers}</p>
            </div>
          )}

          {context && (
            <div>
              <p className="leading-5 font-semibold tracking-tight">
                Additional Context
              </p>
              <p className="mt-1 leading-5">{context}</p>
            </div>
          )}
        </div>

        {/* Files */}
        {study.files && study.files.length > 0 && (
          <div className="mb-4">
            <p className="leading-5 font-semibold tracking-tight">
              Uploaded Files
            </p>
            <ul className="mt-1 space-y-1">
              {study.files.map(
                (file: { key?: string | null; id: string }, i: number) => (
                  <li
                    key={file.id || i}
                    className="text-muted-foreground leading-5"
                  >
                    {file.key
                      ? file.key.split("/").pop() || "File"
                      : `File ${i + 1}`}
                  </li>
                ),
              )}
            </ul>
          </div>
        )}

        {/* Created & Updated - at the bottom */}
        <div className="mt-6 grid gap-4 text-sm text-zinc-600 sm:grid-cols-4">
          <div>
            <p className="font-semibold text-zinc-700">Created by</p>
            <UserMetadataDisplay user={createdByDisplayUser} className="mt-1" />
          </div>
          <div>
            <p className="font-semibold text-zinc-700">Created on</p>
            <p>{createdAtFormatted}</p>
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
            <p>{updatedAtFormatted}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
