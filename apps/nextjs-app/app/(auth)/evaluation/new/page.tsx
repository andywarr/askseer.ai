// Next imports
import Link from "next/link";

// Lib functions imports
import {
  getCurrentUser,
  canUserPurchaseCredits,
} from "@/apps/nextjs-app/lib/user";
import { logger } from "@/apps/shared/logger";
import { getTeam } from "@/apps/nextjs-app/lib/data";
import { getStudyUploadLimitForTeam } from "@/apps/nextjs-app/lib/study";

// Component imports
import { HeuristicEvaluationForm } from "@/apps/nextjs-app/components/heuristic-evaluation-form";

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

  // Fetch selected team to determine current credits
  const team = user.selectedTeamId ? await getTeam(user.selectedTeamId) : null;
  const maxFiles = getStudyUploadLimitForTeam(team);

  // Check if user can purchase credits
  const canPurchaseCredits = await canUserPurchaseCredits(user.id);

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
      <HeuristicEvaluationForm
        credits={team?.credits ?? 0}
        maxFiles={maxFiles}
        canPurchaseCredits={canPurchaseCredits}
      />
    </div>
  );
}
