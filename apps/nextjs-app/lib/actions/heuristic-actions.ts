"use server";

import { auth } from "@/apps/nextjs-app/auth";
import { logger } from "@/apps/shared/logger";
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
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  try {
    const response = await fetch(`${DB_WORKER_URL}/api/heuristic-families`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...params,
        userId: session.user.id,
      }),
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.message || "Failed to create heuristic family");
    }

    logger.info("Heuristic family created", {
      userId: session.user.id,
      familyId: data.data.id,
      familyName: params.name,
    });

    // Revalidate the library page to show the new family
    revalidatePath("/library");

    return data;
  } catch (error) {
    logger.error("Error creating heuristic family", {
      error,
      userId: session.user.id,
      params,
    });
    throw error;
  }
}

export async function createHeuristic(params: CreateHeuristicParams) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  try {
    const response = await fetch(`${DB_WORKER_URL}/api/heuristics`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...params,
        userId: session.user.id,
      }),
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.message || "Failed to create heuristic");
    }

    logger.info("Heuristic created", {
      userId: session.user.id,
      heuristicId: data.data.id,
      label: params.label,
    });

    return data;
  } catch (error) {
    logger.error("Error creating heuristic", {
      error,
      userId: session.user.id,
      params,
    });
    throw error;
  }
}

export async function updateHeuristicFamily(
  familyId: string,
  params: Partial<CreateHeuristicFamilyParams>,
) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

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
          userId: session.user.id,
        }),
      },
    );

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.message || "Failed to update heuristic family");
    }

    logger.info("Heuristic family updated", {
      userId: session.user.id,
      familyId,
    });

    revalidatePath("/library");

    return data;
  } catch (error) {
    logger.error("Error updating heuristic family", {
      error,
      userId: session.user.id,
      familyId,
    });
    throw error;
  }
}

export async function deleteHeuristicFamily(
  familyId: string,
  companyId: string,
) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

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
          userId: session.user.id,
        }),
      },
    );

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.message || "Failed to delete heuristic family");
    }

    logger.info("Heuristic family deleted", {
      userId: session.user.id,
      familyId,
    });

    revalidatePath("/library");

    return data;
  } catch (error) {
    logger.error("Error deleting heuristic family", {
      error,
      userId: session.user.id,
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
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

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
          userId: session.user.id,
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
      userId: session.user.id,
      familyId,
      isHidden,
    });

    revalidatePath("/library");

    return data;
  } catch (error) {
    logger.error("Error toggling heuristic family visibility", {
      error,
      userId: session.user.id,
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
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

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
      `${DB_WORKER_URL}/api/company?userId=${session.user.id}&companyId=${companyId}`,
    );

    if (!companyResponse.ok) {
      throw new Error("Not authorized to add examples to this heuristic");
    }

    const companyData = await companyResponse.json();
    const userCompany = companyData.data;

    const userId = session.user.id;
    const isAdmin = userCompany?.companyUsers?.some(
      (cu: { userId: string; role: string }) =>
        cu.userId === userId && cu.role === "ADMIN",
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
      body: JSON.stringify(params),
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.message || "Failed to create heuristic example");
    }

    logger.info("Heuristic example created", {
      userId: session.user.id,
      heuristicId: params.heuristicId,
      exampleId: data.data.id,
    });

    // Revalidate the heuristic page to show the new example
    revalidatePath("/library/heuristics");

    return data;
  } catch (error) {
    logger.error("Error creating heuristic example", {
      error,
      userId: session.user.id,
      params,
    });
    throw error;
  }
}
