"use server";

// Next imports
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

// Lib function imports
import { isAuthenticated } from "@/apps/nextjs-app/lib/dal";
import { logger } from "@/apps/shared/logger";

import { StudyType } from "@prisma/client";
import { parseJobEnvelope } from "@/apps/shared/jobSchema";

interface FileData {
  name: string;
  data: string;
  key?: string;
  size: number;
  type: string;
}

interface ResultData {
  id: string;
  heuristic: string;
  type: string;
  violated: string;
  reason: string;
  recommendation: string;
}

interface CWResultData {
  questionId: string;
  answer: string;
}

interface CWIssueData {
  issueType: string;
  issue: string;
  recommendations: Array<CWRecommendationData>;
}

interface CWRecommendationData {
  recommendation: string;
}

interface CWStepData {
  step: number;
  expected: boolean;
  results: Array<CWResultData>;
  issues: Array<CWIssueData>;
}

interface StudyDetails {
  name: string;
  goal: string;
  files: FileData[];
  heuristic: string;
  context: string | null;
  userId: string;
}

export async function getUser(userId: string) {
  logger.debug("Getting user data", { userId });

  let session = await isAuthenticated();

  // A user cannot access another user's data
  if (session.userId !== userId) {
    logger.warn("User attempted to access another user's data", {
      sessionUserId: session.userId,
      requestedUserId: userId,
    });
    redirect("/error");
  }

  try {
    const response = await fetch(
      `${process.env.DB_WORKER_URL}/api/user?userId=${userId}`,
    );
    const { data: user } = await response.json();

    // If a user does not exist there is a problem
    if (!user) {
      logger.error("User not found in database", { userId });
      redirect("/error");
    }

    logger.info("User data retrieved successfully", { userId });
    return user;
  } catch (error) {
    logger.error("Error fetching user data", { userId, error });
    redirect("/error");
  }
}

export async function getTeam(teamId: string) {
  logger.debug("Getting team data", { teamId });
  try {
    const res = await fetch(
      `${process.env.DB_WORKER_URL}/api/team?teamId=${teamId}`,
      { cache: "no-store" },
    );
    if (!res.ok) {
      logger.error("Failed to fetch team", { teamId, status: res.status });
      throw new Error("Failed to fetch team");
    }
    const { data } = await res.json();
    logger.info("Team data retrieved successfully", { teamId });
    return data;
  } catch (error) {
    logger.error("Error fetching team data", { teamId, error });
    throw error;
  }
}

export async function consumeTeamCreditByStudy(
  studyId: string,
  byUserId: string,
) {
  logger.debug("Consuming team credit by study", { studyId, byUserId });
  const res = await fetch(
    `${process.env.DB_WORKER_URL}/api/team/credits/consume`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studyId, byUserId }),
    },
  );
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    logger.error("Failed to consume team credit", {
      studyId,
      status: res.status,
      body: body.slice(0, 200),
    });
    throw new Error("Failed to consume team credit");
  }
  const { data } = await res.json();
  logger.info("Team credit consumed", { studyId });
  return data;
}

export async function updateStudyName(
  userId: string,
  studyId: string,
  name: string,
) {
  logger.debug("Updating study name", { userId, studyId, name });

  let session = await isAuthenticated();

  // A user cannot update another users study
  if (session.userId !== userId) {
    logger.warn("User attempted to update another user's study name", {
      sessionUserId: session.userId,
      requestedUserId: userId,
      studyId,
    });
    redirect("/error");
  }

  try {
    const response = await fetch(
      `${process.env.DB_WORKER_URL}/api/study/name`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ studyId: studyId, name: name }),
      },
    );

    if (!response.ok) {
      logger.error("Failed to update study name", {
        userId,
        studyId,
        name,
        status: response.status,
      });
      throw new Error(`Failed to update study name: ${response.status}`);
    }

    logger.info("Study name updated successfully", { userId, studyId, name });
    revalidatePath(`/studies`);
  } catch (error) {
    logger.error("Error updating study name", { userId, studyId, name, error });
    throw error;
  }
}

