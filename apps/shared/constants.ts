export const TEAM_NAME_MIN_LENGTH = 3;
export const TEAM_NAME_MAX_LENGTH = 50;
export const RESERVED_TEAM_NAMES = ["personal", "admin", "default"] as const;
export const APP_BASE_URL = process.env.NEXTAUTH_URL || "https://askseer.ai";
