// Next imports
import Link from "next/link";
import { redirect } from "next/navigation";

// Lib functions imports
import {
  getCurrentUser,
  canUserPurchaseCredits,
} from "@/apps/nextjs-app/lib/user";
import { logger } from "@/apps/shared/logger";
import { getTeam, getUserTeams } from "@/apps/nextjs-app/lib/data";
import { getStudyUploadLimitForTeam } from "@/apps/nextjs-app/lib/study";

// Component imports
import { CognitiveWalkthroughForm } from "@/apps/nextjs-app/app/(auth)/walkthrough/new/cognitive-walkthrough-form";
import { FormTeamSwitcher } from "@/apps/nextjs-app/components/study/form-team-switcher";

// UI component imports
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/apps/nextjs-app/components/ui/breadcrumb";

export default async function Page() {
  // Get user data (authentication and user existence already verified)
  const { user } = await getCurrentUser();

  // Fetch selected team and user teams in parallel
  const [team, userTeams] = await Promise.all([
    user.selectedTeamId ? getTeam(user.selectedTeamId) : null,
    getUserTeams(user.id),
  ]);
  const maxFiles = getStudyUploadLimitForTeam(team);

  // Check if user can purchase credits
  const canPurchaseCredits = await canUserPurchaseCredits(user.id);

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
      <FormTeamSwitcher
        currentTeamId={user.selectedTeamId}
        userTeams={userTeams}
        credits={team?.credits ?? 0}
        canPurchaseCredits={canPurchaseCredits}
      />
      <CognitiveWalkthroughForm
        credits={team?.credits ?? 0}
        maxFiles={maxFiles}
        canPurchaseCredits={canPurchaseCredits}
      />
    </div>
  );
}
