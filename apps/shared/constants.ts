export const TEAM_NAME_MIN_LENGTH = 3;
export const TEAM_NAME_MAX_LENGTH = 50;
export const RESERVED_TEAM_NAMES = new Set(["personal", "admin", "default"]);
export const APP_BASE_URL = process.env.NEXTAUTH_URL || "https://askseer.ai";

// File upload constants
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
export const MAX_FILE_SIZE_MB = MAX_FILE_SIZE_BYTES / (1024 * 1024);

// Pricing constants
export const PERSONAL_CREDIT_PRICE = 4.99; // Price per credit for users not part of a company
export const COMPANY_CREDIT_PRICE = 19.99; // Price per credit for users part of a company

// ==========================================
// Study Status Constants (matches Prisma StudyStatus enum)
// ==========================================
export const STUDY_STATUS_COMPLETED = "COMPLETED" as const;
export const STUDY_STATUS_FAILED = "FAILED" as const;
export const STUDY_STATUS_PENDING = "PENDING" as const;
