"use server";

import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { revalidatePath } from "next/cache";

import { logger } from "@/apps/shared/logger";
import { PersonaSchema } from "@/apps/shared/jobSchema";
import {
  listPersonas,
  getTeam,
  getCompanyTeams,
  updatePersonaData,
} from "@/apps/nextjs-app/lib/data";
import { canUserCreatePersonas } from "@/apps/nextjs-app/lib/user";
import {
  requireAuth,
  actionSuccess,
  actionError,
  validationError,
  VISIBILITY_PRIVATE,
  VISIBILITY_TEAM,
  VISIBILITY_COMPANY,
  type ActionResult,
  type ValidationResult,
} from "@/apps/nextjs-app/lib/actions/shared";

// ==========================================
// Types
// ==========================================

interface PersonaData {
  id: string;
  visibility: string;
  createdByUserId: string;
  [key: string]: unknown;
}

interface TeamData {
  id: string;
  companyId: string | null;
  isDefaultForCompany: boolean;
}

interface CompanyTeamData {
  id: string;
  isDefaultForCompany: boolean;
}

interface ListPersonasResult {
  privatePersonas: PersonaData[];
  teamPersonas: PersonaData[];
  companyPersonas: PersonaData[];
  isDefaultTeam: boolean;
}

interface CreatedPersona {
  id: string;
  userId: string;
  name: string;
  oneLiner: string;
  photoUrl: string | null;
  data: z.infer<typeof PersonaSchema>;
  createdAt: string;
}

interface UpdatePersonaResult {
  newStudyId?: string;
  study?: {
    id: string;
  };
  persona?: {
    version: number;
  };
  [key: string]: unknown;
}

interface AuthenticatedUserWithTeam {
  id: string;
  email?: string | null;
  selectedTeamId?: string | null;
}

// ==========================================
// Helper Functions
// ==========================================

/**
 * Filters personas by visibility level
 */
function filterPersonasByVisibility(
  personas: PersonaData[] | null,
  visibility: string,
): PersonaData[] {
  return (personas || []).filter((p) => p.visibility === visibility);
}

/**
 * Filters private personas that belong to a specific user
 */
function filterPrivatePersonas(
  personas: PersonaData[] | null,
  userId: string,
): PersonaData[] {
  return (personas || []).filter(
    (p) => p.visibility === VISIBILITY_PRIVATE && p.createdByUserId === userId,
  );
}

/**
 * Generates persona name and one-liner from persona data
 *
 * @param data - Validated persona data from PersonaSchema
 * @returns Object containing generated name and one-liner
 */
function generatePersonaMetadata(data: z.infer<typeof PersonaSchema>): {
  name: string;
  oneLiner: string;
} {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);

  const role = data.firmographics?.roleSeniority?.trim();
  const dept = data.firmographics?.department?.trim();
  const industry = data.firmographics?.industry?.trim();
  const location = data.demographics?.location?.trim();
  const goal = typeof data.goals === "string" ? data.goals.trim() : undefined;

  const baseLabel = role || dept || industry || "Persona";
  const name = `${baseLabel} – ${date}`;

  const oneLiner = goal
    ? goal
    : `A representative ${industry ? `${industry.toLowerCase()} ` : ""}persona${location ? ` in ${location}` : ""}.`;

  return { name, oneLiner };
}

/**
 * Revalidates persona-related paths after an update operation
 *
 * @param oldStudyId - The original study ID
 * @param newStudyId - The new study ID (if a new version was created)
 */
function revalidatePersonaPaths(
  oldStudyId: string,
  newStudyId?: string,
): void {
  // Revalidate the old persona page
  revalidatePath(`/persona/${oldStudyId}`);

  // Revalidate the new persona page if a new version was created
  if (newStudyId && newStudyId !== oldStudyId) {
    revalidatePath(`/persona/${newStudyId}`);
  }

  // Revalidate the studies list page
  revalidatePath("/studies");
}

/**
 * Fetches company personas based on team context
 * Returns company personas and whether the current team is the default team
 */
async function fetchCompanyPersonas(
  userId: string,
  teamId: string,
  teamPersonasRaw: PersonaData[] | null,
): Promise<{ companyPersonas: PersonaData[]; isDefaultTeam: boolean }> {
  try {
    const team = (await getTeam(teamId)) as TeamData | null;
    const isDefaultTeam = team?.isDefaultForCompany || false;
    const companyId = team?.companyId;

    // No company association
    if (!companyId) {
      return { companyPersonas: [], isDefaultTeam: false };
    }

    // User is on the default team - company personas are in the current team's data
    if (isDefaultTeam) {
      return {
        companyPersonas: filterPersonasByVisibility(
          teamPersonasRaw,
          VISIBILITY_COMPANY,
        ),
        isDefaultTeam: true,
      };
    }

    // User is on a non-default team - fetch from the default team
    const companyTeams = (await getCompanyTeams(
      companyId,
    )) as CompanyTeamData[];
    const defaultTeamId = companyTeams.find((t) => t.isDefaultForCompany)?.id;

    if (!defaultTeamId) {
      return { companyPersonas: [], isDefaultTeam: false };
    }

    const companyPersonasRaw = (await listPersonas(userId, defaultTeamId)) as
      | PersonaData[]
      | null;

    return {
      companyPersonas: filterPersonasByVisibility(
        companyPersonasRaw,
        VISIBILITY_COMPANY,
      ),
      isDefaultTeam: false,
    };
  } catch (error) {
    logger.error("Failed to load company personas", {
      userId,
      teamId,
      error,
    });
    return { companyPersonas: [], isDefaultTeam: false };
  }
}

