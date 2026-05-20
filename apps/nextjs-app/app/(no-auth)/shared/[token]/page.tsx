// Next imports
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

// Lib function imports
import { getStudyByShareToken } from "@/apps/nextjs-app/lib/db/data";
import { getPublicPresignedUrl } from "@/apps/nextjs-app/lib/actions/s3-actions";
import { logger } from "@/apps/shared/logger";
import { StudyType } from "@prisma/client";

// Components imports
import { SharedHeuristicEvaluation } from "@/apps/nextjs-app/app/(no-auth)/shared/[token]/shared-heuristic-evaluation";
import { SharedCognitiveWalkthrough } from "@/apps/nextjs-app/app/(no-auth)/shared/[token]/shared-cognitive-walkthrough";
import { SharedPersonaView } from "@/apps/nextjs-app/app/(no-auth)/shared/[token]/shared-persona-view";
import { SharedAnalysisInsightsClient } from "@/apps/nextjs-app/app/(no-auth)/shared/[token]/shared-analysis-insights-client";
import { SharedTakeaways } from "@/apps/nextjs-app/app/(no-auth)/shared/[token]/shared-takeaways";
import Gallery from "@/apps/nextjs-app/components/study/gallery";

// UI component imports
import { Button } from "@/apps/nextjs-app/components/ui/button";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/apps/nextjs-app/components/ui/avatar";
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

export const metadata = {
  title: "Shared Study | Seer",
  description: "View a shared UX research study",
};

