"use server";

import { logger } from "@/apps/shared/logger";
import { revalidatePath } from "next/cache";
import {
  ActionResult,
  actionError,
  actionSuccess,
  requireAuth,
  requireCompanyAdmin,
} from "@/apps/nextjs-app/lib/actions/shared";
import {
  createHeuristicFamilyData,
  createHeuristicData,
  updateHeuristicFamilyData,
  deleteHeuristicFamilyData,
  toggleHeuristicFamilyVisibilityData,
  getHeuristicById,
  getCompanyWithUsers,
  createHeuristicExampleData,
} from "@/apps/nextjs-app/lib/data";

// ==========================================
// Types
// ==========================================

// Response types
interface HeuristicFamily {
  id: string;
  name: string;
  key: string;
  description?: string | null;
  companyId: string;
}

interface Heuristic {
  id: string;
  label: string;
  category?: string | null;
  heuristic: string;
  description?: string | null;
  heuristicFamilyId: string;
}

interface HeuristicExample {
  id: string;
  title?: string | null;
  example: string;
  heuristicId: string;
}

// Param types
interface CreateHeuristicFamilyParams {
  name: string;
  key: string;
  description?: string;
  companyId: string;
}

interface CreateHeuristicParams {
  heuristicFamilyId: string;
  label: string;
  category?: string;
  heuristic: string;
  description?: string;
  companyId: string;
}

interface CreateHeuristicExampleParams {
  heuristicId: string;
  title?: string;
  example: string;
}

// ==========================================
// Helpers
// ==========================================

const LIBRARY_PATHS = ["/library", "/library/heuristics"] as const;

/**
 * Revalidates all library-related paths after heuristic changes.
 */
function revalidateLibrary() {
  LIBRARY_PATHS.forEach((path) => revalidatePath(path));
}

// ==========================================
// Heuristic Family Actions
// ==========================================

export async function createHeuristicFamily(
  params: CreateHeuristicFamilyParams,
): Promise<ActionResult<HeuristicFamily>> {
  try {
    const user = await requireAuth();

    const result = await createHeuristicFamilyData({
      ...params,
      userId: user.id,
    });

    logger.info("Heuristic family created", {
      userId: user.id,
      familyId: result.id,
      familyName: params.name,
    });

    revalidateLibrary();

    return actionSuccess(result as HeuristicFamily);
  } catch (error) {
    logger.error("Error creating heuristic family", {
      error,
      params,
    });
    return actionError(
      error instanceof Error
        ? error.message
        : "Failed to create heuristic family",
    );
  }
}

export async function updateHeuristicFamily(
  familyId: string,
  params: Partial<CreateHeuristicFamilyParams>,
): Promise<ActionResult<HeuristicFamily>> {
  try {
    const user = await requireAuth();

    const result = await updateHeuristicFamilyData(familyId, {
      ...params,
      userId: user.id,
    });

    logger.info("Heuristic family updated", {
      userId: user.id,
      familyId,
    });

    revalidateLibrary();

    return actionSuccess(result as HeuristicFamily);
  } catch (error) {
    logger.error("Error updating heuristic family", {
      error,
      familyId,
    });
    return actionError(
      error instanceof Error
        ? error.message
        : "Failed to update heuristic family",
    );
  }
}

export async function deleteHeuristicFamily(
  familyId: string,
  companyId: string,
): Promise<ActionResult> {
  try {
    const user = await requireAuth();

    await deleteHeuristicFamilyData(familyId, companyId, user.id);

    logger.info("Heuristic family deleted", {
      userId: user.id,
      familyId,
    });

    revalidateLibrary();

    return actionSuccess();
  } catch (error) {
    logger.error("Error deleting heuristic family", {
      error,
      familyId,
    });
    return actionError(
      error instanceof Error
        ? error.message
        : "Failed to delete heuristic family",
    );
  }
}

export async function toggleHeuristicFamilyVisibility(
  familyId: string,
  companyId: string,
  isHidden: boolean,
): Promise<ActionResult> {
  try {
    const user = await requireAuth();

    await toggleHeuristicFamilyVisibilityData(
      familyId,
      companyId,
      isHidden,
      user.id,
    );

    logger.info("Heuristic family visibility toggled", {
      userId: user.id,
      familyId,
      isHidden,
    });

    revalidateLibrary();

    return actionSuccess();
  } catch (error) {
    logger.error("Error toggling heuristic family visibility", {
      error,
      familyId,
    });
    return actionError(
      error instanceof Error
        ? error.message
        : "Failed to toggle heuristic family visibility",
    );
  }
}

// ==========================================
// Heuristic Actions
// ==========================================

export async function createHeuristic(
  params: CreateHeuristicParams,
): Promise<ActionResult<Heuristic>> {
  try {
    const user = await requireAuth();

    const result = await createHeuristicData({
      ...params,
      userId: user.id,
    });

    logger.info("Heuristic created", {
      userId: user.id,
      heuristicId: result.id,
      label: params.label,
    });

    revalidateLibrary();

    return actionSuccess(result as Heuristic);
  } catch (error) {
    logger.error("Error creating heuristic", {
      error,
      params,
    });
    return actionError(
      error instanceof Error ? error.message : "Failed to create heuristic",
    );
  }
}

// ==========================================
// Heuristic Example Actions
// ==========================================

export async function createHeuristicExample(
  params: CreateHeuristicExampleParams,
): Promise<ActionResult<HeuristicExample>> {
  try {
    const user = await requireAuth();

    // First, fetch the heuristic to check its company
    const heuristic = await getHeuristicById(params.heuristicId);

    // Check if the heuristic belongs to a company
    if (!heuristic.family?.companyId) {
      return actionError(
        "Cannot add examples to global heuristics. Only company-specific heuristics can have custom examples.",
      );
    }

    const companyId = heuristic.family.companyId;

    // Verify user is a company admin for this company
    const userCompany = await getCompanyWithUsers(user.id, companyId);
    requireCompanyAdmin(
      userCompany,
      user.id,
      "Only company administrators can add examples to heuristics",
    );

    // Now create the example
    const result = await createHeuristicExampleData({
      ...params,
      createdById: user.id,
    });

    logger.info("Heuristic example created", {
      userId: user.id,
      heuristicId: params.heuristicId,
      exampleId: result.id,
    });

    revalidateLibrary();

    return actionSuccess(result as HeuristicExample);
  } catch (error) {
    logger.error("Error creating heuristic example", {
      error,
      params,
    });
    return actionError(
      error instanceof Error
        ? error.message
        : "Failed to create heuristic example",
    );
  }
}
