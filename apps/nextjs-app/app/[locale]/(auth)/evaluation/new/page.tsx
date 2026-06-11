// Next imports
import Link from "next/link";

// Lib functions imports
import {
  getCurrentUser,
  canManageTeamFunds,
} from "@/apps/nextjs-app/lib/db/user";
import { logger } from "@/apps/shared/logger";
import { getTeam } from "@/apps/nextjs-app/lib/db/data";
import { getStudyUploadLimitForTeam } from "@/apps/nextjs-app/lib/db/study";
import { getPluginSessionData } from "@/apps/nextjs-app/lib/auth/plugin-session";
import {
  PERSONAL_EVALUATION_COST_CENTS,
  COMPANY_EVALUATION_COST_CENTS,
} from "@/apps/shared/constants";
import { getBenchmarkContext } from "@/apps/nextjs-app/lib/actions/benchmark-actions";
import { getHeuristicEvaluation } from "@/apps/nextjs-app/lib/db/data";
import {
  imageTypeToMime,
  fileTypeToMime,
} from "@/apps/nextjs-app/lib/utils/study-helpers";

// Component imports
import { HeuristicEvaluationForm } from "@/apps/nextjs-app/app/[locale]/(auth)/evaluation/new/heuristic-evaluation-form";
import { StudyFormErrorBoundary } from "@/apps/nextjs-app/components/study/study-form-error-boundary";

// UI component imports
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/apps/nextjs-app/components/ui/breadcrumb";

import { getTranslations } from "next-intl/server";

interface PageProps {
  params: Promise<{
    locale: string;
  }>;
  searchParams: Promise<{
    pluginSession?: string;
    benchmarkSourceId?: string;
    mode?: string;
  }>;
}

export default async function Page({ params, searchParams }: PageProps) {
  const [{ locale }, paramsResolved] = await Promise.all([
    params,
    searchParams,
  ]);
  const tb = await getTranslations("StudyBreadcrumbs");
  const getLocalizedHref = (href: string) => locale === "en" ? href : `/${locale}${href === "/" ? "" : href}`;

  // Get user data (authentication and user existence already verified)
  const { user } = await getCurrentUser();

  // Parallelize independent data fetches to reduce load time
  const [
    team,
    canPurchaseCredits,
    pluginSessionData,
    benchmarkCtx,
    benchmarkSourceHE,
  ] = await Promise.all([
    user.selectedTeamId ? getTeam(user.selectedTeamId) : Promise.resolve(null),
    user.selectedTeamId
      ? canManageTeamFunds(user.id, user.selectedTeamId)
      : Promise.resolve(false),
    paramsResolved.pluginSession
      ? getPluginSessionData(paramsResolved.pluginSession, user.id)
      : Promise.resolve(null),
    paramsResolved.benchmarkSourceId
      ? getBenchmarkContext(paramsResolved.benchmarkSourceId).catch(() => null)
      : Promise.resolve(null),
    paramsResolved.benchmarkSourceId
      ? getHeuristicEvaluation(paramsResolved.benchmarkSourceId, user.id).catch(
          () => null,
        )
      : Promise.resolve(null),
  ]);

  const maxFiles = getStudyUploadLimitForTeam(team);
  const studyCostCents = team?.companyId
    ? COMPANY_EVALUATION_COST_CENTS
    : PERSONAL_EVALUATION_COST_CENTS;

  // Log plugin session info if present
  if (pluginSessionData) {
    logger.info("Loading evaluation form with plugin session", {
      userId: user.id,
      sessionId: paramsResolved.pluginSession,
      frameCount: pluginSessionData.frames.length,
    });
  }

  logger.info("New evaluation page rendered successfully", {
    userId: user.id,
  });

  return (
    <div>
      <Breadcrumb className="mb-6">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href={getLocalizedHref("/new")}>{tb("new")}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{tb("evaluation")}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <StudyFormErrorBoundary>
        <HeuristicEvaluationForm
          balanceCents={team?.balanceCents ?? 0}
          studyCostCents={studyCostCents}
          maxFiles={maxFiles}
          canPurchaseCredits={canPurchaseCredits}
          teamName={team?.name}
          pluginSession={pluginSessionData}
          benchmarkSourceStudy={
            paramsResolved.benchmarkSourceId && benchmarkCtx
              ? {
                  id: paramsResolved.benchmarkSourceId,
                  mode: paramsResolved.mode === "persona" ? "persona" : "flow",
                  goal: benchmarkSourceHE?.heuristicEvaluation?.goal ?? null,
                  user: benchmarkSourceHE?.heuristicEvaluation?.user ?? null,
                  context:
                    benchmarkSourceHE?.heuristicEvaluation?.context ?? null,
                  heuristicId:
                    benchmarkSourceHE?.heuristicEvaluation?.heuristicFamilyId ??
                    null,
                  personaStudyId:
                    benchmarkSourceHE?.heuristicEvaluation?.persona?.studyId ??
                    null,
                  personaName:
                    benchmarkSourceHE?.heuristicEvaluation?.persona?.name ??
                    null,
                  sourceFiles: (benchmarkSourceHE?.files ?? []).map(
                    (f: any) => ({
                      name: f.originalName ?? f.name ?? "",
                      key: f.key ?? "",
                      size: f.size ?? 0,
                      type:
                        imageTypeToMime(f.imageType) ??
                        fileTypeToMime(f.fileType) ??
                        "image/png",
                    }),
                  ),
                  benchmarkContext: benchmarkCtx,
                }
              : null
          }
        />
      </StudyFormErrorBoundary>
    </div>
  );
}
