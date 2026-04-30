// Next imports
import Link from "next/link";

// Lib functions imports
import {
  getCurrentUser,
  canManageTeamFunds,
} from "@/apps/nextjs-app/lib/db/user";
import { logger } from "@/apps/shared/logger";
import { getTeam } from "@/apps/nextjs-app/lib/db/data";
import { getAnalysisUploadPolicyForTeam } from "@/apps/nextjs-app/lib/db/study";
import {
  PERSONAL_INTERVIEW_COST_CENTS,
  COMPANY_INTERVIEW_COST_CENTS,
} from "@/apps/shared/constants";

// Component imports
import { InterviewForm } from "@/apps/nextjs-app/app/(auth)/interview/new/interview-form";
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

export default async function Page() {
  const { user } = await getCurrentUser();

  const [team, canPurchaseCredits] = await Promise.all([
    user.selectedTeamId ? getTeam(user.selectedTeamId) : Promise.resolve(null),
    user.selectedTeamId
      ? canManageTeamFunds(user.id, user.selectedTeamId)
      : Promise.resolve(false),
  ]);

  const uploadPolicy = getAnalysisUploadPolicyForTeam(team);
  const studyCostCents = team?.companyId
    ? COMPANY_INTERVIEW_COST_CENTS
    : PERSONAL_INTERVIEW_COST_CENTS;

  logger.info("New interview page rendered successfully", {
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
            <BreadcrumbPage>Interview</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <StudyFormErrorBoundary>
        <InterviewForm
          balanceCents={team?.balanceCents ?? 0}
          studyCostCents={studyCostCents}
          uploadPolicy={uploadPolicy}
          canPurchaseCredits={canPurchaseCredits}
          teamName={team?.name}
        />
      </StudyFormErrorBoundary>
    </div>
  );
}
