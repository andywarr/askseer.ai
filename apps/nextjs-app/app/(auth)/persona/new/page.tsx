// Next imports
import Link from "next/link";
import { redirect } from "next/navigation";

// Lib functions imports
import {
  getCurrentUser,
  canUserCreatePersonas,
  canUserPurchaseCredits,
} from "@/apps/nextjs-app/lib/user";
import { getTeam, getUserTeams } from "@/apps/nextjs-app/lib/data";
import { logger } from "@/apps/shared/logger";

// Component imports
import { PersonaForm } from "@/apps/nextjs-app/app/(auth)/persona/persona-form";
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

  // Check if user has permission to create personas
  const hasPermission = await canUserCreatePersonas(user.id);

  if (!hasPermission) {
    logger.warn(
      "User attempted to access persona creation without permission",
      {
        userId: user.id,
      },
    );
    redirect("/new");
  }

  // Fetch selected team and user teams in parallel
  const [team, userTeams] = await Promise.all([
    user.selectedTeamId ? getTeam(user.selectedTeamId) : null,
    getUserTeams(user.id),
  ]);

  // Check if user can purchase credits
  const canPurchaseCredits = await canUserPurchaseCredits(user.id);

  logger.info("New persona page rendered successfully", {
    userId: user.id,
  });

  return (
    <>
      <Breadcrumb className="mb-6">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/new">New</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Persona</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <FormTeamSwitcher
        currentTeamId={user.selectedTeamId}
        userTeams={userTeams}
        credits={team?.credits ?? 0}
        canPurchaseCredits={canPurchaseCredits}
      />
      <PersonaForm
        credits={team?.credits ?? 0}
        canPurchaseCredits={canPurchaseCredits}
      />
    </>
  );
}
