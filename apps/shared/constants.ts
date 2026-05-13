export const TEAM_NAME_MIN_LENGTH = 3;
export const TEAM_NAME_MAX_LENGTH = 50;
export const RESERVED_TEAM_NAMES = new Set(["personal", "admin", "default"]);
export const APP_BASE_URL = process.env.NEXTAUTH_URL || "https://askseer.ai";

// File upload constants
export const MAX_FILE_SIZE_BYTES = 500 * 1024 * 1024; // 500MB
export const MAX_FILE_SIZE_MB = MAX_FILE_SIZE_BYTES / (1024 * 1024);

// Per-study-type pricing constants (in cents)
export const PERSONAL_EVALUATION_COST_CENTS = 499; // $4.99
export const PERSONAL_WALKTHROUGH_COST_CENTS = 499; // $4.99
export const PERSONAL_PERSONA_COST_CENTS = 249; // $2.49
export const COMPANY_EVALUATION_COST_CENTS = 1999; // $19.99
export const COMPANY_WALKTHROUGH_COST_CENTS = 1999; // $19.99
export const COMPANY_PERSONA_COST_CENTS = 499; // $4.99
export const PERSONAL_QUAL_ANALYSIS_COST_CENTS = 1499; // $14.99
export const COMPANY_QUAL_ANALYSIS_COST_CENTS = 4499; // $44.99
export const PERSONAL_LIVE_SESSION_COST_CENTS = 499; // $4.99
export const COMPANY_LIVE_SESSION_COST_CENTS = 1999; // $19.99
export const PERSONAL_LIVE_AI_ANALYSIS_COST_CENTS = 999; // $9.99 (discounted from $14.99)
export const COMPANY_LIVE_AI_ANALYSIS_COST_CENTS = 2999; // $29.99 (discounted from $44.99)
export const PERSONAL_INTERVIEW_COST_CENTS = 499; // $4.99
export const COMPANY_INTERVIEW_COST_CENTS = 1999; // $19.99

// Days after pausing to send reminder emails. Each entry is a day offset and
// corresponds to one reminder email. e.g. [1, 3] sends a reminder 1 day after
// pausing and a second reminder 3 days after pausing.
export const INTERVIEW_REMINDER_SCHEDULE_DAYS: number[] = [1, 3];

// Backward-compatible aliases (highest per-type cost)
// Used for balance threshold warnings, minimum fund amounts, and auto-refill checks
export const PERSONAL_STUDY_COST_CENTS = PERSONAL_QUAL_ANALYSIS_COST_CENTS;
export const COMPANY_STUDY_COST_CENTS = COMPANY_QUAL_ANALYSIS_COST_CENTS;

// Lowest per-type cost — used for balance exhaustion checks
export const PERSONAL_MIN_STUDY_COST_CENTS = PERSONAL_PERSONA_COST_CENTS;
export const COMPANY_MIN_STUDY_COST_CENTS = COMPANY_PERSONA_COST_CENTS;

export const MAX_FUND_AMOUNT_CENTS = 500000; // Maximum funding amount in cents ($5,000.00)
export const INITIAL_BALANCE_CENTS = 1497; // Initial balance for new users (3 × $4.99 = $14.97)

// Live session constants
export const MAX_LIVE_SESSION_PARTICIPANTS = 8; // Maximum participants allowed in a single live session room

// ==========================================
// Study Status Constants (matches Prisma StudyStatus enum)
// ==========================================
export const STUDY_STATUS_COMPLETED = "COMPLETED" as const;
export const STUDY_STATUS_FAILED = "FAILED" as const;
export const STUDY_STATUS_PENDING = "PENDING" as const;
