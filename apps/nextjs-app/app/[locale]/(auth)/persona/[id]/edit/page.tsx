// Next imports
import Link from "next/link";
import { redirect } from "next/navigation";

// Lib functions imports
import { getCurrentUser } from "@/apps/nextjs-app/lib/db/user";
import {
  getPersona,
  getTeam,
  isUserTeamAdmin,
} from "@/apps/nextjs-app/lib/db/data";
import { logger } from "@/apps/shared/logger";
import {
  PERSONAL_PERSONA_COST_CENTS,
  COMPANY_PERSONA_COST_CENTS,
} from "@/apps/shared/constants";

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

// Type imports
import type { Persona } from "@/apps/shared/jobSchema";

import { getTranslations } from "next-intl/server";

interface PageProps {
  params: Promise<{
    id: string;
    locale: string;
  }>;
}

export default async function Page({ params }: PageProps) {
  const { id, locale } = await params;
  const tb = await getTranslations("StudyBreadcrumbs");
  const getLocalizedHref = (href: string) => locale === "en" ? href : `/${locale}${href === "/" ? "" : href}`;

  // Get user data (authentication and user existence already verified)
  const { user } = await getCurrentUser();

  // Parallelize data fetches that don't depend on each other
  const [study, team] = await Promise.all([
    getPersona(id, user.id),
    user.selectedTeamId ? getTeam(user.selectedTeamId) : Promise.resolve(null),
  ]);

  if (!study || !study.persona) {
    logger.warn("Persona not found for edit", {
      userId: user.id,
      studyId: id,
    });
    redirect(getLocalizedHref("/error"));
  }

  // Check if user can manage the study (depends on study.teamId, so runs after)
  const isOwner = user.id === study.createdByUserId;
  const isTeamAdmin = study.teamId
    ? await isUserTeamAdmin(user.id, study.teamId)
    : false;
  if (!isOwner && !isTeamAdmin) {
    logger.warn("User attempted to edit persona they don't own", {
      userId: user.id,
      studyId: id,
    });
    redirect(getLocalizedHref("/error"));
  }

  const persona: Persona | undefined =
    (study?.persona.data.data as Persona | undefined) || undefined;

  if (!persona) {
    logger.error("Persona data not found", {
      userId: user.id,
      studyId: id,
    });
    redirect(getLocalizedHref("/error"));
  }

  logger.info("Persona edit page rendered successfully", {
    userId: user.id,
    studyId: id,
  });

  const personaName = persona?.name || tb("untitled");
  const studyCostCents = team?.companyId
    ? COMPANY_PERSONA_COST_CENTS
    : PERSONAL_PERSONA_COST_CENTS;

  return (
    <>
      <Breadcrumb className="mb-6">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href={getLocalizedHref("/studies")}>{tb("studies")}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href={getLocalizedHref(`/persona/${id}`)}>{personaName}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{tb("edit")}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <PersonaForm
        balanceCents={team?.balanceCents ?? 0}
        studyCostCents={studyCostCents}
        initialData={persona}
        studyId={study.id}
        mode="edit"
      />
    </>
  );
}
