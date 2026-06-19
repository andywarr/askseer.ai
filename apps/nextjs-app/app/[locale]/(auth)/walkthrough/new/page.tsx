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
  PERSONAL_WALKTHROUGH_COST_CENTS,
  COMPANY_WALKTHROUGH_COST_CENTS,
} from "@/apps/shared/pricing";
import { getBenchmarkContext } from "@/apps/nextjs-app/lib/actions/benchmark-actions";
import { getCognitiveWalkthrough } from "@/apps/nextjs-app/lib/db/data";
import {
  imageTypeToMime,
  fileTypeToMime,
} from "@/apps/nextjs-app/lib/utils/study-helpers";

// Component imports
import { CognitiveWalkthroughForm } from "@/apps/nextjs-app/app/[locale]/(auth)/walkthrough/new/cognitive-walkthrough-form";
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
    benchmarkSourceCW,
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
      ? getCognitiveWalkthrough(paramsResolved.benchmarkSourceId, user.id).catch(
          () => null,
        )
      : Promise.resolve(null),
  ]);

  const maxFiles = getStudyUploadLimitForTeam(team);
  const studyCostCents = team?.companyId
    ? COMPANY_WALKTHROUGH_COST_CENTS
    : PERSONAL_WALKTHROUGH_COST_CENTS;

  // Log plugin session info if present
  if (pluginSessionData) {
    logger.info("Loading walkthrough form with plugin session", {
      userId: user.id,
      sessionId: paramsResolved.pluginSession,
      frameCount: pluginSessionData.frames.length,
    });
  }

  logger.info("New walkthrough page rendered successfully", {
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
            <BreadcrumbPage>{tb("walkthrough")}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <StudyFormErrorBoundary>
        <CognitiveWalkthroughForm
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
                  goal: benchmarkSourceCW?.cognitiveWalkthrough?.goal ?? null,
                  user: benchmarkSourceCW?.cognitiveWalkthrough?.user ?? null,
                  context:
                    benchmarkSourceCW?.cognitiveWalkthrough?.context ?? null,
                  personaStudyId:
                    benchmarkSourceCW?.cognitiveWalkthrough?.persona?.studyId ??
                    null,
                  personaName:
                    benchmarkSourceCW?.cognitiveWalkthrough?.persona?.name ??
                    null,
                  sourceFiles: (benchmarkSourceCW?.files ?? []).map(
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
