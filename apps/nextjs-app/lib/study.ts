import { StudyType } from "@prisma/client";

import {
  PERSONAL_TEAM_MAX_STUDY_FILES,
  SHARED_TEAM_MAX_STUDY_FILES,
} from "@/apps/nextjs-app/lib/constants";

type TeamPersonalFlag = {
  isPersonal: boolean;
};

export function getStudyUploadLimitForTeam(
  team: TeamPersonalFlag | null | undefined,
) {
  return team && !team.isPersonal
    ? SHARED_TEAM_MAX_STUDY_FILES
    : PERSONAL_TEAM_MAX_STUDY_FILES;
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
