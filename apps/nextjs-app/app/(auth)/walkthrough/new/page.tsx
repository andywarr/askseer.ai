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
} from "@/apps/shared/constants";

// Component imports
import { CognitiveWalkthroughForm } from "@/apps/nextjs-app/app/(auth)/walkthrough/new/cognitive-walkthrough-form";
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
    user.selectedTeamId
      ? canManageTeamFunds(user.id, user.selectedTeamId)
      : Promise.resolve(false),
    params.pluginSession
      ? getPluginSessionData(params.pluginSession, user.id)
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
      sessionId: params.pluginSession,
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
              <Link href="/new">New</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Walkthrough</BreadcrumbPage>
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
        />
      </StudyFormErrorBoundary>
    </div>
  );
}
