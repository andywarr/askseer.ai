// Next imports
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { Suspense } from "react";

// Lib function imports
import { getPresignedUrls } from "@/apps/nextjs-app/lib/actions/s3-actions";
import { getCurrentSession } from "@/apps/nextjs-app/lib/db/user";
import { getUserImageUrl } from "@/apps/nextjs-app/lib/utils/user-image";
import {
  getCognitiveWalkthrough,
  isUserTeamAdmin,
  updateStudyName,
  getBookmarkedStudyIds,
  getStudyPublicRedirectInfo,
  getStudyShareInfo,
  canAccessStudy,
  getPersonaBasicInfo,
  getStudyTransferPermissions,
} from "@/apps/nextjs-app/lib/db/data";
import {
  handleCreateCWRecommendation,
  handleDeleteCWRecommendation,
  handleCreateCWIssue,
} from "@/apps/nextjs-app/lib/actions/walkthrough-actions";
import { logger } from "@/apps/shared/logger";
import {
  formatDateTime,
  buildDisplayUsers,
} from "@/apps/nextjs-app/lib/utils/study-helpers";
import { getStudyTakeaways } from "@/apps/nextjs-app/lib/db/data";

// Components imports
import { CognitiveWalkthroughClient } from "@/apps/nextjs-app/app/(auth)/walkthrough/[id]/cognitive-walkthrough-client";
import MoreMenu from "@/apps/nextjs-app/components/study/study-details-more-menu";
import { StudyAccessDenied } from "@/apps/nextjs-app/components/study/study-access-denied";
import { BookmarkStudyButton } from "@/apps/nextjs-app/components/study/bookmark-study-button";
import { ShareStudyButton } from "@/apps/nextjs-app/components/study/share-study-button";
import { MenuSurface } from "@/apps/nextjs-app/lib/utils/constants";
import { StudyMetadataCard } from "@/apps/nextjs-app/components/study/study-metadata-card";
import { CognitiveWalkthroughResultsSkeleton } from "@/apps/nextjs-app/app/(auth)/walkthrough/[id]/cognitive-walkthrough-results-skeleton";
import { StudyTldr } from "@/apps/nextjs-app/components/study/study-tldr";

