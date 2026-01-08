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
import { CognitiveWalkthroughForm } from "@/apps/nextjs-app/app/(auth)/walkthrough/new/cognitive-walkthrough-form";
import { NoCreditsAlert } from "@/apps/nextjs-app/components/credits/no-credits-alert";

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

  // Fetch selected team to determine current credits
  const team = user.selectedTeamId ? await getTeam(user.selectedTeamId) : null;
  const maxFiles = getStudyUploadLimitForTeam(team);

  // Check if user can purchase credits
  const canPurchaseCredits = await canUserPurchaseCredits(user.id);

  // Check for plugin session with pre-loaded frames
  let pluginSessionData = null;
  if (params.pluginSession) {
    pluginSessionData = await getPluginSessionData(params.pluginSession, user.id);
    if (pluginSessionData) {
      logger.info("Loading walkthrough form with plugin session", {
        userId: user.id,
        sessionId: params.pluginSession,
        frameCount: pluginSessionData.frames.length,
      });
    }
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
      <NoCreditsAlert
        credits={team?.credits ?? 0}
        canPurchaseCredits={canPurchaseCredits}
      />
      <CognitiveWalkthroughForm
        credits={team?.credits ?? 0}
        maxFiles={maxFiles}
        canPurchaseCredits={canPurchaseCredits}
        pluginSession={pluginSessionData}
      />
    </div>
  );
}
