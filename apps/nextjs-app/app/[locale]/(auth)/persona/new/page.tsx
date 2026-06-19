// Next imports
import Link from "next/link";
import { redirect } from "next/navigation";

// Lib functions imports
import {
  getCurrentUser,
  canUserCreatePersonas,
  canManageTeamFunds,
} from "@/apps/nextjs-app/lib/db/user";
import { getTeam } from "@/apps/nextjs-app/lib/db/data";
import { logger } from "@/apps/shared/logger";
import {
  PERSONAL_PERSONA_COST_CENTS,
  COMPANY_PERSONA_COST_CENTS,
} from "@/apps/shared/pricing";

// Component imports
import { PersonaForm } from "@/apps/nextjs-app/app/[locale]/(auth)/persona/persona-form";

// UI component imports
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/apps/nextjs-app/components/ui/breadcrumb";

import { getTranslations } from "next-intl/server";

interface PageProps {
  params: Promise<{
    locale: string;
  }>;
}

export default async function Page({ params }: PageProps) {
  const { locale } = await params;
  const tb = await getTranslations("StudyBreadcrumbs");
  const getLocalizedHref = (href: string) => locale === "en" ? href : `/${locale}${href === "/" ? "" : href}`;

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
    redirect(getLocalizedHref("/new"));
  }

  // Fetch selected team to determine current credits
  const team = user.selectedTeamId ? await getTeam(user.selectedTeamId) : null;
  const studyCostCents = team?.companyId
    ? COMPANY_PERSONA_COST_CENTS
    : PERSONAL_PERSONA_COST_CENTS;

  // Check if user can purchase credits
  const canPurchaseCredits = user.selectedTeamId
    ? await canManageTeamFunds(user.id, user.selectedTeamId)
    : false;

  logger.info("New persona page rendered successfully", {
    userId: user.id,
  });

  return (
    <>
      <Breadcrumb className="mb-6">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href={getLocalizedHref("/new")}>{tb("new")}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{tb("persona")}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <PersonaForm
        balanceCents={team?.balanceCents ?? 0}
        studyCostCents={studyCostCents}
        canPurchaseCredits={canPurchaseCredits}
        teamName={team?.name}
      />
    </>
  );
}
