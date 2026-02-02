import type { StudyVisibility } from "@/apps/nextjs-app/types/types";
import { StudyStatus, StudyType } from "@prisma/client";

/**
 * Type for persona version data returned by getPersonaVersions.
 */
export type PersonaVersionData = {
  id: string;
  version: number;
  isLatest: boolean;
  study: {
    id: string;
    name: string | null;
    createdAt: Date | string;
    updatedAt: Date | string;
    createdByUser: {
      id: string;
      name: string | null;
      email: string | null;
    } | null;
  };
  name: string | null;
  description: string | null;
  photoFile?: {
    key: string | null;
  } | null;
  coverFile?: {
    key: string | null;
  } | null;
};

/**
 * Type for associated study data (heuristic evaluations, cognitive walkthroughs).
 */
export type AssociatedStudy = {
  id: string;
  name: string | null;
  type: StudyType;
  status: StudyStatus;
  createdByUserId: string;
  files?: Array<{ key?: string | null } | null> | null;
  createdAt?: string | Date | null;
  updatedAt?: string | Date | null;
};

/**
 * Type for evaluation entry in studyToPersonaVersionMap.
 */
export type EvaluationEntry = {
  study?: { id: string } | null;
  persona?: { version: number } | null;
};

/**
 * Study type for PersonaMoreMenu - matches properties used by MoreMenu component.
 */
export type PersonaStudy = {
  id: string;
  files?: Array<{ key?: string | null }>;
  visibility?: StudyVisibility;
  shareToken?: string | null;
};

/**
 * User type for display purposes.
 */
export type StudyUser = {
  id: string;
  name: string | null;
  email: string | null;
};
