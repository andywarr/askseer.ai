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

// Component imports
import { PersonaForm } from "@/apps/nextjs-app/app/(auth)/persona/persona-form";

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

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;

  // Get user data (authentication and user existence already verified)
  const { user } = await getCurrentUser();

  // Fetch the persona study
  const study = await getPersona(id, user.id);

  if (!study || !study.persona) {
    logger.warn("Persona not found for edit", {
      userId: user.id,
      studyId: id,
    });
    redirect("/error");
  }

  // Check if user can manage the study
  const isOwner = user.id === study.createdByUserId;
  const isTeamAdmin = study.teamId
    ? await isUserTeamAdmin(user.id, study.teamId)
    : false;
  if (!isOwner && !isTeamAdmin) {
    logger.warn("User attempted to edit persona they don't own", {
      userId: user.id,
      studyId: id,
    });
    redirect("/error");
  }

  const persona: Persona | undefined =
    (study?.persona.data.data as Persona | undefined) || undefined;

  if (!persona) {
    logger.error("Persona data not found", {
      userId: user.id,
      studyId: id,
    });
    redirect("/error");
  }

  // Fetch selected team to determine current credits
  const team = user.selectedTeamId ? await getTeam(user.selectedTeamId) : null;

  logger.info("Persona edit page rendered successfully", {
    userId: user.id,
    studyId: id,
  });

  const personaName = persona?.name || "Untitled";

  return (
    <>
      <Breadcrumb className="mb-6">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/studies">Studies</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href={`/persona/${id}`}>{personaName}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Edit</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <PersonaForm
        credits={team?.credits ?? 0}
        initialData={persona}
        studyId={study.id}
        mode="edit"
      />
    </>
  );
}