export async function deleteStudy(studyId: string, userId: string) {
  logger.debug("Deleting study", { studyId, userId });

  let session = await isAuthenticated();

  // A user cannot update another user's data
  if (session.userId !== userId) {
    logger.warn("User attempted to delete another user's study", {
      sessionUserId: session.userId,
      requestedUserId: userId,
      studyId,
    });
    redirect("/error");
  }

  try {
    // Delete a study for the user
    const response = await fetch(
      `${process.env.DB_WORKER_URL}/api/study?studyId=${studyId}&userId=${userId}`,
      {
        method: "DELETE",
      },
    );
    const { success } = await response.json();

    // If data does not exist there is a problem
    if (!success) {
      logger.error("Failed to delete study", { studyId, userId });
      redirect("/error");
    }

    logger.info("Study deleted successfully", { studyId, userId });
  } catch (error) {
    logger.error("Error deleting study", { studyId, userId, error });
    redirect("/error");
  }
}

export async function getCognitiveWalkthrough(id: string, userId: string) {
  logger.debug("Getting cognitive walkthrough data", { studyId: id, userId });

  let session = await isAuthenticated();

  // A user cannot access another user's data
  if (session.userId !== userId) {
    logger.warn(
      "User attempted to access another user's cognitive walkthrough",
      {
        sessionUserId: session.userId,
        requestedUserId: userId,
        studyId: id,
      },
    );
    redirect("/error");
  }

  try {
    // Get cognitive walkthrough data from the db-worker
    const response = await fetch(
      `${process.env.DB_WORKER_URL}/api/cognitiveWalkthrough?studyId=${id}&userId=${userId}`,
    );
    const { data: cognitiveWalkthrough } = await response.json();

    // If data does not exist there is a problem
    if (!cognitiveWalkthrough) {
      logger.error("Cognitive walkthrough not found", { studyId: id, userId });
      redirect("/error");
    }

    logger.info("Cognitive walkthrough data retrieved successfully", {
      studyId: id,
      userId,
    });
    return cognitiveWalkthrough;
  } catch (error) {
    logger.error("Error fetching cognitive walkthrough data", {
      studyId: id,
      userId,
      error,
    });
    redirect("/error");
  }
}

export async function getHeuristicEvaluation(id: string, userId: string) {
  logger.debug("Getting heuristic evaluation data", { studyId: id, userId });

  let session = await isAuthenticated();

  // A user cannot access another user's data
  if (session.userId !== userId) {
    logger.warn(
      "User attempted to access another user's heuristic evaluation",
      {
        sessionUserId: session.userId,
        requestedUserId: userId,
        studyId: id,
      },
    );
    redirect("/error");
  }

  try {
    // Get heuristic evaluation data from the db-worker
    const response = await fetch(
      `${process.env.DB_WORKER_URL}/api/heuristicEvaluation?studyId=${id}&userId=${userId}`,
    );
    const { data: heuristicEvaluation } = await response.json();

    // If data does not exist there is a problem
    if (!heuristicEvaluation) {
      logger.error("Heuristic evaluation not found", { studyId: id, userId });
      redirect("/error");
    }

    logger.info("Heuristic evaluation data retrieved successfully", {
      studyId: id,
      userId,
    });
    return heuristicEvaluation;
  } catch (error) {
    logger.error("Error fetching heuristic evaluation data", {
      studyId: id,
      userId,
      error,
    });
    redirect("/error");
  }
}

export async function getPersona(id: string, userId: string) {
  logger.debug("Getting persona data", { studyId: id, userId });

  let session = await isAuthenticated();

  // A user cannot access another user's data
  if (session.userId !== userId) {
    logger.warn("User attempted to access another user's persona", {
      sessionUserId: session.userId,
      requestedUserId: userId,
      studyId: id,
    });
    redirect("/error");
  }

  try {
    // Get persona data from the db-worker
    const response = await fetch(
      `${process.env.DB_WORKER_URL}/api/persona?studyId=${id}&userId=${userId}`,
    );
    const { data: persona } = await response.json();

    // If data does not exist there is a problem
    if (!persona) {
      logger.error("Persona not found", { studyId: id, userId });
      redirect("/error");
    }

    logger.info("Persona data retrieved successfully", {
      studyId: id,
      userId,
    });
    return persona;
  } catch (error) {
    logger.error("Error fetching persona data", {
      studyId: id,
      userId,
      error,
    });
    redirect("/error");
  }
}

