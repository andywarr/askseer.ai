import type { TeamRole } from "@prisma/client";
import type {
  JobEnvelopeV2,
  JobEnvelopeV2_HE,
  JobEnvelopeV2_CW,
  JobEnvelopeV2_PE,
} from "@/apps/shared/jobSchema.ts";

// Re-export for convenience
export type V2JobData = JobEnvelopeV2;
export type { JobEnvelopeV2_HE, JobEnvelopeV2_CW, JobEnvelopeV2_PE };

// Result data interfaces
export interface HERecommendation {
  recommendation: string;
}

export interface ResultData {
  id: string;
  heuristic: string;
  violated: boolean;
  reason: string;
  severity?: number;
  recommendations: HERecommendation[];
  fileId: string;
  step: number;
}

export interface HeuristicEvaluationData {
  studyData: JobEnvelopeV2_HE;
  results: ResultData[];
}

export interface CWResultData {
  questionId: string;
  answer: string;
}

export interface CWIssueData {
  issueType: string;
  issue: string;
  severity?: number;
  recommendations: Array<CWRecommendationData>;
}

export interface CWRecommendationData {
  recommendation: string;
}

export interface CWStepData {
  step: number;
  expected: boolean;
  results: Array<CWResultData>;
  issues: Array<CWIssueData>;
}

export interface CognitiveWalkthroughData {
  studyData: JobEnvelopeV2_CW;
  results: CWStepData[];
}

// Membership context types
export interface UserMembershipIds {
  teamIds: string[];
  companyIds: string[];
  adminTeamIds: string[];
  adminCompanyIds: string[];
}

export interface StudyManagementContext {
  study: {
    id: string;
    teamId: string | null;
    createdByUserId: string;
    team: { companyId: string | null } | null;
  };
  isOwner: boolean;
  isTeamAdmin: boolean;
  isCompanyAdmin: boolean;
}

// File creation types
export interface FileInput {
  name: string;
  key: string;
  size: number;
  type: string;
  figmaFileKey?: string;
  figmaNodeId?: string;
  figmaFrameName?: string;
  figmaUrl?: string;
}

// Study initialization types
export interface InitStudyParams {
  userId: string;
  teamId: string;
  name: string;
  type: string;
}

export interface FinalizeStudyParams {
  studyId: string;
  files: FileInput[];
  jobData: V2JobData;
}

// Team types
export interface TeamMemberInput {
  userId: string;
  role: TeamRole;
}

// Notification types
export interface CreateNotificationData {
  userId: string;
  type: string;
  audience?: string;
  title: string;
  message?: string | null;
  actionUrl?: string | null;
  metadata?: Record<string, unknown> | null;
  expiresAt?: Date | null;
}
