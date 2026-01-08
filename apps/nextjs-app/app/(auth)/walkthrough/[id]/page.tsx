// Next imports
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import Link from "next/link";

// Lib function imports
import { getPresignedUrls } from "@/apps/nextjs-app/lib/actions/s3-actions";
import { getCurrentSession } from "@/apps/nextjs-app/lib/user";
import {
  getCognitiveWalkthrough,
  isUserTeamAdmin,
  updateStudyName,
  getBookmarkedStudyIds,
  getStudyPublicRedirectInfo,
  getStudyShareInfo,
  canAccessStudy,
  getPersonaBasicInfo,
} from "@/apps/nextjs-app/lib/data";
import {
  handleCreateCWRecommendation,
  handleDeleteCWRecommendation,
  handleCreateCWIssue,
} from "@/apps/nextjs-app/lib/actions/walkthrough-actions";
import { logger } from "@/apps/shared/logger";

// Components imports
import { CognitiveWalkthroughClient } from "@/apps/nextjs-app/app/(auth)/walkthrough/[id]/cognitive-walkthrough-client";
import Gallery from "@/apps/nextjs-app/components/study/gallery";
import MoreMenu from "@/apps/nextjs-app/components/study/study-details-more-menu";
import { StudyAccessDenied } from "@/apps/nextjs-app/components/study/study-access-denied";
import { BookmarkStudyButton } from "@/apps/nextjs-app/components/study/bookmark-study-button";
import { ShareStudyButton } from "@/apps/nextjs-app/components/study/share-study-button";
import { MenuSurface } from "@/apps/nextjs-app/lib/constants";
import { UserMetadataDisplay } from "@/apps/nextjs-app/components/study/user-metadata";
import { PersonaDisplay } from "@/apps/nextjs-app/components/persona/persona-display";

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
  const isTeamAdmin = study.teamId
    ? await isUserTeamAdmin(session.userId, study.teamId)
    : false;
  const canManageStudy = isOwner || isTeamAdmin;

  const presignedUrls = (
    await Promise.all(
      study.files.map(async (file: any) => {
        if (!file.key) return null;
        const result = await getPresignedUrls(file.key);
        return result.success && result.data ? result.data : null;
      }),
    )
  ).filter((url): url is string => url !== null);

  logger.debug("Presigned URLs generated", {
    userId: session.userId,
    studyId: study.id,
    fileCount: presignedUrls.length,
  });

  logger.info("Walkthrough page rendered successfully", {
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

  const lastModifiedByUser =
    study.lastModifiedByUser ?? study.createdByUser ?? null;

  const createdByDisplayUser =
    study.createdByUser ??
    (ownerDisplayName
      ? { name: ownerDisplayName, email: undefined, image: null, status: null }
      : null);

  const lastModifiedByDisplayUser =
    lastModifiedByUser ??
    (lastModifiedByDisplayName
      ? {
          name: lastModifiedByDisplayName,
          email: undefined,
          image: null,
          status: null,
        }
      : null);

  const formatDateTime = (value: string | Date) =>
    new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));

  const createdAtFormatted = formatDateTime(study.createdAt);
  const updatedAtFormatted = formatDateTime(study.updatedAt);

  // If a persona is linked, fetch basic info and check access
  let personaPhotoUrl: string | null = null;
  let personaName: string | null = null;
  let personaDescription: string | null = null;
  let hasPersonaAccess: boolean = false;
  // Prefer DB relation (like heuristic evaluation) and fall back to jobData payload
  const linkedPersonaStudyId: string | undefined =
    (study as any)?.cognitiveWalkthrough?.persona?.studyId ||
    (study as any)?.jobData?.payload?.persona?.studyId;
  if (linkedPersonaStudyId) {
    // Fetch basic persona info (always available regardless of access)
    const personaBasicInfo = await getPersonaBasicInfo(linkedPersonaStudyId);
    if (personaBasicInfo) {
      personaName = personaBasicInfo.name;
      personaDescription = personaBasicInfo.description;
      if (personaBasicInfo.photoKey) {
        const result = await getPresignedUrls(personaBasicInfo.photoKey);
        personaPhotoUrl = result.success && result.data ? result.data : null;
      }
    }

    // Check if user has access to click through to the persona
    hasPersonaAccess = await canAccessStudy(
      linkedPersonaStudyId,
      session.userId,
    );

    logger.debug("Persona info fetched for walkthrough", {
      userId: session.userId,
      studyId: study.id,
      personaStudyId: linkedPersonaStudyId,
      hasAccess: hasPersonaAccess,
      hasBasicInfo: !!personaBasicInfo,
    });
  }

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
      <Breadcrumb className="mb-6">
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
          />
        </div>
      </div>

      <div className="mb-8 rounded-lg bg-gray-100 p-6 text-sm">
        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <p className="leading-5 font-semibold tracking-tight">User goal</p>
            <p className="leading-5">{study.cognitiveWalkthrough.goal}</p>
          </div>

          <div>
            <p className="leading-5 font-semibold tracking-tight">
              Target user
            </p>
            {linkedPersonaStudyId ? (
              <PersonaDisplay
                personaStudyId={linkedPersonaStudyId}
                name={personaName}
                description={personaDescription}
                photoUrl={personaPhotoUrl}
                hasAccess={hasPersonaAccess}
              />
            ) : (
              <p className="leading-5">
                {study.cognitiveWalkthrough.user
                  ? study.cognitiveWalkthrough.user
                  : "Not defined"}
              </p>
            )}
          </div>
        </div>

        {study.cognitiveWalkthrough.context && (
          <div className="mb-4 flex">
            <div className="grow">
              <p className="leading-5 font-semibold tracking-tight">
                Additional context
              </p>
              <p className="leading-5">{study.cognitiveWalkthrough.context}</p>
            </div>
          </div>
        )}

        <Gallery presignedUrls={presignedUrls} />
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
    </div>
  );
}
