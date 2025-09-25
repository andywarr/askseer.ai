import { StudyType } from "@prisma/client";

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