export default async function SharedStudyPage(props: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await props.params;

  const study = await getStudyByShareToken(token);

  if (!study) {
    logger.info("Shared study not found or not public", { token });
    notFound();
  }

  logger.info("Shared study page rendered", {
    studyId: study.id,
    studyType: study.type,
  });

  // Get presigned URLs for the study files (using public function since study is already verified as public)
  const presignedUrls = await Promise.all(
    study.files.map(async (file: any) => {
      if (!file.key) return "";
      const result = await getPublicPresignedUrl(file.key);
      return result.success && result.data ? result.data : "";
    }),
  );

  // Get persona photo URL if linked
  let personaName: string | null = null;
  let personaDescription: string | null = null;
  let personaPhotoUrl: string | null = null;
  let personaInitials: string = "?";

  // Check for linked persona in heuristic evaluation or cognitive walkthrough
  const linkedPersona =
    (study as any)?.heuristicEvaluation?.persona ||
    (study as any)?.cognitiveWalkthrough?.persona;

  if (linkedPersona?.name) {
    personaName = linkedPersona.name;
    personaDescription = linkedPersona.description ?? null;
    const parts = String(personaName).trim().split(/\s+/);
    personaInitials =
      parts
        .slice(0, 2)
        .map((p) => p[0]?.toUpperCase())
        .join("") || "?";

    // Get photo URL if available
    if (linkedPersona.photoFile?.key) {
      try {
        const result = await getPublicPresignedUrl(linkedPersona.photoFile.key);
        personaPhotoUrl = result.success && result.data ? result.data : null;
      } catch (e) {
        logger.warn("Failed to get persona photo URL", { error: e });
      }
    }
  }

  const formatDateTime = (value: string | Date) =>
    new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));

  const createdAtFormatted = formatDateTime(study.createdAt);
  const updatedAtFormatted = formatDateTime(study.updatedAt);

  // Get display names for metadata (just names for public sharing, no emails/avatars)
  const createdByName = study.createdByUser?.name || "Unknown";
  const lastModifiedByName =
    (study as any).lastModifiedByUser?.name ||
    study.createdByUser?.name ||
    "Unknown";

  const getStudyTypeLabel = (type: StudyType): string => {
    switch (type) {
      case StudyType.COGNITIVE_WALKTHROUGH:
        return "Walkthrough";
      case StudyType.HEURISTIC_EVALUATION:
        return "Evaluation";
      case StudyType.PERSONA:
        return "Persona";
      case StudyType.QUAL_ANALYSIS:
        return "Analysis";
      default:
        return "Study";
    }
  };

  // Handle persona type differently
  if (study.type === StudyType.PERSONA && study.persona) {
    return (
      <div className="min-h-screen bg-white dark:bg-zinc-950">
        {/* Header */}
        <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
            <Link href="/" className="flex items-center gap-2">
              <Image
                alt="logo"
                className="h-8 w-8"
                src="/logo.svg"
                width={32}
                height={32}
              />
              <h1 className="scroll-m-20 text-4xl font-extrabold tracking-tight text-black md:text-5xl dark:text-white">
                Seer
              </h1>
            </Link>
            <Button asChild variant="default" size="sm">
              <Link href="/signin">Sign in</Link>
            </Button>
          </div>
        </header>

        {/* Persona content */}
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <SharedPersonaView
            study={study}
            presignedUrls={presignedUrls}
            shareToken={token}
          />
        </main>

        {/* Footer CTA */}
        <footer className="border-t border-zinc-200 bg-white py-8 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Want to instantly uncover customer insights?
            </h2>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              Seer uses AI to help you evaluate designs and uncover usability
              issues.
            </p>
            <Button asChild className="mt-4">
              <Link href="/signin">Get started for free</Link>
            </Button>
          </div>
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      {/* Header */}
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2">
            <Image
              alt="logo"
              className="h-8 w-8"
              src="/logo.svg"
              width={32}
              height={32}
            />
            <h1 className="scroll-m-20 text-4xl font-extrabold tracking-tight text-black md:text-5xl dark:text-white">
              Seer
            </h1>
          </Link>
          <Button asChild variant="default" size="sm">
            <Link href="/signin">Sign in</Link>
          </Button>
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div>
          {/* Title section matching auth pages */}
          <div className="mb-4 flex items-start justify-between">
            <div className="flex grow flex-col">
              <small className="text-sm leading-none font-bold text-zinc-500 uppercase">
                {getStudyTypeLabel(study.type)}
              </small>
              <h1 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl dark:text-zinc-100">
                {study.name || "Untitled"}
              </h1>
            </div>
          </div>

          {/* Study details box */}
          {study.type === StudyType.QUAL_ANALYSIS ? (
            <div className="mb-8 min-w-0 overflow-hidden rounded-lg bg-gray-100 p-6 text-sm dark:bg-zinc-800">
              {((study as any).qualitativeAnalysis?.goal ||
                (study as any).qualitativeAnalysis?.inferredGoal) && (
                <div className="mb-4">
                  <p className="leading-5 font-semibold tracking-tight">
                    Research Goal
                  </p>
                  <p className="leading-5">
                    {(study as any).qualitativeAnalysis?.goal ||
                      (study as any).qualitativeAnalysis?.inferredGoal}
                  </p>
                </div>
              )}

              {study.files && study.files.length > 0 && (
                <div
                  className="mb-4 flex gap-3 overflow-x-auto pb-2"
                  style={{ scrollbarWidth: "none" }}
                >
                  {study.files.map((file: any, index: number) => {
                    const url = presignedUrls[index];
                    return (
                      <a
                        key={file.id}
                        href={url || "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex shrink-0 items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 py-2 transition-colors hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-500 dark:hover:bg-zinc-800"
                      >
                        <FileIcon fileType={file.fileType || null} />
                        <span className="max-w-40 truncate text-xs text-zinc-600 dark:text-zinc-400">
                          {file.originalName || "Untitled"}
                        </span>
                      </a>
                    );
                  })}
                </div>
              )}

              {/* Metadata */}
              <div className="grid gap-4 text-sm text-zinc-600 sm:grid-cols-4 dark:text-zinc-400">
                <div>
                  <p className="font-semibold text-zinc-700 dark:text-zinc-300">
                    Created by
                  </p>
                  <p>{createdByName}</p>
                </div>
                <div>
                  <p className="font-semibold text-zinc-700 dark:text-zinc-300">
                    Created on
                  </p>
                  <p>{createdAtFormatted}</p>
                </div>
                <div>
                  <p className="font-semibold text-zinc-700 dark:text-zinc-300">
                    Modified by
                  </p>
                  <p>{lastModifiedByName}</p>
                </div>
                <div>
                  <p className="font-semibold text-zinc-700 dark:text-zinc-300">
                    Last modified
                  </p>
                  <p>{updatedAtFormatted}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="mb-8 min-w-0 overflow-hidden rounded-lg bg-gray-100 p-6 text-sm dark:bg-zinc-800">
              <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                {/* Goal */}
                <div>
                  <p className="leading-5 font-semibold tracking-tight">
                    {study.type === StudyType.QUAL_ANALYSIS
                      ? "Research goal"
                      : "User goal"}
                  </p>
                  <p className="leading-5">
                    {study.heuristicEvaluation?.goal ||
                      study.cognitiveWalkthrough?.goal ||
                      (study as any).qualitativeAnalysis?.goal ||
                      (study as any).qualitativeAnalysis?.inferredGoal ||
                      "Not defined"}
                  </p>
                </div>

                {/* Target user */}
                <div>
                  <p className="leading-5 font-semibold tracking-tight">
                    Target user
                  </p>
                  {linkedPersona ? (
                    <div className="mt-1 flex items-center gap-3">
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
                    </div>
                  ) : (
                    <p className="leading-5">
                      {study.heuristicEvaluation?.user ||
                        study.cognitiveWalkthrough?.user ||
                        "Not defined"}
                    </p>
                  )}
                </div>

                {/* Heuristics (for evaluation) */}
                {study.type === StudyType.HEURISTIC_EVALUATION &&
                  study.heuristicEvaluation && (
                    <div>
                      <p className="leading-5 font-semibold tracking-tight">
                        Heuristics
                      </p>
                      <p className="leading-5">
                        {study.heuristicEvaluation.heuristicFamily?.name ||
                          "Unknown"}
                      </p>
                    </div>
                  )}

                {/* Context */}
                {(study.heuristicEvaluation?.context ||
                  study.cognitiveWalkthrough?.context ||
                  (study as any).qualitativeAnalysis?.context) && (
                  <div className="sm:col-span-2 lg:col-span-3">
                    <p className="leading-5 font-semibold tracking-tight">
                      Additional context
                    </p>
                    <p className="leading-5">
                      {study.heuristicEvaluation?.context ||
                        study.cognitiveWalkthrough?.context ||
                        (study as any).qualitativeAnalysis?.context}
                    </p>
                  </div>
                )}
              </div>

              {/* Gallery */}
              {presignedUrls.length > 0 && (
                <div>
                  <Gallery presignedUrls={presignedUrls} />
                </div>
              )}

              {/* Metadata */}
              <div className="mt-6 grid gap-4 text-sm text-zinc-600 sm:grid-cols-4 dark:text-zinc-400">
                <div>
                  <p className="font-semibold text-zinc-700 dark:text-zinc-300">
                    Created by
                  </p>
                  <p>{createdByName}</p>
                </div>
                <div>
                  <p className="font-semibold text-zinc-700 dark:text-zinc-300">
                    Created on
                  </p>
                  <p>{createdAtFormatted}</p>
                </div>
                <div>
                  <p className="font-semibold text-zinc-700 dark:text-zinc-300">
                    Modified by
                  </p>
                  <p>{lastModifiedByName}</p>
                </div>
                <div>
                  <p className="font-semibold text-zinc-700 dark:text-zinc-300">
                    Last modified
                  </p>
                  <p>{updatedAtFormatted}</p>
                </div>
              </div>
            </div>
          )}

          {/* Key Takeaways */}
          {(study as any).tldrStatus === "COMPLETED" &&
            (study as any).takeaways?.length > 0 && (
              <SharedTakeaways takeaways={(study as any).takeaways} />
            )}

          {/* Study Results */}
          {study.type === StudyType.HEURISTIC_EVALUATION &&
            study.heuristicEvaluation && (
              <SharedHeuristicEvaluation
                evaluation={study.heuristicEvaluation}
                presignedUrls={presignedUrls}
                files={study.files}
              />
            )}

          {study.type === StudyType.COGNITIVE_WALKTHROUGH &&
            study.cognitiveWalkthrough && (
              <SharedCognitiveWalkthrough
                walkthrough={study.cognitiveWalkthrough}
                presignedUrls={presignedUrls}
                files={study.files}
              />
            )}

          {study.type === StudyType.QUAL_ANALYSIS &&
            (study as any).qualitativeAnalysis && (
              <SharedAnalysisInsightsClient
                summary={(study as any).qualitativeAnalysis.summary}
                summarySource={(study as any).qualitativeAnalysis.summarySource}
                insights={(study as any).qualitativeAnalysis.insights || []}
                studyId={study.id}
                qualitativeAnalysisId={(study as any).qualitativeAnalysis.id}
                sourceFiles={study.files.map((file: any, index: number) => ({
                  id: file.id,
                  originalName: file.originalName,
                  fileType: file.fileType,
                  transcript: file.transcript,
                  identifier: file.identifier,
                  mediaUrl: presignedUrls[index] || null,
                }))}
              />
            )}
        </div>
      </main>

      {/* Footer CTA */}
      <footer className="border-t border-zinc-200 bg-white py-8 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Want to instantly uncover customer insights?
          </h2>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Seer uses AI to help you evaluate designs and uncover usability
            issues.
          </p>
          <Button asChild className="mt-4">
            <Link href="/signin">Get started for free</Link>
          </Button>
        </div>
      </footer>
    </div>
  );
}
