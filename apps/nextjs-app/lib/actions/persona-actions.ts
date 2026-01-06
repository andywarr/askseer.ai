// @ts-nocheck
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
} from "@/apps/nextjs-app/lib/actions/shared";

// ==========================================
// List Personas
// ==========================================

export async function listMyPersonas() {
  const user = await requireAuth();
  const teamId = user.selectedTeamId;
  if (!teamId) {
    logger.warn("listMyPersonas called without a selected team", {
      userId: user.id,
    });
    return { teamPersonas: [], companyPersonas: [], isDefaultTeam: false };
  }
  // Fetch all personas for the team
  const teamPersonasRaw = await listPersonas(user.id, teamId);

  // Split personas by visibility
  const privatePersonas = (teamPersonasRaw || []).filter(
    (p: any) =>
      p.visibility === VISIBILITY_PRIVATE && p.createdByUserId === user.id,
  );
  const teamPersonas = (teamPersonasRaw || []).filter(
    (p: any) => p.visibility === VISIBILITY_TEAM,
  );

  let companyPersonas: any[] = [];
  let isDefaultTeam = false;

  try {
    const team = await getTeam(teamId);
    const companyId = team?.companyId || null;
    isDefaultTeam = team?.isDefaultForCompany || false;

    if (companyId) {
      const companyTeams = await getCompanyTeams(companyId);
      const defaultTeamId = companyTeams.find(
        (t: any) => t.isDefaultForCompany,
      )?.id;

      if (defaultTeamId && defaultTeamId !== teamId) {
        // User is on a non-default team, fetch company personas from the default team
        const companyPersonasRaw = await listPersonas(user.id, defaultTeamId);
        companyPersonas = (companyPersonasRaw || []).filter(
          (p: any) => p.visibility === VISIBILITY_COMPANY,
        );
      } else if (isDefaultTeam) {
        // User is on the default team, company personas are in teamPersonasRaw
        companyPersonas = (teamPersonasRaw || []).filter(
          (p: any) => p.visibility === VISIBILITY_COMPANY,
        );
      }
    }
  } catch (error) {
    logger.error("Failed to load company personas", {
      userId: user.id,
      teamId,
      error,
    });
  }

  return { privatePersonas, teamPersonas, companyPersonas, isDefaultTeam };
}

// ==========================================
// Create Persona
// ==========================================

// Create Persona (server action)
// Validates input, generates simple basics (name/one-liner/photo placeholder) and returns the payload.
// NOTE: Persistence is not implemented yet; this is a stub to unblock the UI flow.
export async function createPersona(payload: z.infer<typeof PersonaSchema>) {
  const user = await requireAuth();
  logger.debug("Creating persona (stub)", { userId: user.id });

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
      userId: user?.id,
      errors: parsed.error.errors,
    });
    return validationError("Invalid persona data", parsed.error.errors);
  }

  const data = parsed.data;

  // Simple generation for basics until backend persistence + AI generation is wired
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const role = data.firmographics?.roleSeniority?.trim();
  const dept = data.firmographics?.department?.trim();
  const industry = data.firmographics?.industry?.trim();
  const location = data.demographics?.location?.trim();
  const goal = data.goals?.trim();

  const baseLabel = role || dept || industry || "Persona";
  const generatedName = `${baseLabel} – ${date}`;
  const generatedOneLiner = goal
    ? goal
    : `A representative ${industry ? `${industry.toLowerCase()} ` : ""}persona${location ? ` in ${location}` : ""}.`;
  const photoUrl: string | null = null; // Placeholder until image generation is wired

  const persona = {
    id: uuidv4(),
    userId: user.id,
    name: generatedName,
    oneLiner: generatedOneLiner,
    photoUrl,
    data,
    createdAt: now.toISOString(),
  };

  logger.info("Persona created (stub; not persisted)", {
    userId: user.id,
    personaId: persona.id,
  });

  // In the future: persist to db-worker and redirect to a persona detail page
  return actionSuccess({ persona });
}

// ==========================================
// Update Persona
// ==========================================

// Update Persona (server action)
export async function updatePersona(
  studyId: string,
  payload: z.infer<typeof PersonaSchema>,
) {
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

    const result = await response.json();
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
