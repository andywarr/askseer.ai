// Next imports
import { redirect } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";

// Lib function imports
import { getPresignedUrls } from "@/apps/nextjs-app/lib/actions/s3-actions";
import { getCurrentSession } from "@/apps/nextjs-app/lib/db/user";
import { getUserImageUrl } from "@/apps/nextjs-app/lib/utils/user-image";
import {
  getHeuristicEvaluation,
  isUserTeamAdmin,
  updateStudyName,
  getBookmarkedStudyIds,
  getStudyPublicRedirectInfo,
  getStudyShareInfo,
  canAccessStudy,
  getPersonaBasicInfo,
} from "@/apps/nextjs-app/lib/db/data";
import { logger } from "@/apps/shared/logger";
import {
  groupResultsByHeuristic,
  addPlaceholderHeuristics,
  sortHeuristicResults,
} from "@/apps/nextjs-app/utils/heuristic-helpers";
import { HEResultData } from "@/apps/nextjs-app/types/types";

// Components imports
import MoreMenu from "@/apps/nextjs-app/components/study/study-details-more-menu";
import { StudyAccessDenied } from "@/apps/nextjs-app/components/study/study-access-denied";
import { BookmarkStudyButton } from "@/apps/nextjs-app/components/study/bookmark-study-button";
import { ShareStudyButton } from "@/apps/nextjs-app/components/study/share-study-button";
import { MenuSurface } from "@/apps/nextjs-app/lib/utils/constants";
import Title from "@/apps/nextjs-app/components/study/title";
import HeuristicResults from "@/apps/nextjs-app/app/(auth)/evaluation/[id]/heuristic-results";
import { StudyMetadataCard } from "@/apps/nextjs-app/app/(auth)/evaluation/[id]/study-metadata-card";
import { HeuristicResultsSkeleton } from "@/apps/nextjs-app/app/(auth)/evaluation/[id]/heuristic-results-skeleton";

