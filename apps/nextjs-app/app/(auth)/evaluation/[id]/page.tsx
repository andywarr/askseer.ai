// Next imports
import { redirect } from "next/navigation";
import Link from "next/link";

// Lib function imports
import { getPresignedUrls } from "@/apps/nextjs-app/lib/action";
import { getCurrentSession } from "@/apps/nextjs-app/lib/user";
import {
  getHeuristicEvaluation,
  isUserTeamAdmin,
  updateStudyName,
  getStarredStudyIds,
  getStudyPublicRedirectInfo,
  getStudyShareInfo,
  getCompanyByMyDomain,
} from "@/apps/nextjs-app/lib/data";
import { logger } from "@/apps/shared/logger";
import { getPersona } from "@/apps/nextjs-app/lib/data";

// Components imports
import Gallery from "@/apps/nextjs-app/components/study/gallery";
import MoreMenu from "@/apps/nextjs-app/components/study/study-details-more-menu";
import { StarStudyButton } from "@/apps/nextjs-app/components/study/star-study-button";
import { ShareStudyButton } from "@/apps/nextjs-app/components/study/share-study-button";
import { MenuSurface } from "@/apps/nextjs-app/lib/constants";
import Title from "@/apps/nextjs-app/components/study/title";
import HeuristicResults from "@/apps/nextjs-app/app/(auth)/evaluation/[id]/heuristic-results";
import { UserMetadataDisplay } from "@/apps/nextjs-app/components/study/user-metadata";

// UI component imports
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/apps/nextjs-app/components/ui/breadcrumb";

