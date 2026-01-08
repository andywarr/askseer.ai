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

// Update Persona (server action)
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
    const response = await fetch(
      `${process.env.DB_WORKER_URL}/api/persona/update`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          studyId,
          userId: user.id,
          data: parsed.data,
        }),
      },
    );

    if (!response.ok) {
      logger.error("Failed to update persona", {
        userId: user.id,
        studyId,
        status: response.status,
      });
      return actionError("Failed to update persona");
    }

    const result = (await response.json()) as { data?: UpdatePersonaResult };
    logger.info("Persona updated successfully (new version created)", {
      userId: user.id,
      oldStudyId: studyId,
      newStudyId: result.data?.study?.id,
      version: result.data?.persona?.version,
    });

    // Revalidate paths
    revalidatePath(`/persona/${studyId}`);
    if (result.data?.study?.id) {
      revalidatePath(`/persona/${result.data.study.id}`);
    }
    revalidatePath("/studies");

    return actionSuccess({
      ...result.data,
      newStudyId: result.data?.study?.id,
    });
  } catch (error) {
    logger.error("Error updating persona", {
      userId: user.id,
      studyId,
      error: (error as Error).message,
    });
    return actionError("Internal server error");
  }
}
