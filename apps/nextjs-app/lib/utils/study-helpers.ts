import { StudyStatus, StudyType } from "@prisma/client";

// ==========================================
// Shared Types
// ==========================================

export type StudyUser = {
  id: string;
  name: string | null;
  email: string | null;
};

export type StudyFile = {
  key?: string | null;
} | null;

export type StudySummary = {
  id: string;
  name: string | null;
  status: StudyStatus;
  type: StudyType;
  createdByUserId: string;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
  createdByUser?: StudyUser | null;
  lastModifiedByUser?: StudyUser | null;
  files?: (StudyFile | null)[] | null;
  visibility?: "PRIVATE" | "TEAM" | "COMPANY";
  shareToken?: string | null;
  team?: { isPersonal?: boolean; company?: { id: string } | null } | null;
  persona?: {
    isLatest?: boolean;
    _count?: {
      heuristicEvaluations: number;
      cognitiveWalkthroughs: number;
    };
  } | null;
};

export type StudyWithPreview = {
  study: StudySummary;
  previewUrl: string | null;
  canManage: boolean;
  hasAssociatedStudies: boolean;
};

// ==========================================
// Shared Utilities
// ==========================================

export function getStudyHref(type: StudyType, id: string): string | null {
  switch (type) {
    case StudyType.HEURISTIC_EVALUATION:
      return `/evaluation/${id}`;
    case StudyType.PERSONA:
      return `/persona/${id}`;
    case StudyType.COGNITIVE_WALKTHROUGH:
      return `/walkthrough/${id}`;
    default:
      return null;
  }
}

/** Reusable formatter — created once, not on every call. */
const dateFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "";
  return dateFormatter.format(new Date(date));
}

export function formatUserName(user: StudyUser | null | undefined): string {
  if (!user) return "Unknown";
  return user.name || user.email || "Unknown";
}
