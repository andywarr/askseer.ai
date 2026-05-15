import { StudyStatus, StudyType } from "@prisma/client";

// ==========================================
// File Type Helpers
// ==========================================

export function imageTypeToMime(imageType: string | null | undefined): string | null {
  switch (imageType?.toUpperCase()) {
    case "PNG": return "image/png";
    case "JPEG": return "image/jpeg";
    case "GIF": return "image/gif";
    case "WEBP": return "image/webp";
    case "AVIF": return "image/avif";
    case "APNG": return "image/apng";
    case "SVG": return "image/svg+xml";
    default: return null;
  }
}

export function fileTypeToMime(fileType: string | null | undefined): string | null {
  switch (fileType?.toUpperCase()) {
    case "IMAGE": return "image/png";
    case "AUDIO": return "audio/mpeg";
    case "VIDEO": return "video/mp4";
    case "DOCUMENT": return "application/pdf";
    default: return null;
  }
}

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
    case StudyType.QUAL_ANALYSIS:
      return `/analysis/${id}`;
    case StudyType.LIVE_SESSION:
      return `/live/${id}`;
    case StudyType.INTERVIEW:
      return `/interview/${id}`;
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

// ==========================================
// Display User Utilities
// ==========================================

export interface DisplayUser {
  name: string | null;
  email: string | undefined;
  image: string | null;
  status: string | null;
}

/** Reusable date-time formatter — created once, not on every call. */
const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

/**
 * Format a date/time value using the user's locale with medium date and short time.
 */
export function formatDateTime(value: string | Date): string {
  return dateTimeFormatter.format(new Date(value));
}

/**
 * Build display user objects for "created by" and "last modified by" metadata,
 * attaching presigned image URLs.
 */
export function buildDisplayUsers(
  study: {
    createdByUser?: {
      name?: string | null;
      email?: string | null;
      status?: string | null;
    } | null;
    lastModifiedByUser?: {
      name?: string | null;
      email?: string | null;
      status?: string | null;
    } | null;
  },
  createdByImageUrl: string | null,
  lastModifiedByImageUrl: string | null,
): {
  ownerDisplayName: string;
  createdByDisplayUser: DisplayUser | null;
  lastModifiedByDisplayUser: DisplayUser | null;
} {
  const ownerDisplayName =
    study.createdByUser?.name?.trim() ||
    study.createdByUser?.email ||
    "Unknown member";

  const lastModifiedByDisplayName =
    study.lastModifiedByUser?.name?.trim() ||
    study.lastModifiedByUser?.email ||
    ownerDisplayName;

  const createdByDisplayUser: DisplayUser | null = study.createdByUser
    ? {
        ...study.createdByUser,
        name: study.createdByUser.name ?? null,
        email: study.createdByUser.email ?? undefined,
        image: createdByImageUrl,
        status: study.createdByUser.status ?? null,
      }
    : ownerDisplayName
      ? { name: ownerDisplayName, email: undefined, image: null, status: null }
      : null;

  const lastModifiedByDisplayUser: DisplayUser | null = study.lastModifiedByUser
    ? {
        ...study.lastModifiedByUser,
        name: study.lastModifiedByUser.name ?? null,
        email: study.lastModifiedByUser.email ?? undefined,
        image: lastModifiedByImageUrl,
        status: study.lastModifiedByUser.status ?? null,
      }
    : study.createdByUser
      ? {
          ...study.createdByUser,
          name: study.createdByUser.name ?? null,
          email: study.createdByUser.email ?? undefined,
          image: createdByImageUrl,
          status: study.createdByUser.status ?? null,
        }
      : lastModifiedByDisplayName
        ? {
            name: lastModifiedByDisplayName,
            email: undefined,
            image: null,
            status: null,
          }
        : null;

  return { ownerDisplayName, createdByDisplayUser, lastModifiedByDisplayUser };
}
