import prisma from "../db.ts";
import { logger } from "@/apps/shared/logger.ts";

// ============================================================================
// Heuristic Family Operations
// ============================================================================

export async function dbGetHeuristicFamilies(companyId?: string | null) {
  try {
    let hiddenFamilyIds: string[] = [];

    // Get hidden families for this company
    if (companyId) {
      const hiddenVisibility = await prisma.companyHeuristicVisibility.findMany({
        where: {
          companyId,
          isHidden: true,
        },
        select: {
          heuristicFamilyId: true,
        },
      });
      hiddenFamilyIds = hiddenVisibility.map((v) => v.heuristicFamilyId);
    }

    // Get all global families (not hidden) and company-specific families
    const families = await prisma.heuristicFamily.findMany({
      where: {
        AND: [
          {
            OR: [
              { companyId: null }, // Global families
              { companyId }, // Company-specific families
            ],
          },
          {
            id: {
              notIn: hiddenFamilyIds, // Exclude hidden families
            },
          },
        ],
      },
      include: {
        heuristics: {
          include: {
            examples: true,
          },
          orderBy: {
            createdAt: "asc",
          },
        },
        _count: {
          select: {
            heuristics: true,
          },
        },
      },
      orderBy: [{ companyId: "asc" }, { name: "asc" }], // Global first, then company-specific
    });

    logger.info("Successfully fetched heuristic families", {
      companyId,
      familyCount: families.length,
      hiddenCount: hiddenFamilyIds.length,
    });

    return families;
  } catch (error) {
    logger.error("Failed to fetch heuristic families", { companyId, error });
    throw error;
  }
}

export async function dbGetHeuristicFamily(familyId: string) {
  try {
    const family = await prisma.heuristicFamily.findUnique({
      where: {
        id: familyId,
      },
      include: {
        heuristics: {
          include: {
            examples: true,
          },
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });

    if (!family) {
      logger.warn("Heuristic family not found", { familyId });
      return null;
    }

    logger.info("Successfully fetched heuristic family", {
      familyId,
      heuristicCount: family.heuristics.length,
    });

    return family;
  } catch (error) {
    logger.error("Failed to fetch heuristic family", { familyId, error });
    throw error;
  }
}

export async function dbCreateHeuristicFamily(data: {
  name: string;
  key: string;
  description?: string;
  companyId: string;
  createdById?: string;
}) {
  try {
    const family = await prisma.heuristicFamily.create({
      data: {
        name: data.name,
        key: data.key,
        description: data.description,
        companyId: data.companyId,
        createdById: data.createdById,
      },
    });

    logger.info("Successfully created heuristic family", {
      familyId: family.id,
      companyId: data.companyId,
    });

    return family;
  } catch (error) {
    logger.error("Failed to create heuristic family", { data, error });
    throw error;
  }
}

export async function dbUpdateHeuristicFamily(
  familyId: string,
  data: {
    name?: string;
    description?: string;
  }
) {
  try {
    const family = await prisma.heuristicFamily.update({
      where: { id: familyId },
      data,
    });

    logger.info("Successfully updated heuristic family", { familyId });
    return family;
  } catch (error) {
    logger.error("Failed to update heuristic family", { familyId, error });
    throw error;
  }
}

export async function dbDeleteHeuristicFamily(
  familyId: string,
  companyId: string
) {
  try {
    // Verify the family belongs to the company
    const family = await prisma.heuristicFamily.findFirst({
      where: {
        id: familyId,
        companyId,
      },
    });

    if (!family) {
      throw new Error("Heuristic family not found or access denied");
    }

    await prisma.heuristicFamily.delete({
      where: { id: familyId },
    });

    logger.info("Successfully deleted heuristic family", {
      familyId,
      companyId,
    });
  } catch (error) {
    logger.error("Failed to delete heuristic family", { familyId, error });
    throw error;
  }
}

export async function dbToggleHeuristicFamilyVisibility(
  familyId: string,
  companyId: string,
  isHidden: boolean
) {
  try {
    // Verify the family is global (not company-owned)
    const family = await prisma.heuristicFamily.findFirst({
      where: {
        id: familyId,
        companyId: null, // Must be global
      },
    });

    if (!family) {
      throw new Error(
        "Can only toggle visibility for global heuristic families"
      );
    }

    const visibility = await prisma.companyHeuristicVisibility.upsert({
      where: {
        companyId_heuristicFamilyId: {
          companyId,
          heuristicFamilyId: familyId,
        },
      },
      create: {
        companyId,
        heuristicFamilyId: familyId,
        isHidden,
      },
      update: {
        isHidden,
      },
    });

    logger.info("Successfully toggled heuristic family visibility", {
      familyId,
      companyId,
      isHidden,
    });

    return visibility;
  } catch (error) {
    logger.error("Failed to toggle heuristic family visibility", {
      familyId,
      companyId,
      error,
    });
    throw error;
  }
}