export async function listPersonas(userId: string) {
  logger.debug("Listing personas for user", { userId });
  const session = await isAuthenticated();
  if (session.userId !== userId) {
    logger.warn("User attempted to access another user's personas", {
      sessionUserId: session.userId,
      requestedUserId: userId,
    });
    redirect("/error");
  }
  try {
    const res = await fetch(
      `${process.env.DB_WORKER_URL}/api/personas?userId=${userId}`,
      { cache: "no-store" },
    );
    if (!res.ok) {
      logger.error("Failed to list personas", { userId, status: res.status });
      redirect("/error");
    }
    const { data } = await res.json();
    logger.info("Personas retrieved successfully", {
      userId,
      count: data?.length || 0,
    });
    return data;
  } catch (error) {
    logger.error("Error listing personas", { userId, error });
    redirect("/error");
  }
}

export async function getStudy(
  studyId: string,
  userId: string,
  type: StudyType,
) {
  logger.debug("Getting study data", { studyId, userId, type });

  let session = await isAuthenticated();

  // A user cannot access another user's data
  if (session.userId !== userId) {
    logger.warn("User attempted to access another user's study", {
      sessionUserId: session.userId,
      requestedUserId: userId,
      studyId,
      type,
    });
    redirect("/error");
  }

  try {
    // Get a study for the user
    const response = await fetch(
      `${process.env.DB_WORKER_URL}/api/study?studyId=${studyId}&userId=${userId}`,
    );
    const { data: study } = await response.json();

    // If data does not exist there is a problem
    if (!study) {
      logger.error("Study not found", { studyId, userId, type });
      redirect("/error");
    }

    logger.info("Study data retrieved successfully", { studyId, userId, type });
    return study;
  } catch (error) {
    logger.error("Error fetching study data", { studyId, userId, type, error });
    redirect("/error");
  }
}

export async function getStudies(
  userId: string,
  type: StudyType | null = null,
) {
  logger.debug("Getting all studies for user", { userId, type });

  let session = await isAuthenticated();

  // A user cannot update another user's data
  if (session.userId !== userId) {
    logger.warn("User attempted to access another user's studies", {
      sessionUserId: session.userId,
      requestedUserId: userId,
      type,
    });
    redirect("/error");
  }

  try {
    // Get all studies for the user
    const response = await fetch(
      `${process.env.DB_WORKER_URL}/api/studies?userId=${userId}`,
    );
    const { data: studies } = await response.json();

    logger.info("Studies retrieved successfully", {
      userId,
      type,
      studyCount: studies?.length || 0,
    });
    return studies;
  } catch (error) {
    logger.error("Error fetching studies", { userId, type, error });
    redirect("/error");
  }
}

export async function postStudy(jobData: any) {
  // Accept legacy shape and convert to v2 envelope required by DB worker
  let envelope: any;
  if (jobData?.version === 2) {
    envelope = jobData;
  } else {
    const d = jobData?.data || {};
    const task = (
      jobData?.type ||
      jobData?.task ||
      d?.type ||
      ""
    ).toLowerCase();
    const base = {
      name: d?.name,
      goal: d?.goal,
      user: d?.user ?? null,
      context: d?.context ?? null,
      files: Array.isArray(d?.files) ? d.files : [],
    };
    envelope =
      task === "heuristic_evaluation"
        ? {
            version: 2,
            studyId: jobData?.studyId,
            userId: d?.userId,
            type: task,
            payload: { ...base, heuristic: (d?.heuristic || "").toUpperCase() },
          }
        : {
            version: 2,
            studyId: jobData?.studyId,
            userId: d?.userId,
            type: task,
            payload: { ...base },
          };
  }

  logger.debug("Creating new study (v2)", {
    userId: envelope?.userId,
    studyType: envelope?.type,
  });

  const session = await isAuthenticated();
  if (session.userId !== envelope.userId) {
    logger.warn("User attempted to create study for another user", {
      sessionUserId: session.userId,
      requestedUserId: envelope.userId,
    });
    redirect("/error");
  }

  // Validate v2 envelope before sending (shared parser)
  let parsedEnvelope: any;
  try {
    parsedEnvelope = parseJobEnvelope(envelope);
  } catch (error) {
    logger.error("Invalid jobData for postStudy (v2)", {
      error: (error as Error)?.message,
    });
    redirect("/error");
  }

  try {
    const response = await fetch(`${process.env.DB_WORKER_URL}/api/study`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsedEnvelope),
    });
    const { data: study } = await response.json();
    if (!study) {
      logger.error("Failed to create study", {
        userId: envelope?.userId,
        studyType: envelope?.type,
      });
      redirect("/error");
    }
    logger.info("Study created successfully", {
      userId: envelope?.userId,
      studyType: envelope?.type,
      studyId: study?.id,
    });
    return study;
  } catch (error) {
    logger.error("Error creating study", {
      userId: envelope?.userId,
      studyType: envelope?.type,
      error,
    });
    redirect("/error");
  }
}