// Prism imports
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/apps/nextjs-app/components/ui/avatar";

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  // Get session data (authentication already verified in layout)
  const session = await getCurrentSession();

  const [study, starredStudyIds, shareInfo] = await Promise.all([
    getHeuristicEvaluation(id, session.userId),
    getStarredStudyIds(session.userId),
    getStudyShareInfo(id, session.userId),
  ]);

  const isStarred = starredStudyIds.includes(id);
  // Personal teams only have "Only me" and "Anyone with the link" options
  const isCompanyTeam = shareInfo?.team && !shareInfo.team.isPersonal;

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

    logger.warn("Evaluation not found", {
      userId: session.userId,
      studyId: id,
      studyExists: !!study,
      heuristicEvaluationExists: !!study?.heuristicEvaluation,
    });
    redirect("/error");
  }

  logger.debug("Evaluation retrieved successfully", {
    userId: session.userId,
    studyId: study.id,
    fileCount: study.files.length,
  });

  const isOwner = session.userId === study.createdByUserId;
  const isTeamAdmin = study.teamId
    ? await isUserTeamAdmin(session.userId, study.teamId)
    : false;
  const canManageStudy = isOwner || isTeamAdmin;

  // Get presigned URLs for the study files
  const presignedUrls = await Promise.all(
    study.files.map((file: any) =>
      file.key ? getPresignedUrls(file.key) : "",
    ),
  );

  logger.debug("Presigned URLs generated", {
    userId: session.userId,
    studyId: study.id,
    fileCount: presignedUrls.length,
  });

  // If a persona is linked, fetch the persona study to get photo key and details
  let personaPhotoUrl: string | null = null;
  let personaName: string | null = null;
  let personaDescription: string | null = null;
  let personaInitials: string = "?";
  const linkedPersona: any = (study as any)?.heuristicEvaluation?.persona;
  if (linkedPersona?.studyId) {
    try {
      const personaStudy: any = await getPersona(
        linkedPersona.studyId,
        session.userId,
      );
      const photoKey: string | undefined =
        personaStudy?.persona?.photoFile?.key;
      personaName = personaStudy?.persona?.name ?? null;
      personaDescription = personaStudy?.persona?.description ?? null;
      if (photoKey) {
        personaPhotoUrl = await getPresignedUrls(photoKey);
      }
      if (personaName) {
        const parts = String(personaName).trim().split(/\s+/);
        personaInitials =
          parts
            .slice(0, 2)
            .map((p) => p[0]?.toUpperCase())
            .join("") || "?";
      }
    } catch (e) {
      logger.warn("Failed to fetch linked persona for evaluation", {
        userId: session.userId,
        studyId: study.id,
        personaStudyId: linkedPersona.studyId,
        error: (e as Error)?.message,
      });
    }
  }

  // Group the heuristic evaluation results by heuristic ID.
  const groupedResultsByHeuristic = study.heuristicEvaluation.results.reduce(
    (acc: { [key: string]: any[] }, result: any) => {
      if (!acc[result.heuristicId]) {
        acc[result.heuristicId] = [];
      }
      acc[result.heuristicId].push(result);
      return acc;
    },
    {},
  );

  // Add entries for heuristics from the family that have no results yet
  // This ensures all heuristics are displayed even if they have no issues
  const familyHeuristics =
    study.heuristicEvaluation.heuristicFamily?.heuristics || [];
  for (const heuristic of familyHeuristics) {
    if (!groupedResultsByHeuristic[heuristic.id]) {
      // Create a placeholder entry with the heuristic info but no violated results
      groupedResultsByHeuristic[heuristic.id] = [
        {
          id: `placeholder-${heuristic.id}`,
          heuristicId: heuristic.id,
          heuristicEvaluationId: study.heuristicEvaluation.id,
          violated: false,
          reason: "",
          severity: null,
          rating: null,
          source: "PLACEHOLDER",
          recommendations: [],
          heuristic: heuristic,
          step: undefined,
          fileId: undefined,
        },
      ];
    }
  }

  // Sort each group by step if it exists
  Object.keys(groupedResultsByHeuristic).forEach((key) => {
    groupedResultsByHeuristic[key].sort((a: any, b: any) => {
      // If both have steps, sort numerically
      if (a.step !== undefined && b.step !== undefined) {
        return a.step - b.step;
      }
      // If neither has a step, maintain original order (stable sort)
      if (a.step === undefined && b.step === undefined) {
        return 0;
      }
      // Mixed case: items with steps come first
      if (a.step !== undefined && b.step === undefined) {
        return -1;
      }
      if (a.step === undefined && b.step !== undefined) {
        return 1;
      }
      return 0;
    });
  });

  // Count violated heuristics
  const violated = Object.values(groupedResultsByHeuristic).filter(
    (items: any) => items.some((item: any) => item.violated),
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
          <StarStudyButton
            studyId={study.id}
            userId={session.userId}
            isStarred={isStarred}
          />
          {shareInfo && (
            <ShareStudyButton
              studyId={study.id}
              visibility={shareInfo.visibility}
              shareToken={shareInfo.shareToken}
              hasCompany={isCompanyTeam}
            />
          )}
          <MoreMenu
            study={study}
            userId={session.userId}
            surface={MenuSurface.EVALUATION}
            canDelete={canManageStudy}
            isStarred={isStarred}
          />
        </div>
      </div>

      <div className="mb-8 min-w-0 overflow-hidden rounded-lg bg-gray-100 p-6 text-sm">
        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <p className="leading-5 font-semibold tracking-tight">User goal</p>
            <p className="leading-5">{study.heuristicEvaluation.goal}</p>
          </div>

          <div>
            <p className="leading-5 font-semibold tracking-tight">
              Target user
            </p>
            {linkedPersona ? (
              <Link
                href={`/persona/${linkedPersona.studyId}`}
                className="mt-1 flex items-center gap-3 hover:opacity-90"
              >
                <Avatar className="h-10 w-10">
                  {personaPhotoUrl ? (
                    <AvatarImage
                      src={personaPhotoUrl}
                      alt={personaName ?? "Persona"}
                    />
                  ) : (
                    <AvatarFallback>{personaInitials}</AvatarFallback>
                  )}
                </Avatar>
                <div className="flex min-w-0 flex-col">
                  <span className="truncate leading-5 font-medium">
                    {personaName ?? "Unnamed persona"}
                  </span>
                  <span className="truncate leading-5 text-zinc-600">
                    {personaDescription ?? "No description"}
                  </span>
                </div>
              </Link>
            ) : (
              <p className="leading-5">
                {study.heuristicEvaluation.user
                  ? study.heuristicEvaluation.user
                  : "Not defined"}
              </p>
            )}
          </div>

          <div>
            <p className="leading-5 font-semibold tracking-tight">Heuristics</p>
            <p className="leading-5">
              {study.heuristicEvaluation.heuristicFamily?.name || "Unknown"}
            </p>
          </div>

          {study.heuristicEvaluation.context && (
            <div className="sm:col-span-2 lg:col-span-3">
              <p className="leading-5 font-semibold tracking-tight">
                Additional context
              </p>
              <p className="leading-5">{study.heuristicEvaluation.context}</p>
            </div>
          )}
        </div>

        <div className="print:hidden">
          <Gallery presignedUrls={presignedUrls} />
        </div>
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
    </div>
  );
}
