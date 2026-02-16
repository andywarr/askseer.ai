export const TEAM_NAME_MIN_LENGTH = 3;
export const TEAM_NAME_MAX_LENGTH = 50;
export const RESERVED_TEAM_NAMES = new Set(["personal", "admin", "default"]);
export const APP_BASE_URL = process.env.NEXTAUTH_URL || "https://askseer.ai";

// File upload constants
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
export const MAX_FILE_SIZE_MB = MAX_FILE_SIZE_BYTES / (1024 * 1024);

// Pricing constants (in cents)
export const PERSONAL_STUDY_COST_CENTS = 499; // Cost per study in cents for users not part of a company ($4.99)
export const COMPANY_STUDY_COST_CENTS = 1999; // Cost per study in cents for users part of a company ($19.99)
export const MAX_FUND_AMOUNT_CENTS = 500000; // Maximum funding amount in cents ($5,000.00)
export const INITIAL_BALANCE_CENTS = 1497; // Initial balance for new users (3 × $4.99 = $14.97)

// ==========================================
// Study Status Constants (matches Prisma StudyStatus enum)
// ==========================================
export const STUDY_STATUS_COMPLETED = "COMPLETED" as const;
export const STUDY_STATUS_FAILED = "FAILED" as const;
export const STUDY_STATUS_PENDING = "PENDING" as const;
