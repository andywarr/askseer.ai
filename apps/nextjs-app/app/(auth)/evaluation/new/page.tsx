// Next imports
import Link from "next/link";

// Lib functions imports
import {
  getCurrentUser,
  canUserPurchaseCredits,
} from "@/apps/nextjs-app/lib/db/user";
import { logger } from "@/apps/shared/logger";
import { getTeam } from "@/apps/nextjs-app/lib/db/data";
import { getStudyUploadLimitForTeam } from "@/apps/nextjs-app/lib/db/study";
import { getPluginSessionData } from "@/apps/nextjs-app/lib/auth/plugin-session";
import {
  PERSONAL_EVALUATION_COST_CENTS,
  COMPANY_EVALUATION_COST_CENTS,
} from "@/apps/shared/constants";

// Component imports
import { NoFundsAlert } from "@/apps/nextjs-app/components/funds/no-funds-alert";
import { HeuristicEvaluationForm } from "@/apps/nextjs-app/app/(auth)/evaluation/new/heuristic-evaluation-form";
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

interface PageProps {
  searchParams: Promise<{ pluginSession?: string }>;
}

export default async function Page({ searchParams }: PageProps) {
  const params = await searchParams;

  // Get user data (authentication and user existence already verified)
  const { user } = await getCurrentUser();

  // Parallelize independent data fetches to reduce load time
  const [team, canPurchaseCredits, pluginSessionData] = await Promise.all([
    user.selectedTeamId ? getTeam(user.selectedTeamId) : Promise.resolve(null),
    canUserPurchaseCredits(user.id),
    params.pluginSession
      ? getPluginSessionData(params.pluginSession, user.id)
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
      sessionId: params.pluginSession,
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
              <Link href="/new">New</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Evaluation</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <NoFundsAlert
        balanceCents={team?.balanceCents ?? 0}
        studyCostCents={studyCostCents}
        canPurchaseCredits={canPurchaseCredits}
        teamName={team?.name}
      />
      <StudyFormErrorBoundary>
        <HeuristicEvaluationForm
          balanceCents={team?.balanceCents ?? 0}
          studyCostCents={studyCostCents}
          maxFiles={maxFiles}
          canPurchaseCredits={canPurchaseCredits}
          pluginSession={pluginSessionData}
        />
      </StudyFormErrorBoundary>
    </div>
  );
}