export async function updateAttempts(studyId: string) {
  logger.debug("Updating study attempts", { studyId });

  try {
    const response = await fetch(
      `${process.env.DB_WORKER_URL}/api/studyAttempts`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ studyId: studyId }),
      },
    );
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    logger.info("Study attempts updated successfully", {
      studyId,
      newAttempts: data.attempts,
    });
    return data;
  } catch (error) {
    logger.error("Error updating number of study attempts", { studyId, error });
    throw error;
  }
}

export async function updateStatus(studyId: string, status: string) {
  logger.debug("Updating study status", { studyId, status });

  try {
    const response = await fetch(
      `${process.env.DB_WORKER_URL}/api/studyStatus`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ studyId: studyId, status: status }),
      },
    );
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    logger.info("Study status updated successfully", { studyId, status });
    return data;
  } catch (error) {
    logger.error("Error updating study status", { studyId, status, error });
    throw error;
  }
}

export async function updateStudyContent(
  id: string,
  studyType: "cognitiveWalkthrough" | "heuristicEvaluation",
  type: "issue" | "recommendation",
  content: string,
) {
  logger.debug("Updating study content", {
    id,
    studyType,
    type,
    contentLength: content.length,
  });

  const endpoint = `${process.env.DB_WORKER_URL}/api/${studyType}/${type}s/${id}`;
  const requestBody =
    type === "issue" ? { issue: content } : { recommendation: content };

  try {
    const response = await fetch(endpoint, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      logger.error("Failed to update study content", {
        id,
        studyType,
        type,
        endpoint,
        status: response.status,
      });
      throw new Error("Failed to update content");
    }

    const data = await response.json();
    logger.info("Study content updated successfully", { id, studyType, type });
    return data;
  } catch (error) {
    logger.error("Error updating study content", {
      id,
      studyType,
      type,
      error,
    });
    throw error;
  }
}

export async function deleteStudyContent(
  id: string,
  studyType: "cognitiveWalkthrough" | "heuristicEvaluation",
  type: "issue" | "recommendation",
) {
  logger.debug("Deleting study content", { id, studyType, type });

  const endpoint = `${process.env.DB_WORKER_URL}/api/${studyType}/${type}s/${id}`;

  try {
    const response = await fetch(endpoint, {
      method: "DELETE",
    });

    if (!response.ok) {
      logger.error("Failed to delete study content", {
        id,
        studyType,
        type,
        endpoint,
        status: response.status,
      });
      throw new Error("Failed to delete content");
    }

    const data = await response.json();
    logger.info("Study content deleted successfully", { id, studyType, type });
    return data;
  } catch (error) {
    logger.error("Error deleting study content", {
      id,
      studyType,
      type,
      error,
    });
    throw error;
  }
}

export async function createRecommendation(
  studyType: "cognitiveWalkthrough" | "heuristicEvaluation",
  parentId: string, // issueId or resultId
  recommendation: string,
  source: string,
) {
  logger.debug("Creating recommendation", {
    studyType,
    parentId,
    source,
    recommendationLength: recommendation.length,
  });

  const endpoint = `${process.env.DB_WORKER_URL}/api/${studyType}/recommendations`;
  const body =
    studyType === "cognitiveWalkthrough"
      ? { issueId: parentId, recommendation, source }
      : { resultId: parentId, recommendation, source };

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      logger.error("Failed to create recommendation", {
        studyType,
        parentId,
        source,
        endpoint,
        status: response.status,
      });
      throw new Error("Failed to create recommendation");
    }

    const data = await response.json();
    logger.info("Recommendation created successfully", {
      studyType,
      parentId,
      source,
      recommendationId: data?.id,
    });
    return data;
  } catch (error) {
    logger.error("Error creating recommendation", {
      studyType,
      parentId,
      source,
      error,
    });
    throw error;
  }
}

