"use server";

// Next imports
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

// Lib function imports
import { isAuthenticated } from "@/apps/nextjs-app/lib/dal";
import prisma from "@/apps/nextjs-app/lib/db";

import { FileType, HeuristicType, ImageType, StudyType } from "@prisma/client";

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

function convertToFileType(type: string): FileType {
  switch (type.split("/")[0].toLowerCase()) {
    case "image":
      return FileType.IMAGE;
    default:
      return FileType.UNKNOWN;
  }
}

function convertToHeuristicType(heuristic: string): HeuristicType {
  switch (heuristic.toUpperCase()) {
    case "NIELSEN":
      return HeuristicType.NIELSEN;
    case "TENETS":
      return HeuristicType.TENETS;
    default:
      return HeuristicType.UNKNOWN;
  }
}

function convertToImageType(type: string): ImageType {
  switch (type.split("/")[1].toLowerCase()) {
    case "apng":
      return ImageType.APNG;
    case "avif":
      return ImageType.AVIF;
    case "gif":
      return ImageType.GIF;
    case "jpeg":
      return ImageType.JPEG;
    case "png":
      return ImageType.PNG;
    case "svg+xml":
      return ImageType.SVG;
    case "webp":
      return ImageType.WEBP;
    default:
      return ImageType.UNKNOWN;
  }
}

export async function getUser(userId: string) {
  let session = await isAuthenticated();

  // A user cannot get another user
  if (session.userId !== userId) {
    redirect("/error");
  }

  const response = await fetch(
    `${process.env.DB_WORKER_URL}/api/user?userId=${userId}`,
  );
  const { data: user } = await response.json();

  // If a user does not exist there is a problem
  if (!user) {
    redirect("/error");
  }

  return user;
}

export async function updateCredits(userId: string, credits: number) {
  try {
    const response = await fetch(
      `${process.env.DB_WORKER_URL}/api/updateCredits`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId: userId, delta: credits }),
      },
    );
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error updating credits:", error);
    throw error;
  }
}

export async function updateStudyName(
  userId: string,
  studyId: string,
  name: string,
) {
  let session = await isAuthenticated();

  // A user cannot update another users study
  if (session.userId !== userId) {
    redirect("/error");
  }

  const updatedUser = await prisma.study.update({
    where: { id: studyId },
    data: {
      name: name,
    },
  });

  revalidatePath(`/heuristic/${studyId}`);
}

export async function deleteStudy(studyId: string, userId: string) {
  let session = await isAuthenticated();

  // A user cannot update another user's data
  if (session.userId !== userId) {
    redirect("/error");
  }

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
    redirect("/error");
  }
}

export async function getCognitiveWalkthrough(id: string, userId: string) {
  let session = await isAuthenticated();

  // A user cannot access another user's data
  if (session.userId !== userId) {
    redirect("/error");
  }

  let cognitiveWalkthrough = await prisma.study.findUnique({
    where: {
      id: id,
    },
    include: {
      files: true,
      cognitiveWalkthrough: {
        include: {
          steps: {
            include: {
              issues: {
                include: {
                  recommendations: true,
                },
              },
              results: {
                include: {
                  question: true,
                },
                orderBy: {
                  question: {
                    questionNumber: "asc", // Order by questionNumber in the CWQuestion model
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  // If data does not exist there is a problem
  if (!cognitiveWalkthrough) {
    redirect("/error");
  }

  return cognitiveWalkthrough;
}

export async function getHeuristicEvaluation(id: string, userId: string) {
  let session = await isAuthenticated();

  // A user cannot access another user's data
  if (session.userId !== userId) {
    redirect("/error");
  }

  let heuristicEvaluation = await prisma.study.findUnique({
    where: {
      id: id,
    },
    include: {
      files: true,
      heuristicEvaluation: {
        include: {
          results: {
            include: {
              heuristic: true,
              recommendations: true,
            },
            orderBy: {
              heuristic: {
                heuristic: "asc", // Order alphabetically (ascending)
              },
            },
          },
        },
      },
    },
  });

  // If data does not exist there is a problem
  if (!heuristicEvaluation) {
    redirect("/error");
  }

  return heuristicEvaluation;
}

export async function getStudy(
  studyId: string,
  userId: string,
  type: StudyType,
) {
  let session = await isAuthenticated();

  // A user cannot access another user's data
  if (session.userId !== userId) {
    redirect("/error");
  }

  // Get a study for the user
  const response = await fetch(
    `${process.env.DB_WORKER_URL}/api/study?studyId=${studyId}&userId=${userId}`,
  );
  const { data: study } = await response.json();

  // If data does not exist there is a problem
  if (!study) {
    redirect("/error");
  }

  return study;
}

export async function getStudies(
  userId: string,
  type: StudyType = StudyType.UNKNOWN,
) {
  let session = await isAuthenticated();

  // A user cannot update another user's data
  if (session.userId !== userId) {
    redirect("/error");
  }

  // Get all studies for the user
  const response = await fetch(
    `${process.env.DB_WORKER_URL}/api/studies?userId=${userId}`,
  );
  const { data: studies } = await response.json();

  return studies;
}

export async function postStudy(jobData: any) {
  let session = await isAuthenticated();

  // A user cannot get another user
  if (session.userId !== jobData.data.userId) {
    redirect("/error");
  }

  const response = await fetch(`${process.env.DB_WORKER_URL}/api/study`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(jobData),
  });
  const { data: study } = await response.json();

  // If a study is not created there is a problem
  if (!study) {
    redirect("/error");
  }

  return study;
}

export async function updateStatus(studyId: string, status: string) {
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
    return data;
  } catch (error) {
    console.error("Error updating credits:", error);
    throw error;
  }
}

export async function updateStudyContent(
  id: string,
  studyType: "cognitiveWalkthrough" | "heuristicEvaluation",
  type: "issue" | "recommendation",
  content: string,
) {
  const endpoint = `${process.env.DB_WORKER_URL}/api/${studyType}/${type}s/${id}`;
  const requestBody =
    type === "issue" ? { issue: content } : { recommendation: content };

  const response = await fetch(endpoint, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  console.log(endpoint);

  if (!response.ok) {
    throw new Error("Failed to update content");
  }

  const data = await response.json();
  return data;
}

export async function deleteStudyContent(
  id: string,
  studyType: "cognitiveWalkthrough" | "heuristicEvaluation",
  type: "issue" | "recommendation",
) {
  const endpoint = `${process.env.DB_WORKER_URL}/api/${studyType}/${type}s/${id}`;

  const response = await fetch(endpoint, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error("Failed to delete content");
  }

  const data = await response.json();
  return data;
}
