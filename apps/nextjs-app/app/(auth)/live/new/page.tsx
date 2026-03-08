// Next imports
import Link from "next/link";
import { redirect } from "next/navigation";

// Lib functions imports
import {
  getCurrentUser,
  canManageTeamFunds,
} from "@/apps/nextjs-app/lib/db/user";
import { logger } from "@/apps/shared/logger";
import { getTeam } from "@/apps/nextjs-app/lib/db/data";
import { getAnalysisUploadPolicyForTeam } from "@/apps/nextjs-app/lib/db/study";
import {
  PERSONAL_LIVE_SESSION_COST_CENTS,
  COMPANY_LIVE_SESSION_COST_CENTS,
} from "@/apps/shared/constants";

// Component imports
import { NoFundsAlert } from "@/apps/nextjs-app/components/funds/no-funds-alert";
import { LiveSessionForm } from "@/apps/nextjs-app/app/(auth)/live/new/live-session-form";
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

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ preview?: string }>;
}) {
  const { preview } = await searchParams;
  if (preview !== "live") {
    redirect("/new");
  }
  // Get user data (authentication and user existence already verified)
  const { user } = await getCurrentUser();

  // Parallelize independent data fetches to reduce load time
  const [team, canPurchaseCredits] = await Promise.all([
    user.selectedTeamId ? getTeam(user.selectedTeamId) : Promise.resolve(null),
    user.selectedTeamId
      ? canManageTeamFunds(user.id, user.selectedTeamId)
      : Promise.resolve(false),
  ]);

  const uploadPolicy = getAnalysisUploadPolicyForTeam(team);
  const studyCostCents = team?.companyId
    ? COMPANY_LIVE_SESSION_COST_CENTS
    : PERSONAL_LIVE_SESSION_COST_CENTS;

  logger.info("New live session page rendered successfully", {
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
            <BreadcrumbPage>Live</BreadcrumbPage>
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
        <LiveSessionForm
          balanceCents={team?.balanceCents ?? 0}
          studyCostCents={studyCostCents}
          uploadPolicy={uploadPolicy}
          canPurchaseCredits={canPurchaseCredits}
        />
      </StudyFormErrorBoundary>
    </div>
  );
}