// UI component imports
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/apps/nextjs-app/components/ui/breadcrumb";

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  // Get session data (authentication already verified in layout)
  const session = await getCurrentSession();

  const [study, bookmarkedStudyIds, shareInfo] = await Promise.all([
    getHeuristicEvaluation(id, session.userId),
    getBookmarkedStudyIds(session.userId),
    getStudyShareInfo(id, session.userId),
  ]);

  const isBookmarked = bookmarkedStudyIds.includes(id);
  // hasCompany: team belongs to a company (enables Private, Team, Company visibility options)
  // isPersonalTeam: personal teams don't show Team option (only Private and Company)
  const hasCompany = !!shareInfo?.team?.companyId;
  const isPersonalTeam = shareInfo?.team?.isPersonal ?? false;

  if (!study || !study.heuristicEvaluation) {
    // Check if this study is publicly shared and redirect if so
    const publicInfo = await getStudyPublicRedirectInfo(id);
    if (publicInfo?.shareToken) {
      logger.info("Redirecting to public shared study", {
        studyId: id,
        shareToken: publicInfo.shareToken,
      });
      redirect(`/shared/${publicInfo.shareToken}`);
    }

    logger.warn("Evaluation not found or access denied", {
      userId: session.userId,
      studyId: id,
      studyExists: !!study,
      heuristicEvaluationExists: !!study?.heuristicEvaluation,
    });
    return <StudyAccessDenied studyType="evaluation" />;
  }

  logger.debug("Evaluation retrieved successfully", {
    userId: session.userId,
    studyId: study.id,
    fileCount: study.files.length,
  });

  const isOwner = session.userId === study.createdByUserId;

  // Parallelize all remaining data fetches
  const linkedPersona = study.heuristicEvaluation.persona as
    | { studyId: string }
    | null
    | undefined;

  const [
    isTeamAdmin,
    presignedUrls,
    personaData,
    [createdByImageUrl, lastModifiedByImageUrl],
  ] = await Promise.all([
    // Check if user is team admin
    study.teamId
      ? isUserTeamAdmin(session.userId, study.teamId)
      : Promise.resolve(false),

    // Get presigned URLs for study files
    Promise.all(
      study.files.map(async (file: { key?: string; id: string }) => {
        if (!file.key) return null;
        const result = await getPresignedUrls(file.key);
        return result.success && result.data ? result.data : null;
      }),
    ).then((urls) => urls.filter((url): url is string => url !== null)),

    // Fetch persona data if linked
    (async () => {
      if (!linkedPersona?.studyId) {
        return {
          photoUrl: null as string | null,
          name: null as string | null,
          description: null as string | null,
          hasAccess: false,
        };
      }

      const [personaBasicInfo, hasAccess] = await Promise.all([
        getPersonaBasicInfo(linkedPersona.studyId),
        canAccessStudy(linkedPersona.studyId, session.userId),
      ]);

      let photoUrl: string | null = null;
      if (personaBasicInfo?.photoKey) {
        const result = await getPresignedUrls(personaBasicInfo.photoKey);
        photoUrl = result.success && result.data ? result.data : null;
      }

      return {
        photoUrl,
        name: personaBasicInfo?.name ?? null,
        description: personaBasicInfo?.description ?? null,
        hasAccess,
      };
    })(),

    // Get user profile images
    Promise.all([
      getUserImageUrl(study.createdByUser),
      getUserImageUrl(study.lastModifiedByUser ?? study.createdByUser),
    ]),
  ]);

  const canManageStudy = isOwner || isTeamAdmin;

  logger.debug("Presigned URLs generated", {
    userId: session.userId,
    studyId: study.id,
    fileCount: presignedUrls.length,
  });

  if (linkedPersona?.studyId) {
    logger.debug("Persona info fetched for evaluation", {
      userId: session.userId,
      studyId: study.id,
      personaStudyId: linkedPersona.studyId,
      hasAccess: personaData.hasAccess,
      hasBasicInfo: !!personaData.name,
    });
  }

  // Group, add placeholders for missing heuristics, and sort results
  const familyHeuristics =
    study.heuristicEvaluation.heuristicFamily?.heuristics || [];
  const groupedResultsByHeuristic = sortHeuristicResults(
    addPlaceholderHeuristics(
      groupResultsByHeuristic(study.heuristicEvaluation.results),
      familyHeuristics,
      study.heuristicEvaluation.id,
    ),
  );

  // Count violated heuristics
  const violated = Object.values(groupedResultsByHeuristic).filter(
    (items: HEResultData[]) => items.some((item: HEResultData) => item.violated),
  ).length;

  logger.debug("Results processed successfully", {
    userId: session.userId,
    studyId: study.id,
    heuristicGroups: Object.keys(groupedResultsByHeuristic).length,
    violatedHeuristics: violated,
  });

  logger.info("Evaluation page rendered successfully", {
    userId: session.userId,
    studyId: study.id,
  });

  const ownerDisplayName =
    study.createdByUser?.name?.trim() ||
    study.createdByUser?.email ||
    "Unknown member";

  const lastModifiedByDisplayName =
    study.lastModifiedByUser?.name?.trim() ||
    study.lastModifiedByUser?.email ||
    ownerDisplayName;

  const createdByDisplayUser = study.createdByUser
    ? { ...study.createdByUser, image: createdByImageUrl }
    : ownerDisplayName
      ? { name: ownerDisplayName, email: undefined, image: null, status: null }
      : null;

  const lastModifiedByDisplayUser = study.lastModifiedByUser
    ? { ...study.lastModifiedByUser, image: lastModifiedByImageUrl }
    : study.createdByUser
      ? { ...study.createdByUser, image: createdByImageUrl }
      : lastModifiedByDisplayName
        ? {
            name: lastModifiedByDisplayName,
            email: undefined,
            image: null,
            status: null,
          }
        : null;

  const formatDateTime = (value: string | Date) =>
    new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));

  const createdAtFormatted = formatDateTime(study.createdAt);
  const updatedAtFormatted = formatDateTime(study.updatedAt);

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
            <BreadcrumbPage>Results</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="mb-4 flex items-start justify-between">
        <div className="flex grow flex-col">
          <small className="text-sm leading-none font-bold text-zinc-500 uppercase">
            Evaluation
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

      <StudyMetadataCard
        goal={study.heuristicEvaluation.goal}
        user={study.heuristicEvaluation.user}
        heuristicFamilyName={
          study.heuristicEvaluation.heuristicFamily?.name || "Unknown"
        }
        context={study.heuristicEvaluation.context}
        presignedUrls={presignedUrls}
        linkedPersona={linkedPersona}
        personaData={personaData}
        createdByDisplayUser={createdByDisplayUser}
        lastModifiedByDisplayUser={lastModifiedByDisplayUser}
        createdAtFormatted={createdAtFormatted}
        updatedAtFormatted={updatedAtFormatted}
      />

      <Suspense fallback={<HeuristicResultsSkeleton />}>
        <HeuristicResults
          groupedResultsByHeuristic={groupedResultsByHeuristic}
          violated={violated}
          presignedUrls={presignedUrls}
          files={study.files}
          studyId={study.id}
          userId={session.userId}
          heuristicEvaluationId={study.heuristicEvaluation.id}
          canManage={canManageStudy}
        />
      </Suspense>
    </div>
  );
}
