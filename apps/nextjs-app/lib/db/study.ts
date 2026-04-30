import { StudyType } from "@prisma/client";

import {
  TEAM_WITHOUT_COMPANY_MAX_STUDY_FILES,
  TEAM_WITH_COMPANY_MAX_STUDY_FILES,
} from "@/apps/nextjs-app/lib/utils/constants";

export function getStudyUploadLimitForTeam(
  team: { companyId?: string | null } | null | undefined,
) {
  return team?.companyId
    ? TEAM_WITH_COMPANY_MAX_STUDY_FILES
    : TEAM_WITHOUT_COMPANY_MAX_STUDY_FILES;
}

export interface UploadPolicy {
  maxFiles: number;
  maxSizeMb: number;
  maxSizeBytes: number;
  allowedTypes: string;
  acceptsAudioVideo: boolean;
}

const PERSONAL_TEAM_UPLOAD_POLICY: UploadPolicy = {
  maxFiles: 8,
  maxSizeMb: 1,
  maxSizeBytes: 1 * 1024 * 1024,
  allowedTypes:
    "text/plain,text/csv,application/pdf,.txt,.md,.doc,.docx,.vtt,.srt",
  acceptsAudioVideo: false,
};

const COMPANY_TEAM_UPLOAD_POLICY: UploadPolicy = {
  maxFiles: 24,
  maxSizeMb: 500,
  maxSizeBytes: 500 * 1024 * 1024,
  allowedTypes:
    "audio/*,video/mp4,video/webm,video/quicktime,video/x-m4v,text/plain,text/csv,application/pdf,.txt,.md,.doc,.docx,.vtt,.srt",
  acceptsAudioVideo: true,
};

export function getAnalysisUploadPolicyForTeam(
  team: { companyId?: string | null } | null | undefined,
): UploadPolicy {
  return team?.companyId
    ? COMPANY_TEAM_UPLOAD_POLICY
    : PERSONAL_TEAM_UPLOAD_POLICY;
}

export function getStudyTypeLabel(type: StudyType): string {
  switch (type) {
    case StudyType.COGNITIVE_WALKTHROUGH:
      return "Walkthrough";
    case StudyType.HEURISTIC_EVALUATION:
      return "Evaluation";
    case StudyType.PERSONA:
      return "Persona";
    case StudyType.QUAL_ANALYSIS:
      return "Analysis";
    case StudyType.LIVE_SESSION:
      return "Live";
    case StudyType.INTERVIEW:
      return "Interview";
    default:
      return "Study";
  }
}
