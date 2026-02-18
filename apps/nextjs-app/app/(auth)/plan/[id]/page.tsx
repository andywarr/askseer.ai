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
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/apps/nextjs-app/components/ui/card";
import { Badge } from "@/apps/nextjs-app/components/ui/badge";

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
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Study Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Status */}
          <div>
            <span className="text-muted-foreground text-sm font-medium">
              Status
            </span>
            <div className="mt-1">
              <Badge variant="outline" className="capitalize">
                {study.status.toLowerCase().replace(/_/g, " ")}
              </Badge>
            </div>
          </div>

          {/* Dates and Users */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <span className="text-muted-foreground text-sm font-medium">
                Created
              </span>
              <p className="text-sm">
                {createdAtFormatted}
                {createdByDisplayUser?.name && (
                  <span className="text-muted-foreground">
                    {" "}
                    by {createdByDisplayUser.name}
                  </span>
                )}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground text-sm font-medium">
                Updated
              </span>
              <p className="text-sm">
                {updatedAtFormatted}
                {lastModifiedByDisplayUser?.name && (
                  <span className="text-muted-foreground">
                    {" "}
                    by {lastModifiedByDisplayUser.name}
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Research Goal */}
          {goal && (
            <div>
              <span className="text-muted-foreground text-sm font-medium">
                Research Goal
              </span>
              <p className="mt-1 text-sm">{goal}</p>
            </div>
          )}

          {/* Research Questions */}
          {researchQuestions.length > 0 && (
            <div>
              <span className="text-muted-foreground text-sm font-medium">
                Research Questions
              </span>
              <ul className="mt-1 list-inside list-disc space-y-1 text-sm">
                {researchQuestions.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Hypotheses */}
          {hypotheses.length > 0 && (
            <div>
              <span className="text-muted-foreground text-sm font-medium">
                Hypotheses
              </span>
              <ul className="mt-1 list-inside list-disc space-y-1 text-sm">
                {hypotheses.map((h, i) => (
                  <li key={i}>{h}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Target Users */}
          {targetUsers && (
            <div>
              <span className="text-muted-foreground text-sm font-medium">
                Target Users
              </span>
              <p className="mt-1 text-sm">{targetUsers}</p>
            </div>
          )}

          {/* Context */}
          {context && (
            <div>
              <span className="text-muted-foreground text-sm font-medium">
                Additional Context
              </span>
              <p className="mt-1 text-sm">{context}</p>
            </div>
          )}

          {/* Files */}
          {study.files && study.files.length > 0 && (
            <div>
              <span className="text-muted-foreground text-sm font-medium">
                Uploaded Files
              </span>
              <ul className="mt-1 space-y-1 text-sm">
                {study.files.map(
                  (
                    file: { key?: string | null; id: string },
                    i: number,
                  ) => (
                    <li
                      key={file.id || i}
                      className="text-muted-foreground"
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
        </CardContent>
      </Card>
    </div>
  );
}
