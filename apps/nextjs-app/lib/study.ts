import { StudyType } from "@prisma/client";

import {
  PERSONAL_STUDY_FILE_LIMIT,
  TEAM_STUDY_FILE_LIMIT,
} from "@/apps/nextjs-app/lib/constants";

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

export function getStudyFileLimitForTeam(
  isPersonal: boolean | null | undefined,
): number {
  return isPersonal === false ? TEAM_STUDY_FILE_LIMIT : PERSONAL_STUDY_FILE_LIMIT;
}