// Ui component imports
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/apps/nextjs-app/components/ui/breadcrumb";
import Title from "@/apps/nextjs-app/components/study/title";

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  // Get session data (authentication already verified in layout)
  const session = await getCurrentSession();

  const [study, bookmarkedStudyIds, shareInfo] = await Promise.all([
    getCognitiveWalkthrough(id, session.userId),
    getBookmarkedStudyIds(session.userId),
    getStudyShareInfo(id, session.userId),
  ]);

  const isBookmarked = bookmarkedStudyIds.includes(id);
  // hasCompany: team belongs to a company (enables Private, Team, Company visibility options)
  // isPersonalTeam: personal teams don't show Team option (only Private and Company)
  const hasCompany = !!shareInfo?.team?.companyId;
  const isPersonalTeam = shareInfo?.team?.isPersonal ?? false;

  if (!study || !study.cognitiveWalkthrough) {
    // Check if this study is publicly shared and redirect if so
    const publicInfo = await getStudyPublicRedirectInfo(id);
    if (publicInfo?.shareToken) {
      logger.info("Redirecting to public shared study", {
        studyId: id,
        shareToken: publicInfo.shareToken,
      });
      redirect(`/shared/${publicInfo.shareToken}`);
    }

    logger.warn("Walkthrough not found or access denied", {
      userId: session.userId,
      studyId: id,
      studyExists: !!study,
      walkthroughExists: !!study?.cognitiveWalkthrough,
    });
    return <StudyAccessDenied studyType="walkthrough" />;
  }

  logger.debug("Walkthrough retrieved successfully", {
    userId: session.userId,
    studyId: study.id,
    stepCount: study.cognitiveWalkthrough.steps.length,
    fileCount: study.files.length,
  });

  const isOwner = session.userId === study.createdByUserId;

  // Prefer DB relation and fall back to jobData payload
  const linkedPersona: { studyId: string } | null | undefined = (study as any)
    ?.cognitiveWalkthrough?.persona?.studyId
    ? { studyId: (study as any).cognitiveWalkthrough.persona.studyId }
    : (study as any)?.jobData?.payload?.persona?.studyId
      ? { studyId: (study as any).jobData.payload.persona.studyId }
      : null;

  // Parallelize all remaining data fetches
  const [
    isTeamAdmin,
    presignedUrls,
    personaData,
    [createdByImageUrl, lastModifiedByImageUrl],
    takeaways,
  ] = await Promise.all([
    // Check if user is team admin
    study.teamId
      ? isUserTeamAdmin(session.userId, study.teamId)
      : Promise.resolve(false),

    // Get presigned URLs for study files
    Promise.all(
      study.files.map(async (file: any) => {
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

    // Fetch TLDR takeaways
    getStudyTakeaways(id, session.userId),
  ]);

  const canManageStudy = isOwner || isTeamAdmin;

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

  logger.debug("Presigned URLs generated", {
    userId: session.userId,
    studyId: study.id,
    fileCount: presignedUrls.length,
  });

  if (linkedPersona?.studyId) {
    logger.debug("Persona info fetched for walkthrough", {
      userId: session.userId,
      studyId: study.id,
      personaStudyId: linkedPersona.studyId,
      hasAccess: personaData.hasAccess,
      hasBasicInfo: !!personaData.name,
    });
  }

  logger.info("Walkthrough page rendered successfully", {
    userId: session.userId,
    studyId: study.id,
  });

  // Build display user objects
  const { createdByDisplayUser, lastModifiedByDisplayUser } = buildDisplayUsers(
    study,
    createdByImageUrl,
    lastModifiedByImageUrl,
  );

  const createdAtFormatted = formatDateTime(study.createdAt);
  const updatedAtFormatted = formatDateTime(study.updatedAt);

  const createIssueAction = canManageStudy
    ? async (stepId: string, issueType: string, content: string) => {
        "use server";
        const result = await handleCreateCWIssue(stepId, issueType, content);
        if (result.success) {
          logger.debug("Cognitive walkthrough issue created successfully", {
            userId: session.userId,
            studyId: study.id,
          });
          revalidatePath(`/walkthrough/${study.id}`);
        } else {
          logger.error("Failed to create cognitive walkthrough issue", {
            userId: session.userId,
            studyId: study.id,
            error: result.error,
          });
        }
        return result;
      }
    : undefined;

  const createRecommendationAction = canManageStudy
    ? async (issueId: string, content: string) => {
        "use server";
        const result = await handleCreateCWRecommendation(issueId, content);
        if (result.success) {
          logger.debug(
            "Cognitive walkthrough recommendation created successfully",
            {
              userId: session.userId,
              studyId: study.id,
              issueId,
            },
          );
          revalidatePath(`/walkthrough/${study.id}`);
        } else {
          logger.error(
            "Failed to create cognitive walkthrough recommendation",
            {
              userId: session.userId,
              studyId: study.id,
              issueId,
              error: result.error,
            },
          );
        }
        return result;
      }
    : undefined;

  const deleteRecommendationAction = canManageStudy
    ? async (issueId: string, recommendationId: string) => {
        "use server";
        const result = await handleDeleteCWRecommendation(recommendationId);
        if (result.success) {
          logger.debug(
            "Cognitive walkthrough recommendation deleted successfully",
            {
              userId: session.userId,
              studyId: study.id,
              issueId,
              recommendationId,
            },
          );
          revalidatePath(`/walkthrough/${study.id}`);
        } else {
          logger.error(
            "Failed to delete cognitive walkthrough recommendation",
            {
              userId: session.userId,
              studyId: study.id,
              issueId,
              recommendationId,
              error: result.error,
            },
          );
        }
        return result;
      }
    : undefined;

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
            Walkthrough
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
            surface={MenuSurface.WALKTHROUGH}
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
            canTransfer={canTransfer}
            transferDisabledReason={transferDisabledReason}
            adminTeams={adminTeams}
          />
        </div>
      </div>

      <StudyMetadataCard
        goal={study.cognitiveWalkthrough.goal}
        user={study.cognitiveWalkthrough.user}
        context={study.cognitiveWalkthrough.context}
        presignedUrls={presignedUrls}
        linkedPersona={linkedPersona}
        personaData={personaData}
        createdByDisplayUser={createdByDisplayUser}
        lastModifiedByDisplayUser={lastModifiedByDisplayUser}
        createdAtFormatted={createdAtFormatted}
        updatedAtFormatted={updatedAtFormatted}
      />

      <StudyTldr
        studyId={study.id}
        userId={session.userId}
        initialTldrStatus={(study as any).tldrStatus || "PENDING"}
        initialTakeaways={takeaways}
        canManage={canManageStudy}
      />

      <Suspense fallback={<CognitiveWalkthroughResultsSkeleton />}>
        <CognitiveWalkthroughClient
          initialSteps={study.cognitiveWalkthrough.steps}
          presignedUrls={presignedUrls}
          totalSteps={study.cognitiveWalkthrough?.steps.length ?? 0}
          studyId={study.id}
          userId={session.userId}
          files={study.files}
          canManage={canManageStudy}
          onCreateIssue={createIssueAction}
          onCreateRecommendation={createRecommendationAction}
          onDeleteRecommendation={deleteRecommendationAction}
        />
      </Suspense>
    </div>
  );
}