export async function createHEResult(
  heuristicEvaluationId: string,
  heuristicId: string,
  step: number,
  fileId: string,
  reason: string,
  source: string,
) {
  logger.debug("Creating heuristic evaluation result", {
    heuristicEvaluationId,
    heuristicId,
    step,
    fileId,
    source,
    reasonLength: reason.length,
  });

  const endpoint = `${process.env.DB_WORKER_URL}/api/heuristicEvaluation/results`;
  const body = {
    heuristicEvaluationId,
    heuristicId,
    step,
    fileId,
    reason,
    source,
  };

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      logger.error("Failed to create heuristic evaluation result", {
        heuristicEvaluationId,
        heuristicId,
        step,
        fileId,
        source,
        status: response.status,
      });
      throw new Error("Failed to create heuristic evaluation issue");
    }

    const data = await response.json();
    logger.info("Heuristic evaluation result created successfully", {
      heuristicEvaluationId,
      heuristicId,
      step,
      fileId,
      source,
      resultId: data?.id,
    });
    return data;
  } catch (error) {
    logger.error("Error creating heuristic evaluation result", {
      heuristicEvaluationId,
      heuristicId,
      step,
      fileId,
      source,
      error,
    });
    throw error;
  }
}

export async function createCWIssue(
  stepId: string,
  issueType: string,
  issue: string,
  source: string,
) {
  logger.debug("Creating cognitive walkthrough issue", {
    stepId,
    issueType,
    source,
    issueLength: issue.length,
  });

  const endpoint = `${process.env.DB_WORKER_URL}/api/cognitiveWalkthrough/issues`;
  const body = { stepId, issueType, issue, source };

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      logger.error("Failed to create cognitive walkthrough issue", {
        stepId,
        issueType,
        source,
        status: response.status,
      });
      throw new Error("Failed to create cognitive walkthrough issue");
    }

    const data = await response.json();
    logger.info("Cognitive walkthrough issue created successfully", {
      stepId,
      issueType,
      source,
      issueId: data?.id,
    });
    return data;
  } catch (error) {
    logger.error("Error creating cognitive walkthrough issue", {
      stepId,
      issueType,
      source,
      error,
    });
    throw error;
  }
}

export async function getStudyStatus(studyId: string, userId: string) {
  logger.debug("Getting study status", { studyId, userId });

  let session = await isAuthenticated();

  // A user cannot access another user's data
  if (session.userId !== userId) {
    logger.warn("User attempted to access another user's study status", {
      sessionUserId: session.userId,
      requestedUserId: userId,
      studyId,
    });
    redirect("/error");
  }

  try {
    // Get study status from the db-worker
    const response = await fetch(
      `${process.env.DB_WORKER_URL}/api/study?studyId=${studyId}&userId=${userId}`,
    );
    const { data: study } = await response.json();

    // If data does not exist there is a problem
    if (!study) {
      logger.error("Study not found when getting status", { studyId, userId });
      redirect("/error");
    }

    logger.info("Study status retrieved successfully", {
      studyId,
      userId,
      status: study.status,
    });
    return { status: study.status };
  } catch (error) {
    logger.error("Error fetching study status", { studyId, userId, error });
    redirect("/error");
  }
}

export async function updateUserName(userId: string, name: string) {
  logger.debug("Updating user name", { userId, name });

  const session = await isAuthenticated();

  if (session.userId !== userId) {
    logger.warn("User attempted to update another user's name", {
      sessionUserId: session.userId,
      requestedUserId: userId,
    });
    redirect("/error");
  }

  try {
    const response = await fetch(`${process.env.DB_WORKER_URL}/api/user/name`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userId, name }),
    });

    if (!response.ok) {
      logger.error("Failed to update user name", {
        userId,
        name,
        status: response.status,
      });
      throw new Error(`Failed to update user name: ${response.status}`);
    }

    logger.info("User name updated successfully", { userId, name });
    revalidatePath("/account");
  } catch (error) {
    logger.error("Error updating user name", { userId, name, error });
    throw error;
  }
}

export async function updateUserImage(userId: string, imageKey: string | null) {
  logger.debug("Updating user image", { userId, imageKey });

  const session = await isAuthenticated();

  if (session.userId !== userId) {
    logger.warn("User attempted to update another user's image", {
      sessionUserId: session.userId,
      requestedUserId: userId,
    });
    redirect("/error");
  }

  try {
    const response = await fetch(
      `${process.env.DB_WORKER_URL}/api/user/image`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId, imageKey }),
        cache: "no-store",
      },
    );

    if (!response.ok) {
      logger.error("Failed to update user image", {
        userId,
        imageKey,
        status: response.status,
      });
      throw new Error(`Failed to update user image: ${response.status}`);
    }

    logger.info("User image updated successfully", { userId, imageKey });
    revalidatePath("/account");
  } catch (error) {
    logger.error("Error updating user image", { userId, imageKey, error });
    throw error;
  }
}

