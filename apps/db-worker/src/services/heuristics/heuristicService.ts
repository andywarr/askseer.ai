import prisma from "../db.ts";
import { logger } from "@/apps/shared/logger.ts";

// ============================================================================
// Heuristic Operations
// ============================================================================

export async function dbCreateHeuristic(data: {
  heuristicFamilyId: string;
  category?: string;
  label?: string;
  heuristic: string;
  description?: string;
  companyId?: string; // For permission check
  createdById?: string;
}) {
  try {
    // Verify the family exists and user has permission
    const family = await prisma.heuristicFamily.findUnique({
      where: { id: data.heuristicFamilyId },
    });

    if (!family) {
      throw new Error("Heuristic family not found");
    }

    // If it's a company-owned family, verify the company matches
    if (family.companyId && family.companyId !== data.companyId) {
      throw new Error("Access denied to this heuristic family");
    }

    // Global families can't be modified
    if (!family.companyId) {
      throw new Error("Cannot add heuristics to global families");
    }

    const heuristic = await prisma.heuristic.create({
      data: {
        heuristicFamilyId: data.heuristicFamilyId,
        category: data.category,
        label: data.label,
        heuristic: data.heuristic,
        createdById: data.createdById,
      },
    });

    logger.info("Successfully created heuristic", {
      heuristicId: heuristic.id,
      familyId: data.heuristicFamilyId,
    });

    return heuristic;
  } catch (error) {
    logger.error("Failed to create heuristic", { data, error });
    throw error;
  }
}

export async function dbUpdateHeuristic(
  heuristicId: string,
  data: {
    category?: string;
    label?: string;
    heuristic?: string;
    description?: string;
    companyId?: string; // For permission check
  }
) {
  try {
    // Verify the heuristic exists and belongs to a company-owned family
    const existing = await prisma.heuristic.findUnique({
      where: { id: heuristicId },
      include: { family: true },
    });

    if (!existing) {
      throw new Error("Heuristic not found");
    }

    const family = existing.family;
    if (!family || !family.companyId) {
      throw new Error("Cannot modify global heuristics");
    }

    if (data.companyId && family.companyId !== data.companyId) {
      throw new Error("Access denied");
    }

    const { companyId, ...updateData } = data;

    const heuristic = await prisma.heuristic.update({
      where: { id: heuristicId },
      data: updateData,
    });

    logger.info("Successfully updated heuristic", { heuristicId });
    return heuristic;
  } catch (error) {
    logger.error("Failed to update heuristic", { heuristicId, error });
    throw error;
  }
}

export async function dbDeleteHeuristic(
  heuristicId: string,
  companyId?: string
) {
  try {
    // Verify the heuristic exists and belongs to a company-owned family
    const existing = await prisma.heuristic.findUnique({
      where: { id: heuristicId },
      include: { family: true },
    });

    if (!existing) {
      throw new Error("Heuristic not found");
    }

    const family = existing.family;
    if (!family || !family.companyId) {
      throw new Error("Cannot delete global heuristics");
    }

    if (companyId && family.companyId !== companyId) {
      throw new Error("Access denied");
    }

    await prisma.heuristic.delete({
      where: { id: heuristicId },
    });

    logger.info("Successfully deleted heuristic", { heuristicId });
  } catch (error) {
    logger.error("Failed to delete heuristic", { heuristicId, error });
    throw error;
  }
}

