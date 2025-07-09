import {
  createRecommendation as createRecommendationAPI,
  deleteStudyContent as deleteStudyContentAPI,
  createCWIssue as createCWIssueAPI,
} from "@/apps/nextjs-app/lib/data";

export async function handleCreateCWRecommendation(
  issueId: string,
  content: string,
  refreshCallback: () => Promise<void>,
) {
  if (!content.trim()) return;

  await createRecommendationAPI(
    "cognitiveWalkthrough",
    issueId,
    content,
    "HUMAN",
  );

  await refreshCallback();
}

export async function handleDeleteCWRecommendation(
  recommendationId: string,
  refreshCallback: () => Promise<void>,
) {
  await deleteStudyContentAPI(
    recommendationId,
    "cognitiveWalkthrough",
    "recommendation",
  );

  await refreshCallback();
}

export async function handleDeleteCWIssue(
  issueId: string,
  refreshCallback: () => Promise<void>,
) {
  await deleteStudyContentAPI(issueId, "cognitiveWalkthrough", "issue");

  await refreshCallback();
}

export async function handleCreateCWIssue(
  stepId: string,
  issueType: string,
  content: string,
  refreshCallback: () => Promise<void>,
) {
  if (!content.trim()) return;

  await createCWIssueAPI(stepId, issueType, content, "HUMAN");

  await refreshCallback();
}
