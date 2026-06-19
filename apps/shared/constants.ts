export const TEAM_NAME_MIN_LENGTH = 3;
export const TEAM_NAME_MAX_LENGTH = 50;
export const RESERVED_TEAM_NAMES = new Set(["personal", "admin", "default"]);
export const APP_BASE_URL = process.env.NEXTAUTH_URL || "https://askseer.ai";

// File upload constants
export const MAX_FILE_SIZE_BYTES = 500 * 1024 * 1024; // 500MB
export const MAX_FILE_SIZE_MB = MAX_FILE_SIZE_BYTES / (1024 * 1024);


// Days after pausing to send reminder emails. Each entry is a day offset and
// corresponds to one reminder email. e.g. [1, 3] sends a reminder 1 day after
// pausing and a second reminder 3 days after pausing.
export const INTERVIEW_REMINDER_SCHEDULE_DAYS: number[] = [1, 3];


// Live session constants
export const MAX_LIVE_SESSION_PARTICIPANTS = 8; // Maximum participants allowed in a single live session room

// ==========================================
// Study Status Constants (matches Prisma StudyStatus enum)
// ==========================================
export const STUDY_STATUS_COMPLETED = "COMPLETED" as const;
export const STUDY_STATUS_FAILED = "FAILED" as const;
export const STUDY_STATUS_PENDING = "PENDING" as const;
