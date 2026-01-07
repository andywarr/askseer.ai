"use server";

import { logger } from "@/apps/shared/logger";
import { requireAuth } from "./shared";
import { revalidatePath } from "next/cache";

const DB_WORKER_URL = process.env.DB_WORKER_URL;

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

export async function createHeuristicFamily(
  params: CreateHeuristicFamilyParams,
) {
  const user = await requireAuth();

  try {
    const response = await fetch(`${DB_WORKER_URL}/api/heuristic-families`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...params,
        userId: user.id,
      }),
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.message || "Failed to create heuristic family");
    }

    logger.info("Heuristic family created", {
      userId: user.id,
      familyId: data.data.id,
      familyName: params.name,
    });

    // Revalidate the library page to show the new family
    revalidatePath("/library");

    return data;
  } catch (error) {
    logger.error("Error creating heuristic family", {
      error,
      userId: user.id,
      params,
    });
    throw error;
  }
}

export async function createHeuristic(params: CreateHeuristicParams) {
  const user = await requireAuth();

  try {
    const response = await fetch(`${DB_WORKER_URL}/api/heuristics`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...params,
        userId: user.id,
      }),
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.message || "Failed to create heuristic");
    }

    logger.info("Heuristic created", {
      userId: user.id,
      heuristicId: data.data.id,
      label: params.label,
    });

    return data;
  } catch (error) {
    logger.error("Error creating heuristic", {
      error,
      userId: user.id,
      params,
    });
    throw error;
  }
}

export async function updateHeuristicFamily(
  familyId: string,
  params: Partial<CreateHeuristicFamilyParams>,
) {
  const user = await requireAuth();

  try {
    const response = await fetch(
      `${DB_WORKER_URL}/api/heuristic-families/${familyId}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...params,
          userId: user.id,
        }),
      },
    );

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.message || "Failed to update heuristic family");
    }

    logger.info("Heuristic family updated", {
      userId: user.id,
      familyId,
    });

    revalidatePath("/library");

    return data;
  } catch (error) {
    logger.error("Error updating heuristic family", {
      error,
      userId: user.id,
      familyId,
    });
    throw error;
  }
}

export async function deleteHeuristicFamily(
  familyId: string,
  companyId: string,
) {
  const user = await requireAuth();

  try {
    const response = await fetch(
      `${DB_WORKER_URL}/api/heuristic-families/${familyId}`,
      {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          companyId,
          userId: user.id,
        }),
      },
    );

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.message || "Failed to delete heuristic family");
    }

    logger.info("Heuristic family deleted", {
      userId: user.id,
      familyId,
    });

    revalidatePath("/library");

    return data;
  } catch (error) {
    logger.error("Error deleting heuristic family", {
      error,
      userId: user.id,
      familyId,
    });
    throw error;
  }
}

export async function toggleHeuristicFamilyVisibility(
  familyId: string,
  companyId: string,
  isHidden: boolean,
) {
  const user = await requireAuth();

  try {
    const response = await fetch(
      `${DB_WORKER_URL}/api/heuristic-families/${familyId}/visibility`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          companyId,
          isHidden,
          userId: user.id,
        }),
      },
    );

    const data = await response.json();

    if (!data.success) {
      throw new Error(
        data.message || "Failed to toggle heuristic family visibility",
      );
    }

    logger.info("Heuristic family visibility toggled", {
      userId: user.id,
      familyId,
      isHidden,
    });

    revalidatePath("/library");

    return data;
  } catch (error) {
    logger.error("Error toggling heuristic family visibility", {
      error,
      userId: user.id,
      familyId,
    });
    throw error;
  }
}

interface CreateHeuristicExampleParams {
  heuristicId: string;
  title?: string;
  example: string;
}

export async function createHeuristicExample(
  params: CreateHeuristicExampleParams,
) {
  const user = await requireAuth();

  try {
    // First, fetch the heuristic to check its company
    const heuristicResponse = await fetch(
      `${DB_WORKER_URL}/api/heuristics/${params.heuristicId}`,
    );

    if (!heuristicResponse.ok) {
      throw new Error("Heuristic not found");
    }

    const heuristicData = await heuristicResponse.json();
    const heuristic = heuristicData.data;

    // Check if the heuristic belongs to a company
    if (!heuristic.family?.companyId) {
      throw new Error(
        "Cannot add examples to global heuristics. Only company-specific heuristics can have custom examples.",
      );
    }

    const companyId = heuristic.family.companyId;

    // Verify user is a company admin for this company
    const companyResponse = await fetch(
      `${DB_WORKER_URL}/api/company?userId=${user.id}&companyId=${companyId}`,
    );

    if (!companyResponse.ok) {
      throw new Error("Not authorized to add examples to this heuristic");
    }

    const companyData = await companyResponse.json();
    const userCompany = companyData.data;

    const isAdmin = userCompany?.companyUsers?.some(
      (cu: { userId: string; role: string }) =>
        cu.userId === user.id && cu.role === "ADMIN",
    );

    if (!isAdmin) {
      throw new Error(
        "Only company administrators can add examples to heuristics",
      );
    }

    // Now create the example
    const response = await fetch(`${DB_WORKER_URL}/api/heuristic-examples`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...params,
        createdById: user.id,
      }),
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.message || "Failed to create heuristic example");
    }

    logger.info("Heuristic example created", {
      userId: user.id,
      heuristicId: params.heuristicId,
      exampleId: data.data.id,
    });

    // Revalidate the heuristic page to show the new example
    revalidatePath("/library/heuristics");

    return data;
  } catch (error) {
    logger.error("Error creating heuristic example", {
      error,
      userId: user.id,
      params,
    });
    throw error;
  }
}
