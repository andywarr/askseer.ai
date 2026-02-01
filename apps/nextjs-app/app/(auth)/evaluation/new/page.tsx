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

// Component imports
import { NoCreditsAlert } from "@/apps/nextjs-app/components/credits/no-credits-alert";
import { HeuristicEvaluationForm } from "@/apps/nextjs-app/app/(auth)/evaluation/new/heuristic-evaluation-form";

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
      <NoCreditsAlert
        credits={team?.credits ?? 0}
        canPurchaseCredits={canPurchaseCredits}
      />
      <HeuristicEvaluationForm
        credits={team?.credits ?? 0}
        maxFiles={maxFiles}
        canPurchaseCredits={canPurchaseCredits}
        pluginSession={pluginSessionData}
      />
    </div>
  );
}
