import { StudyType } from "@prisma/client";

import {
  TEAM_WITHOUT_COMPANY_MAX_STUDY_FILES,
  TEAM_WITH_COMPANY_MAX_STUDY_FILES,
} from "@/apps/nextjs-app/lib/constants";

export function getStudyUploadLimitForTeam(
  team: { companyId?: string | null } | null | undefined,
) {
  return team?.companyId
    ? TEAM_WITH_COMPANY_MAX_STUDY_FILES
    : TEAM_WITHOUT_COMPANY_MAX_STUDY_FILES;
}

export function getStudyTypeLabel(type: StudyType): string {
  switch (type) {
    case StudyType.COGNITIVE_WALKTHROUGH:
      return "Walkthrough";
    case StudyType.HEURISTIC_EVALUATION:
      return "Evaluation";
    case StudyType.PERSONA:
      return "Persona";
    default:
      return "Study";
  }
}
