// Next imports
import Link from "next/link";
import { redirect } from "next/navigation";

// Lib functions imports
import { getCurrentUser } from "@/apps/nextjs-app/lib/user";
import { logger } from "@/apps/shared/logger";
import { getTeam } from "@/apps/nextjs-app/lib/data";
import { getStudyFileLimitForTeam } from "@/apps/nextjs-app/lib/study";

// Component imports
import { CognitiveWalkthroughForm } from "@/apps/nextjs-app/components/cognitive-walkthrough-form";

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
  const maxFiles = getStudyFileLimitForTeam(team?.isPersonal);

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
      <CognitiveWalkthroughForm
        credits={team?.credits ?? 0}
        maxFiles={maxFiles}
      />
    </div>
  );
}