// ==========================================
// List Personas
// ==========================================

export async function listMyPersonas(): Promise<ListPersonasResult> {
  const user = (await requireAuth()) as AuthenticatedUserWithTeam;
  const teamId = user.selectedTeamId;

  if (!teamId) {
    logger.warn("listMyPersonas called without a selected team", {
      userId: user.id,
    });
    return {
      privatePersonas: [],
      teamPersonas: [],
      companyPersonas: [],
      isDefaultTeam: false,
    };
  }

  // Fetch all personas for the team
  const teamPersonasRaw = (await listPersonas(user.id, teamId)) as
    | PersonaData[]
    | null;

  // Split personas by visibility
  const privatePersonas = filterPrivatePersonas(teamPersonasRaw, user.id);
  const teamPersonas = filterPersonasByVisibility(
    teamPersonasRaw,
    VISIBILITY_TEAM,
  );

  // Fetch company personas if user is part of a company
  const { companyPersonas, isDefaultTeam } = await fetchCompanyPersonas(
    user.id,
    teamId,
    teamPersonasRaw,
  );

  return { privatePersonas, teamPersonas, companyPersonas, isDefaultTeam };
}

// ==========================================
// Create Persona
// ==========================================

/**
 * Creates a persona with generated metadata.
 *
 * @remarks
 * This function generates persona basics (name, one-liner) but does not persist to the database.
 * Persistence should be implemented when the backend persona endpoint is ready.
 *
 * @param payload - The persona data conforming to PersonaSchema
 * @returns Action result with generated persona or validation error
 */
export async function createPersona(
  payload: z.infer<typeof PersonaSchema>,
): Promise<
  ActionResult<{ persona: CreatedPersona }> | ValidationResult<never>
> {
  const user = await requireAuth();
  logger.debug("Creating persona", { userId: user.id });

  // Check if user has permission to create personas
  const hasPermission = await canUserCreatePersonas(user.id);

  if (!hasPermission) {
    logger.warn("User attempted to create persona without permission", {
      userId: user.id,
    });
    return actionError("You do not have permission to create personas");
  }

  // Validate payload using schema
  const parsed = PersonaSchema.safeParse(payload);
  if (!parsed.success) {
    logger.warn("Persona validation failed", {
      userId: user.id,
      errors: parsed.error.errors,
    });
    return validationError("Invalid persona data", parsed.error.errors);
  }

  const data = parsed.data;

  // Generate persona metadata (name and one-liner)
  const { name, oneLiner } = generatePersonaMetadata(data);
  const photoUrl: string | null = null; // Placeholder until image generation is wired

  const persona: CreatedPersona = {
    id: uuidv4(),
    userId: user.id,
    name,
    oneLiner,
    photoUrl,
    data,
    createdAt: new Date().toISOString(),
  };

  logger.info("Persona created (not yet persisted)", {
    userId: user.id,
    personaId: persona.id,
  });

  // TODO: Persist to db-worker via API call when backend endpoint is ready
  // TODO: Add redirect to persona detail page after persistence
  return actionSuccess({ persona });
}

// ==========================================
// Update Persona
// ==========================================

/**
 * Updates an existing persona by creating a new version.
 *
 * @remarks
 * This function validates the payload and sends it to the db-worker API to create
 * a new version of the persona. The original study remains unchanged, and a new
 * study record is created with the updated persona data. After successful update,
 * relevant paths are revalidated to reflect the changes.
 *
 * @param studyId - The ID of the study/persona to update
 * @param payload - The updated persona data conforming to PersonaSchema
 * @returns Action result with update details including new study ID, or validation error
 *
 * @example
 * ```ts
 * const result = await updatePersona('study-123', updatedPersonaData);
 * if (result.success) {
 *   console.log('New version created:', result.data.newStudyId);
 * }
 * ```
 */
export async function updatePersona(
  studyId: string,
  payload: z.infer<typeof PersonaSchema>,
): Promise<ActionResult<UpdatePersonaResult> | ValidationResult<never>> {
  const user = await requireAuth();

  logger.debug("Updating persona", { userId: user.id, studyId });

  // Validate payload using schema
  const parsed = PersonaSchema.safeParse(payload);
  if (!parsed.success) {
    logger.warn("Persona validation failed during update", {
      userId: user.id,
      studyId,
      errors: parsed.error.errors,
    });
    return validationError("Invalid persona data", parsed.error.errors);
  }

  try {
    const result = await updatePersonaData(studyId, user.id, parsed.data);

    // Revalidate all persona-related paths
    revalidatePersonaPaths(studyId, result?.study?.id);

    return actionSuccess({
      ...result,
      newStudyId: result?.study?.id,
    });
  } catch (error) {
    logger.error("Error updating persona", {
      userId: user.id,
      studyId,
      error: (error as Error).message,
    });
    return actionError("Failed to update persona");
  }
}
