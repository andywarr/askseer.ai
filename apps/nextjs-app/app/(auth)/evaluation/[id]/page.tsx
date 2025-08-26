// Next imports
import { redirect } from "next/navigation";
import Link from "next/link";

// Lib function imports
import {
  convertFromHeuristicType,
  getPresignedUrls,
} from "@/apps/nextjs-app/lib/action";
import { getCurrentSession } from "@/apps/nextjs-app/lib/user";
import {
  getHeuristicEvaluation,
  updateStudyName,
} from "@/apps/nextjs-app/lib/data";
import { logger } from "@/apps/nextjs-app/lib/logger";
import { getPersona } from "@/apps/nextjs-app/lib/data";

// Components imports
import Gallery from "@/apps/nextjs-app/components/gallery";
import MoreMenu from "@/apps/nextjs-app/components/study-details-more-menu";
import { MenuSurface } from "@/apps/nextjs-app/lib/constants";
import Title from "@/apps/nextjs-app/components/title";
import HeuristicResults from "@/apps/nextjs-app/components/heuristic-results";

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
import { ViolatedType } from "@prisma/client";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/apps/nextjs-app/components/ui/avatar";

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  // Get session data (authentication already verified in layout)
  const session = await getCurrentSession();

  const study = await getHeuristicEvaluation(id, session.userId);

  if (!study || !study.heuristicEvaluation) {
    logger.warn("Evaluation not found", {
      userId: session.userId,
      studyId: id,
      studyExists: !!study,
      heuristicEvaluationExists: !!study?.heuristicEvaluation,
    });
    redirect("/error");
  }

  if (session.userId !== study.userId) {
    logger.warn("Unauthorized access attempt", {
      studyId: id,
      studyOwnerId: study.userId,
      requestingUserId: session.userId,
    });
    // TODO: Need to redirect to a better page
    redirect("/error");
  }

  logger.debug("Evaluation retrieved successfully", {
    userId: session.userId,
    studyId: study.id,
    fileCount: study.files.length,
  });

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
    (items: any) =>
      items.some((item: any) => item.violated === ViolatedType.YES),
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
            Evaluation
          </small>
          <Title
            studyId={study.id}
            userId={session.userId}
            updateStudyName={updateStudyName}
          >
            {study.name ? study.name : "Untitled"}
          </Title>
        </div>
        <div className="ml-4 flex">
          <MoreMenu
            study={study}
            userId={session.userId}
            surface={MenuSurface.EVALUATION}
          />
        </div>
      </div>

      <div className="mb-8 rounded-lg bg-gray-100 p-6 text-sm">
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
              {convertFromHeuristicType(study.heuristicEvaluation.type)}
            </p>
          </div>

          <div className="sm:col-span-2 lg:col-span-3">
            <p className="leading-5 font-semibold tracking-tight">
              Additional context
            </p>
            <p className="leading-5">
              {study.heuristicEvaluation.context
                ? study.heuristicEvaluation.context
                : "None"}
            </p>
          </div>
        </div>

        <div className="flex flex-nowrap gap-4 overflow-x-auto">
          <Gallery presignedUrls={presignedUrls} />
        </div>
      </div>

      <HeuristicResults
        groupedResultsByHeuristic={groupedResultsByHeuristic}
        violated={violated}
        type={convertFromHeuristicType(study.heuristicEvaluation.type)}
        presignedUrls={presignedUrls}
        files={study.files}
        studyId={study.id}
        userId={session.userId}
        heuristicEvaluationId={study.heuristicEvaluation.id}
      />
    </div>
  );
}