export async function dbGetHeuristic(
  heuristicId: string,
  userCompanyId?: string | null
) {
  try {
    const heuristic = await prisma.heuristic.findUnique({
      where: { id: heuristicId },
      include: {
        family: {
          select: {
            id: true,
            companyId: true,
          },
        },
        examples: {
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });

    if (!heuristic) {
      logger.warn("Heuristic not found", { heuristicId });
      return null;
    }

    // Filter examples based on company access
    // Only show examples if:
    // 1. The heuristic belongs to the user's company AND
    // 2. The user has a company (userCompanyId is provided)
    const shouldShowExamples =
      userCompanyId &&
      heuristic.family.companyId &&
      heuristic.family.companyId === userCompanyId;

    const filteredHeuristic = {
      ...heuristic,
      examples: shouldShowExamples ? heuristic.examples : [],
    };

    logger.info("Successfully fetched heuristic", {
      heuristicId,
      totalExamples: heuristic.examples.length,
      filteredExamples: filteredHeuristic.examples.length,
      userCompanyId,
      heuristicCompanyId: heuristic.family.companyId,
    });

    return filteredHeuristic;
  } catch (error) {
    logger.error("Failed to fetch heuristic", { heuristicId, error });
    throw error;
  }
}

/**
 * Get heuristics by family key or ID
 */
export async function dbGetHeuristics(
  familyKey?: string,
  familyId?: string,
  companyId?: string | null
) {
  try {
    if (!familyKey && !familyId) {
      throw new Error("Either familyKey or familyId must be provided");
    }

    // Check if this family is hidden for the company (only if we have a key)
    if (companyId && familyKey) {
      const visibility = await prisma.companyHeuristicVisibility.findFirst({
        where: {
          companyId,
          heuristicFamily: { key: familyKey },
          isHidden: true,
        },
      });

      if (visibility) {
        logger.warn("Heuristic family is hidden for this company", {
          familyKey,
          companyId,
        });
        return [];
      }
    }

    // Get the family and its heuristics - by ID or by key
    const family = await prisma.heuristicFamily.findUnique({
      where: familyId ? { id: familyId } : { key: familyKey },
      include: {
        heuristics: {
          include: {
            examples: true,
          },
        },
      },
    });

    if (!family) {
      logger.error("Heuristic family not found", { familyKey, familyId });
      throw new Error(`Heuristic family not found: ${familyKey || familyId}`);
    }

    // Check if this is a custom family that doesn't belong to the company
    if (family.companyId && family.companyId !== companyId) {
      logger.warn("Access denied to custom heuristic family", {
        familyKey: familyKey || family.key,
        familyId: familyId || family.id,
        ownerId: family.companyId,
        requesterId: companyId,
      });
      return [];
    }

    logger.info("Successfully fetched heuristics", {
      familyKey: familyKey || family.key,
      familyId: familyId || family.id,
      companyId,
      heuristicCount: family.heuristics.length,
    });

    return family.heuristics;
  } catch (error) {
    logger.error("Failed to fetch heuristics", {
      familyKey,
      familyId,
      companyId,
      error,
    });
    throw error;
  }
}

// ============================================================================
// Heuristic Examples
// ============================================================================

/**
 * Add an example to a heuristic
 */
export async function dbCreateHeuristicExample(data: {
  heuristicId: string;
  title?: string;
  description: string;
  companyId?: string;
  createdById?: string;
}) {
  try {
    const heuristic = await prisma.heuristic.findUnique({
      where: { id: data.heuristicId },
      include: { family: true },
    });

    if (!heuristic) {
      throw new Error("Heuristic not found");
    }

    const family = heuristic.family;
    if (!family || !family.companyId) {
      throw new Error("Cannot add examples to global heuristics");
    }

    if (data.companyId && family.companyId !== data.companyId) {
      throw new Error("Access denied");
    }

    const example = await prisma.heuristicExample.create({
      data: {
        heuristicId: data.heuristicId,
        title: data.title,
        example: data.description,
        createdById: data.createdById,
      },
    });

    logger.info("Successfully created heuristic example", {
      exampleId: example.id,
      heuristicId: data.heuristicId,
    });

    return example;
  } catch (error) {
    logger.error("Failed to create heuristic example", { data, error });
    throw error;
  }
}

/**
 * Update a heuristic example
 */
export async function dbUpdateHeuristicExample(
  exampleId: string,
  data: {
    title?: string;
    description?: string;
    companyId?: string;
  }
) {
  try {
    const existing = await prisma.heuristicExample.findUnique({
      where: { id: exampleId },
      include: {
        heuristic: {
          include: { family: true },
        },
      },
    });

    if (!existing) {
      throw new Error("Heuristic example not found");
    }

    const family = existing.heuristic?.family;
    if (!family || !family.companyId) {
      throw new Error("Cannot update examples of global heuristics");
    }

    if (data.companyId && family.companyId !== data.companyId) {
      throw new Error("Access denied");
    }

    const { companyId, ...updateData } = data;

    const example = await prisma.heuristicExample.update({
      where: { id: exampleId },
      data: updateData,
    });

    logger.info("Successfully updated heuristic example", { exampleId });
    return example;
  } catch (error) {
    logger.error("Failed to update heuristic example", { exampleId, error });
    throw error;
  }
}

/**
 * Delete a heuristic example
 */
export async function dbDeleteHeuristicExample(
  exampleId: string,
  companyId?: string
) {
  try {
    const existing = await prisma.heuristicExample.findUnique({
      where: { id: exampleId },
      include: {
        heuristic: {
          include: { family: true },
        },
      },
    });

    if (!existing) {
      throw new Error("Heuristic example not found");
    }

    const family = existing.heuristic?.family;
    if (!family || !family.companyId) {
      throw new Error("Cannot delete examples of global heuristics");
    }

    if (companyId && family.companyId !== companyId) {
      throw new Error("Access denied");
    }

    await prisma.heuristicExample.delete({
      where: { id: exampleId },
    });

    logger.info("Successfully deleted heuristic example", { exampleId });
  } catch (error) {
    logger.error("Failed to delete heuristic example", { exampleId, error });
    throw error;
  }
}