export async function initStudyDb(
  name: string | null,
  type: string,
  userId: string,
  teamId: string,
) {
  logger.debug("Initializing study via db-worker", { userId, teamId, type });
  const res = await fetch(`${process.env.DB_WORKER_URL}/api/study/init`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, teamId, name, type }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    logger.error("initStudyDb failed", {
      status: res.status,
      body: body.slice(0, 200),
    });
    throw new Error("Failed to init study");
  }
  return (await res.json()).data; // { id, ... }
}

export async function finalizeStudyDb(
  studyId: string,
  files: Array<{ name: string; key: string; size: number; type: string }>,
  jobData: any,
) {
  logger.debug("Finalizing study via db-worker", {
    studyId,
    fileCount: files.length,
  });
  const res = await fetch(`${process.env.DB_WORKER_URL}/api/study/finalize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ studyId, files, jobData }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    logger.error("finalizeStudyDb failed", {
      studyId,
      status: res.status,
      body: body.slice(0, 200),
    });
    throw new Error("Failed to finalize study");
  }
  return (await res.json()).data;
}

export async function getCommunicationPreferences(userId: string) {
  logger.debug("Getting communication preferences", { userId });
  const session = await isAuthenticated();
  if (session.userId !== userId) {
    logger.warn("User attempted to access another user's communication prefs", {
      sessionUserId: session.userId,
      requestedUserId: userId,
    });
    redirect("/error");
  }
  try {
    const res = await fetch(
      `${process.env.DB_WORKER_URL}/api/communicationPreferences?userId=${userId}`,
      { cache: "no-store" },
    );
    if (!res.ok) {
      logger.error("Failed to fetch communication preferences", {
        userId,
        status: res.status,
      });
      redirect("/error");
    }
    const { data } = await res.json();
    logger.info("Communication preferences retrieved successfully", { userId });
    return data;
  } catch (error) {
    logger.error("Error fetching communication preferences", { userId, error });
    redirect("/error");
  }
}

const OPTIONAL_COMM_PREF_KEYS = [
  "digest",
  "productUpdates",
  "promotions",
  "educational",
  "feedback",
] as const;

type OptionalCommPrefKey = (typeof OPTIONAL_COMM_PREF_KEYS)[number];

export async function updateCommunicationPreferences(
  userId: string,
  updates: Partial<Record<OptionalCommPrefKey, boolean>>,
) {
  logger.debug("Updating communication preferences", {
    userId,
    keys: Object.keys(updates || {}),
  });
  const session = await isAuthenticated();
  if (session.userId !== userId) {
    logger.warn("User attempted to update another user's communication prefs", {
      sessionUserId: session.userId,
      requestedUserId: userId,
    });
    redirect("/error");
  }
  // Filter allowed keys
  const filtered: Record<string, boolean> = {};
  for (const k of Object.keys(updates || {})) {
    if (
      OPTIONAL_COMM_PREF_KEYS.includes(k as OptionalCommPrefKey) &&
      typeof updates[k as OptionalCommPrefKey] === "boolean"
    ) {
      filtered[k] = updates[k as OptionalCommPrefKey] as boolean;
    }
  }
  if (!Object.keys(filtered).length) {
    logger.warn("No valid communication preference fields supplied", {
      userId,
    });
    throw new Error("No valid communication preference fields supplied");
  }
  try {
    const res = await fetch(
      `${process.env.DB_WORKER_URL}/api/communicationPreferences`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, updates: filtered }),
      },
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      logger.error("Failed to update communication preferences", {
        userId,
        status: res.status,
        body: body.slice(0, 200),
      });
      throw new Error("Failed to update communication preferences");
    }
    const { data } = await res.json();
    logger.info("Communication preferences updated successfully", {
      userId,
      keys: Object.keys(filtered),
    });
    revalidatePath("/account");
    return data;
  } catch (error) {
    logger.error("Error updating communication preferences", { userId, error });
    throw error;
  }
}
